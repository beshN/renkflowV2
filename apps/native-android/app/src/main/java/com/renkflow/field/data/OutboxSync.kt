package com.renkflow.field.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import java.security.MessageDigest
import java.util.Base64

fun retryDelay(attempt: Int): Long = (15_000L * (1L shl attempt.coerceIn(0, 8))).coerceAtMost(3_600_000L)
data class DrainResult(val delivered: Int, val retry: Boolean = false)
interface OutboxSender { suspend fun send(record: OutboxRecord): String? }

class OutboxSync(private val store: OfflineStore, private val sender: OutboxSender) {
    suspend fun drain(scope: String): DrainResult = mutex.withLock {
        store.prepare()
        var delivered = 0
        while (true) {
            val row = store.dao.pending(scope).firstOrNull() ?: return@withLock DrainResult(delivered)
            if (row.state != "pending") return@withLock DrainResult(delivered)
            if (row.nextAttemptAt > System.currentTimeMillis()) return@withLock DrainResult(delivered, true)
            // Parse before claiming; corrupt rows stay visible and block dependent writes.
            try {
                if (row.kind == "photo") fieldJson.decodeFromString<LocalPhoto>(row.payload).also { require(Base64.getDecoder().decode(it.base64).isNotEmpty()) }
                else fieldJson.decodeFromString<SyncRequest>(row.payload).also { require(it.idempotencyKey == row.commandId && it.kind == row.kind) }
            } catch (e: Exception) {
                store.dao.update(row.copy(state="corrupt",reason="Yerel kayıt okunamadı. Kayıt korunuyor; bu işlemi inceleyip vazgeçebilirsiniz.")); return@withLock DrainResult(delivered)
            }
            store.dao.update(row.copy(state="sending"))
            try {
                val url = sender.send(row)
                store.dao.update(row.copy(state="delivered",resultURL=url,reason=null,payload=if(row.kind=="photo") "{}" else row.payload))
                delivered++
            } catch (e: Exception) {
                if (e is CancellationException) { store.dao.update(row.copy(state="pending")); throw e }
                val api = e as? ApiException
                when (api?.status) {
                    409 -> store.dao.update(row.copy(state="conflict",reason=api.message,canRetry=api.canRetry))
                    400,403,404,413,415 -> store.dao.update(row.copy(state="blocked",reason=api.message,canRetry=false))
                    401,426 -> { store.dao.update(row.copy(state="pending")); throw e }
                    else -> { store.dao.update(row.copy(state="pending",attempts=row.attempts+1,nextAttemptAt=System.currentTimeMillis()+retryDelay(row.attempts))); return@withLock DrainResult(delivered,true) }
                }
                return@withLock DrainResult(delivered)
            }
        }
        @Suppress("UNREACHABLE_CODE") DrainResult(delivered)
    }
    companion object { private val mutex = Mutex() }
}
class APIOutboxSender(private val store: OfflineStore, private val api: Api, private val session: Session) : OutboxSender {
    private val scope = sessionScope(session)
    override suspend fun send(record: OutboxRecord): String? {
        if(record.kind == "photo") return upload(record)
        val request=fieldJson.decodeFromString<SyncRequest>(record.payload)
        var data=request.data
        if (request.kind in listOf("operation","scrap")) {
            val photos=data["photos"]?.jsonArray?.map { element ->
                val url=element.jsonPrimitive.content
                if(!url.startsWith("local://")) element else {
                    val photo=store.dao.find(scope,url.removePrefix("local://"))
                    if(photo?.kind!="photo" || photo.state!="delivered" || photo.resultURL==null) throw ApiException(400,"Fotoğraf eşitlenmedi veya silinmiş; bu bildirimi inceleyin.")
                    JsonPrimitive(photo!!.resultURL!!)
                }
            }
            if(photos!=null) data=JsonObject(data.toMutableMap().apply { put("photos",JsonArray(photos)) })
        }
        val accepted=fieldJson.decodeFromJsonElement<Accepted>(api.raw(session.server,session.token,"sync",fieldJson.encodeToString(request.copy(data=data))))
        if(!accepted.accepted) throw ApiException(502,"Sunucu işlemi onaylamadı.")
        return null
    }
    private fun sha(bytes: ByteArray)=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    private suspend fun upload(record: OutboxRecord): String {
        val photo=fieldJson.decodeFromString<LocalPhoto>(record.payload)
        val bytes=Base64.getDecoder().decode(photo.base64)
        suspend fun call(body: JsonObject): UploadStatus = fieldJson.decodeFromJsonElement(api.raw(session.server,session.token,"uploads",body.toString()))
        var status=call(buildJsonObject { put("action","init");put("uploadId",record.commandId);put("workOrderId",photo.workOrderId);put("name",photo.name);put("totalBytes",bytes.size);put("sha256",sha(bytes)) })
        require(status.totalBytes==bytes.size && status.receivedBytes in 0..bytes.size && status.chunkBytes in 1..262144) { "Sunucu yükleme durumu geçersiz." }
        while(!status.completed && status.receivedBytes<bytes.size) {
            val offset=status.receivedBytes
            val part=bytes.copyOfRange(offset,(offset+status.chunkBytes).coerceAtMost(bytes.size))
            status=call(buildJsonObject { put("action","chunk");put("uploadId",record.commandId);put("offset",offset);put("base64",Base64.getEncoder().encodeToString(part));put("sha256",sha(part)) })
            require(status.receivedBytes>offset && status.receivedBytes<=bytes.size) { "Fotoğraf parçası onaylanmadı." }
        }
        if(!status.completed) status=call(buildJsonObject { put("action","finish");put("uploadId",record.commandId) })
        return requireNotNull(status.url) { "Fotoğraf tamamlanmadı." }
    }
}
