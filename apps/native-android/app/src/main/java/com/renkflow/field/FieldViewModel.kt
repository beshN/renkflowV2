package com.renkflow.field

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.renkflow.field.data.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

data class FieldState(
    val session: Session? = null, val restoring: Boolean = true, val busy: Boolean = false,
    val snapshot: Snapshot? = null, val detail: WorkOrder? = null, val selectedId: String? = null,
    val scan: ScanResult? = null, val error: String? = null, val message: String? = null,
    val stale: Boolean = true, val pending: Command? = null
)

class FieldViewModel(application: Application) : AndroidViewModel(application) {
    private val api = Api()
    private val vault = Vault(application)
    private val mutable = MutableStateFlow(FieldState())
    val state = mutable.asStateFlow()
    private var epoch = 0
    private var lastValidation = 0L
    init { restore() }
    private fun restore() {
        val saved = vault.session()
        if (saved == null || saved.expiresAt <= System.currentTimeMillis()) { vault.clear(); mutable.value = FieldState(restoring = false); return }
        mutable.update { it.copy(session = saved, pending = vault.pending(), busy = true) }
        viewModelScope.launch {
            try {
                val user = api.me(saved)
                val session = saved.copy(user = user)
                vault.saveSession(session)
                mutable.update { it.copy(session = session) }
                loadSnapshot(session)
                lastValidation = System.currentTimeMillis()
            } catch (e: Exception) { fail(e) }
            finally { mutable.update { it.copy(restoring = false, busy = false) } }
        }
    }
    fun login(server: String, email: String, password: String) {
        if (state.value.busy) return
        mutable.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                val host = normalizeServer(server)
                val result = api.login(host, email.trim().lowercase(), password)
                require(result.user.role in listOf("owner", "admin", "office", "worker")) { "Bu hesap saha uygulamasına erişemiyor." }
                val session = Session(host, result.accessToken, System.currentTimeMillis() + result.expiresIn * 1000, result.user)
                val verified = session.copy(user = api.me(session))
                vault.clear(); vault.saveSession(verified)
                epoch++
                mutable.value = FieldState(session = verified, restoring = false, busy = true)
                loadSnapshot(verified)
                lastValidation = System.currentTimeMillis()
            } catch (e: Exception) { fail(e) }
            finally { mutable.update { it.copy(busy = false) } }
        }
    }
    fun logout() { epoch++; vault.clear(); mutable.value = FieldState(restoring = false) }
    fun dismiss() { mutable.update { it.copy(error = null, message = null) } }
    fun foreground() { if (System.currentTimeMillis() - lastValidation > 60_000) refresh() }
    fun refresh() {
        val session = state.value.session ?: return
        if (state.value.busy) return
        val generation = epoch
        mutable.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                if (session.expiresAt <= System.currentTimeMillis()) throw ApiException(401, "Oturumunuz sona erdi.")
                api.me(session)
                if (generation != epoch) return@launch
                lastValidation = System.currentTimeMillis()
                loadSnapshot(session)
                state.value.selectedId?.let { id ->
                    val detail = api.details(session, id)
                    if (generation == epoch && state.value.selectedId == id) mutable.update { it.copy(detail = detail) }
                }
            } catch (e: Exception) { if (generation == epoch) fail(e) }
            finally { if (generation == epoch) mutable.update { it.copy(busy = false) } }
        }
    }
    private suspend fun loadSnapshot(session: Session) {
        val generation = epoch
        val snapshot = api.snapshot(session)
        if (generation == epoch) mutable.update { it.copy(snapshot = snapshot, stale = false) }
    }
    fun openJob(id: String) {
        val session = state.value.session ?: return
        val generation = epoch
        mutable.update { it.copy(selectedId = id, detail = null, error = null) }
        viewModelScope.launch {
            try {
                val detail = api.details(session, id)
                if (generation == epoch && state.value.selectedId == id) mutable.update { it.copy(detail = detail) }
            } catch (e: Exception) { if (generation == epoch) fail(e) }
        }
    }
    fun closeJob() { mutable.update { it.copy(selectedId = null, detail = null) } }
    fun scan(code: String) = perform { session ->
        require(code.trim().isNotEmpty() && code.length <= 1000) { "Geçerli bir etiket kodu girin." }
        mutable.update { it.copy(scan = null) }
        val result = api.scan(session, code.trim())
        mutable.update { it.copy(scan = result) }
    }
    fun checklist(item: ChecklistItem) {
        val id = state.value.selectedId ?: return
        performMutation("work-orders/$id/checklist/${item.id}", buildJsonObject { put("completed", !item.completed) }.toString())
    }
    fun comment(text: String, onSaved: () -> Unit = {}) {
        val id = state.value.selectedId ?: return
        if (text.trim().length !in 1..2000) return
        performMutation("work-orders/$id/comments", buildJsonObject { put("body", text.trim()) }.toString(), onSaved)
    }
    fun transition(status: String, reason: String? = null) {
        val id = state.value.selectedId ?: return
        performMutation("work-orders/$id/transition", buildJsonObject {
            put("status", status)
            if (status == "blocked") { put("blockedReasonCategory", "other"); put("blockedReasonDetail", reason.orEmpty().trim()) }
        }.toString())
    }
    private fun performMutation(path: String, body: String, onSaved: () -> Unit = {}) = perform(writing = true) { session ->
        api.raw(session.server, session.token, "field/$path", body)
        onSaved()
        mutable.update { it.copy(message = "İşlem kaydedildi.") }
        reloadAfterWrite(session)
    }
    fun command(input: OperationInput) {
        if (state.value.busy || state.value.stale || state.value.pending != null || state.value.session == null) return
        val command = Command(UUID.randomUUID().toString(), data = input)
        try { vault.savePending(command) } catch (e: Exception) { fail(e); return }
        mutable.update { it.copy(pending = command) }
        retryCommand()
    }
    fun retryCommand() {
        val command = state.value.pending ?: return
        perform(writing = true, retry = true) { session ->
            try {
                val result = api.command(session, command)
                vault.clearPending()
                mutable.update { it.copy(pending = null, message = if (result.qualityRejected) "Kalite kontrol başarısız. Operasyon bloke edildi." else "Üretim işlemi kaydedildi.") }
                reloadAfterWrite(session)
            } catch (e: ApiException) {
                if (e.status in listOf(400, 403, 404, 409, 413, 415)) { vault.clearPending(); mutable.update { it.copy(pending = null) } }
                throw e
            }
        }
    }
    fun uploadPhoto(jobId: String, base64: String, onUploaded: (String) -> Unit) = perform(writing = true) { session ->
        require(base64.length <= 2_800_000) { "Fotoğraf çok büyük. Daha küçük bir fotoğraf seçin." }
        onUploaded(api.photo(session, PhotoInput(base64 = base64, workOrderId = jobId)).url)
    }
    private suspend fun reloadAfterWrite(session: Session) {
        try {
            loadSnapshot(session)
            val id = state.value.selectedId
            if (id != null) {
                val detail = api.details(session, id)
                if (state.value.selectedId == id) mutable.update { it.copy(detail = detail) }
            }
        } catch (e: Exception) { fail(e) }
    }
    private fun perform(writing: Boolean = false, retry: Boolean = false, action: suspend (Session) -> Unit) {
        val session = state.value.session ?: return
        if (state.value.busy || (writing && !retry && (state.value.stale || state.value.pending != null))) return
        val generation = epoch
        mutable.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                if (session.expiresAt <= System.currentTimeMillis()) throw ApiException(401, "Oturumunuz sona erdi.")
                action(session)
            } catch (e: Exception) { if (generation == epoch) fail(e) }
            finally { if (generation == epoch) mutable.update { it.copy(busy = false) } }
        }
    }
    private fun fail(error: Exception) {
        if (error is CancellationException) throw error
        if (error is ApiException && error.status == 401) {
            logout(); mutable.update { it.copy(error = "Oturumunuz sona erdi. Yeniden giriş yapın.") }
        } else mutable.update { it.copy(error = if (error is java.io.IOException) "Bağlantı kurulamadı. Son veriler gösteriliyor; yenilemeyi deneyin." else error.message ?: "İşlem tamamlanamadı.", stale = true) }
    }
}
