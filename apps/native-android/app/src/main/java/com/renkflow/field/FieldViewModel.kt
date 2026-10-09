package com.renkflow.field

import android.app.Application
import androidx.room.withTransaction
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.renkflow.field.data.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import java.time.Instant
import java.util.UUID

data class FieldState(
    val session: Session? = null, val restoring: Boolean = true, val busy: Boolean = false,
    val snapshot: Snapshot? = null, val detail: WorkOrder? = null, val selectedId: String? = null,
    val scan: ScanResult? = null, val error: String? = null, val message: String? = null,
    val stale: Boolean = true, val updateRequired: Boolean = false, val pending: Command? = null,
    val outbox: List<OutboxRecord> = emptyList(), val syncing: Boolean = false,
    val lastSync: Long? = null, val accessBlocked: Boolean = false,val references:FieldReferences?=null,val installations:List<Installation> = emptyList(),val installationDetail:InstallationDetails?=null,val preferences:NotificationPreferences?=null,val notifications:List<FieldNotification> = emptyList(),val preferencesBusy:Boolean=false
)
class FieldViewModel(application: Application) : AndroidViewModel(application) {
    private val api=SessionManager.api(application)
    private val vault=Vault(application)
    private val offline=OfflineStore.get(application)
    private val mutable=MutableStateFlow(FieldState())
    val state=mutable.asStateFlow()
    private var epoch=0
    private var watcher: Job? = null
    private var lastValidation=0L
    init { restore() }
    private suspend fun attach(session: Session) {
        offline.prepare()
        offline.migrateLegacy(session,vault.pending());vault.clearPending()
        val scope=sessionScope(session)
        watcher?.cancel();watcher=viewModelScope.launch { offline.dao.watch(scope).collect { rows->mutable.update { it.copy(outbox=rows) } } }
        val snapshot=offline.dao.cache(scope,"snapshot")?.let { runCatching { fieldJson.decodeFromString<Snapshot>(it.payload) }.getOrNull() }
        val lastSync=offline.dao.cache(scope,"last-sync")?.payload?.toLongOrNull()
        val references=offline.dao.cache(scope,"references")?.let {runCatching {fieldJson.decodeFromString<FieldReferences>(it.payload)}.getOrNull()}
        mutable.update { it.copy(snapshot=snapshot,lastSync=lastSync,stale=true,references=references,preferences=offline.dao.cache(scope,"notifications/preferences")?.let {runCatching {fieldJson.decodeFromString<NotificationPreferences>(it.payload)}.getOrNull()},notifications=offline.dao.cache(scope,"notifications")?.let {runCatching {fieldJson.decodeFromString<NotificationList>(it.payload).notifications}.getOrNull()}.orEmpty(),installations=offline.dao.cache(scope,"installations")?.let {runCatching {fieldJson.decodeFromString<InstallationList>(it.payload).installations}.getOrNull()}.orEmpty()) }
        FieldSyncWorker.schedule(getApplication())
    }
    private fun restore() = viewModelScope.launch {
        val saved=vault.session()
        if(saved==null) { mutable.value=FieldState(restoring=false);return@launch }
        mutable.update { it.copy(session=saved) }
        try { attach(saved); mutable.update { it.copy(restoring=false) }; refresh() }
        catch(e: Exception) { fail(e);mutable.update { it.copy(restoring=false) } }
    }
    fun login(server: String,email: String,password: String) {
        if(state.value.busy) return
        mutable.update { it.copy(busy=true,error=null) }
        viewModelScope.launch {
            try {
                val origin=normalizeServer(server)
                val result=api.login(origin,email.trim().lowercase(),password,DeviceIdentity(getApplication()).id())
                val auth=Session(origin,result.accessToken,System.currentTimeMillis()+result.expiresIn*1000,result.user,result.refreshToken,result.sessionId,result.deviceId)
                vault.clear();vault.saveSession(auth)
                val verified=auth.copy(user=api.me(auth))
                vault.clear();vault.saveSession(verified);epoch++
                mutable.value=FieldState(session=verified,restoring=false,busy=true)
                attach(verified);loadSnapshot(verified);lastValidation=System.currentTimeMillis()
                mutable.update { it.copy(busy=false) };sync()
            } catch(e: Exception) { fail(e) }
            finally { mutable.update { it.copy(busy=false) } }
        }
    }
    fun logout() {
        vault.session()?.let {auth->viewModelScope.launch {runCatching {Api().raw(auth.server,auth.token,"auth/logout","{}")}}}
        epoch++;watcher?.cancel();FieldSyncWorker.cancel(getApplication());vault.clear();mutable.value=FieldState(restoring=false) }
    fun dismiss() { mutable.update { it.copy(error=null,message=null) } }
    fun foreground() { if(System.currentTimeMillis()-lastValidation>60_000) refresh() else sync() }
    fun refresh() {
        val auth=state.value.session ?: return
        if(state.value.busy) return
        val generation=epoch
        mutable.update { it.copy(busy=true,error=null) }
        viewModelScope.launch {
            try {
                
                api.me(auth);if(generation!=epoch) return@launch
                lastValidation=System.currentTimeMillis();loadSnapshot(auth)
                state.value.selectedId?.let { id-> val job=api.details(auth,id);cacheDetail(auth,job);if(generation==epoch && state.value.selectedId==id) mutable.update { it.copy(detail=overlayJob(job,offline.dao.pending(sessionScope(auth)))) } }
                mutable.update { it.copy(accessBlocked=false,busy=false) };sync()
            } catch(e: Exception) { if(generation==epoch) fail(e) }
            finally { if(generation==epoch) mutable.update { it.copy(busy=false) } }
        }
    }
    private suspend fun loadSnapshot(auth: Session) {
        val generation=epoch
        var snapshot=api.snapshot(auth)
        val scope=sessionScope(auth)
        for(row in offline.dao.pending(scope)) snapshot=overlay(snapshot,row)
        offline.db.withTransaction {
            offline.save(scope,"snapshot",fieldJson.encodeToString(snapshot))
            snapshot.workOrders.forEach { cacheDetail(auth,it) }
            offline.save(scope,"last-sync",System.currentTimeMillis().toString())
        }
        if(generation==epoch) mutable.update { it.copy(snapshot=snapshot,stale=false,lastSync=System.currentTimeMillis()) }
        val references=api.raw(auth.server,auth.token,"references").jsonObject
        offline.save(scope,"references",references.toString())
        if(generation==epoch) mutable.update {it.copy(references=fieldJson.decodeFromJsonElement<FieldReferences>(references))}
        val prefs=api.raw(auth.server,auth.token,"notifications/preferences");offline.save(scope,"notifications/preferences",prefs.toString())
        val notifications=api.raw(auth.server,auth.token,"notifications");offline.save(scope,"notifications",notifications.toString())
        if(generation==epoch) mutable.update {it.copy(preferences=fieldJson.decodeFromJsonElement<NotificationPreferences>(prefs),notifications=fieldJson.decodeFromJsonElement<NotificationList>(notifications).notifications)}
        if(references["capabilities"]?.jsonObject?.get("installations")?.jsonPrimitive?.booleanOrNull==true) {
            val values=api.raw(auth.server,auth.token,"installations");offline.save(scope,"installations",values.toString())
            if(generation==epoch) mutable.update {it.copy(installations=fieldJson.decodeFromJsonElement<InstallationList>(values).installations)}
            state.value.installationDetail?.id?.let {loadInstallation(auth,it,generation)}
        } else if(generation==epoch) mutable.update {it.copy(installations=emptyList(),installationDetail=null)}
    }
    private suspend fun cacheDetail(auth: Session,job: WorkOrder) = offline.save(sessionScope(auth),"job:${job.id}",fieldJson.encodeToString(job))
    fun notificationPreference(key:String,value:Boolean) {
        val auth=state.value.session ?: return;val current=state.value.preferences ?: return
        if(state.value.stale || state.value.preferencesBusy || state.value.updateRequired) return
        val next=when(key) {"assignment"->current.copy(assignment=value);"mention"->current.copy(mention=value);else->current.copy(delay=value)}
        val generation=epoch;mutable.update {it.copy(preferencesBusy=true)}
        viewModelScope.launch {
            try {
                val saved=fieldJson.decodeFromJsonElement<NotificationPreferences>(api.raw(auth.server,auth.token,"notifications/preferences",fieldJson.encodeToString(next)))
                offline.save(sessionScope(auth),"notifications/preferences",fieldJson.encodeToString(saved))
                if(generation==epoch) mutable.update {it.copy(preferences=saved)}
            } catch(e:Exception) {if(generation==epoch) fail(e)}
            finally {if(generation==epoch) mutable.update {it.copy(preferencesBusy=false)}}
        }
    }
    fun openJob(id: String) {
        val auth=state.value.session ?: return
        val generation=epoch
        mutable.update { it.copy(selectedId=id,detail=null,error=null) }
        viewModelScope.launch {
            val cached=offline.dao.cache(sessionScope(auth),"job:$id")?.let { runCatching { fieldJson.decodeFromString<WorkOrder>(it.payload) }.getOrNull() }
            if(generation==epoch && state.value.selectedId==id) mutable.update { it.copy(detail=cached) }
            try { val job=overlayJob(api.details(auth,id),offline.dao.pending(sessionScope(auth)));cacheDetail(auth,job);if(generation==epoch&&state.value.selectedId==id) mutable.update { it.copy(detail=job) } }
            catch(e: Exception) { if(generation==epoch) fail(e) }
        }
    }
    private var selectedInstallationId:String?=null
    fun openInstallation(id:String) {
        val auth=state.value.session ?: return;val generation=epoch
        selectedInstallationId=id
        mutable.update {it.copy(installationDetail=null)}
        viewModelScope.launch {
            val saved=offline.dao.cache(sessionScope(auth),"installation:$id")?.let {runCatching {fieldJson.decodeFromString<InstallationDetails>(it.payload)}.getOrNull()}
            if(generation==epoch && selectedInstallationId==id) mutable.update {it.copy(installationDetail=saved)}
            try {loadInstallation(auth,id,generation)} catch(e:Exception) {if(generation==epoch) fail(e)}
        }
    }
    private suspend fun loadInstallation(auth:Session,id:String,generation:Int) {
        val values=fieldJson.decodeFromJsonElement<InstallationDetails>(api.raw(auth.server,auth.token,"installations/$id"))
        val result=overlayInstallation(values,offline.dao.pending(sessionScope(auth)))
        offline.save(sessionScope(auth),"installation:$id",fieldJson.encodeToString(result))
        if(generation==epoch && selectedInstallationId==id) mutable.update {it.copy(installationDetail=result)}
    }
    fun installationCommand(action:String,item:InstallationCheck?=null,kind:String?=null,text:String?=null) {
        val current=state.value.installationDetail ?: return
        enqueue("installation",current.id,buildJsonObject {put("action",action);put("expectedVersion",current.version);if(item!=null) {put("itemId",item.id);put("completed",!item.completed)};if(kind!=null) put("kind",kind);if(text!=null) put("text",text.trim())})
    }
    fun closeJob() { mutable.update { it.copy(selectedId=null,detail=null) } }
    fun scan(code: String) {
        val auth=state.value.session ?: return
        viewModelScope.launch {
            try { require(code.trim().isNotEmpty() && code.length<=1000) { "Geçerli bir etiket kodu girin." };val result=api.scan(auth,code.trim());offline.save(sessionScope(auth),"scan:${code.trim()}",fieldJson.encodeToString(result));mutable.update { it.copy(scan=result) } }
            catch(e: Exception) {
                val cached=offline.dao.cache(sessionScope(auth),"scan:${code.trim()}")?.let { runCatching { fieldJson.decodeFromString<ScanResult>(it.payload) }.getOrNull() }
                if(cached!=null) mutable.update { it.copy(scan=cached,stale=true) } else fail(e)
            }
        }
    }
    fun checklist(item: ChecklistItem) { val job=state.value.detail ?: return;enqueue("checklist",job.id,buildJsonObject { put("itemId",item.id);put("completed",!item.completed);put("expectedCompleted",item.completed) }) }
    fun comment(text: String,onSaved: ()->Unit = {}) {
        val job=state.value.detail ?: return
        if(text.trim().length !in 1..2000) return
        enqueue("comment",job.id,buildJsonObject { put("body",text.trim()) },onSaved)
    }
    fun transition(status: String,reason: String?=null) {
        val job=state.value.detail ?: return
        val revision=job.updatedAt ?: return
        enqueue("transition",job.id,buildJsonObject { put("status",status);put("expectedUpdatedAt",revision);if(status=="blocked") {put("blockedReasonCategory","other");put("blockedReasonDetail",reason.orEmpty().trim())} })
    }
    fun fieldEvent(kind:String,jobId:String,reason:String,count:Int,note:String,photo:String?) = enqueue(kind,jobId,buildJsonObject {put("reasonCode",reason);put("note",note.trim());if(kind=="scrap") {put("quantity",count);put("photos",JsonArray(listOfNotNull(photo).map(::JsonPrimitive)))}})
    fun command(input: OperationInput) = enqueue("operation",null,fieldJson.encodeToJsonElement(input).jsonObject)
    private fun writable() = state.value.session!=null && !state.value.updateRequired && !state.value.accessBlocked && state.value.snapshot?.permissions?.transition==true
    private fun enqueue(kind: String,jobId: String?,data: JsonObject,onSaved: ()->Unit = {}) {
        val auth=state.value.session ?: return
        if(if(kind=="installation") state.value.updateRequired || state.value.accessBlocked || state.value.references?.capabilities?.installationEdit!=true else !writable()) return
        val generation=epoch
        viewModelScope.launch {
            try {
                val request=SyncRequest(UUID.randomUUID().toString(),kind,data,if(kind=="installation") null else jobId,if(kind=="installation") jobId else null)
                val row=OutboxRecord(scope=sessionScope(auth),commandId=request.idempotencyKey,kind=kind,payload=fieldJson.encodeToString(request))
                val current=state.value
                val snapshot=current.snapshot?.let { overlay(it,row) }
                val detail=current.detail?.let { overlayJob(it,listOf(row)) }
                val installation=current.installationDetail?.let {overlayInstallation(it,listOf(row))}
                val cache=buildMap<String,String> { installation?.let {put("installation:${it.id}",fieldJson.encodeToString(it))}; snapshot?.let { put("snapshot",fieldJson.encodeToString(it)) }; detail?.let { put("job:${it.id}",fieldJson.encodeToString(it)) } }
                offline.enqueueWithCache(sessionScope(auth),request,cache)
                if(generation==epoch) { mutable.update { it.copy(snapshot=snapshot,detail=detail,installationDetail=installation,message="İşlem cihazda kaydedildi.") };onSaved();FieldSyncWorker.schedule(getApplication());sync() }
            } catch(e: Exception) { if(generation==epoch) fail(e) }
        }
    }
    fun retryCommand() = sync()
    fun sync() {
        val auth=state.value.session ?: return
        if(state.value.syncing || state.value.updateRequired) return
        val generation=epoch
        mutable.update { it.copy(syncing=true) }
        viewModelScope.launch {
            try {
                val result=OutboxSync(offline,object: OutboxSender {
                    private val sender=APIOutboxSender(offline,api,auth)
                    override suspend fun send(record: OutboxRecord): String? { if(generation!=epoch) throw CancellationException();return sender.send(record) }
                }).drain(sessionScope(auth))
                if(generation==epoch && (result.delivered>0 || offline.dao.pending(sessionScope(auth)).any { it.state in listOf("conflict","blocked") })) { loadSnapshot(auth);state.value.selectedId?.let { id->val job=overlayJob(api.details(auth,id),offline.dao.pending(sessionScope(auth)));cacheDetail(auth,job);mutable.update { it.copy(detail=job) } } }
                if(result.retry && generation==epoch) { mutable.update { it.copy(stale=true) };FieldSyncWorker.schedule(getApplication()) }
            } catch(e: Exception) { if(generation==epoch) fail(e) }
            finally { if(generation==epoch) mutable.update { it.copy(syncing=false) } }
        }
    }
    fun uploadPhoto(jobId: String,base64: String,onUploaded: (String)->Unit) {
        val auth=state.value.session ?: return
        if(!writable()) return
        viewModelScope.launch {
            try {
                require(base64.length<=2_800_000) { "Fotoğraf çok büyük." }
                val id=UUID.randomUUID().toString()
                offline.dao.enqueue(OutboxRecord(scope=sessionScope(auth),commandId=id,kind="photo",payload=fieldJson.encodeToString(LocalPhoto(jobId,base64))))
                onUploaded("local://$id");FieldSyncWorker.schedule(getApplication());sync()
            } catch(e: Exception) { fail(e) }
        }
    }
    fun uploadInstallationPhoto(id:String,base64:String,onSaved:()->Unit) {
        val auth=state.value.session ?: return
        if(state.value.references?.capabilities?.installationEdit!=true || state.value.updateRequired || state.value.accessBlocked) return
        viewModelScope.launch {
            try {
                require(base64.length<=2_800_000)
                offline.dao.enqueue(OutboxRecord(scope=sessionScope(auth),commandId=UUID.randomUUID().toString(),kind="photo",payload=fieldJson.encodeToString(LocalPhoto(base64=base64,installationId=id))))
                onSaved();FieldSyncWorker.schedule(getApplication());sync()
            } catch(e:Exception) {fail(e)}
        }
    }
    fun discard(row: OutboxRecord) = viewModelScope.launch {
        if(row.scope!=state.value.session?.let(::sessionScope) || row.state=="sending") return@launch
        offline.dao.update(row.copy(state="delivered",reason="Kullanıcı vazgeçti.",canRetry=false));refresh();sync()
    }
    fun reapply(row: OutboxRecord) {
        val auth=state.value.session ?: return
        if(!row.canRetry || row.state!="conflict" || row.scope!=sessionScope(auth) || state.value.busy) return
        mutable.update {it.copy(busy=true)}
        viewModelScope.launch {
            try {
                val request=fieldJson.decodeFromString<SyncRequest>(row.payload)
                // Fetch current data; never reuse the stale revision or bypass assignment/closed checks.
                val fresh=api.snapshot(auth)
                require(fresh.permissions.transition) { "Yazma yetkiniz yok." }
                val data=when(request.kind) {
                    "operation"-> { val op=fresh.operations.firstOrNull { it.id==request.data["operationId"]?.jsonPrimitive?.content } ?: throw ApiException(404,"Operasyon artık size atanmamış.");require(op.status!="done");JsonObject(request.data.toMutableMap().apply { put("version",JsonPrimitive(op.version)) }) }
                    "checklist"-> { val job=api.details(auth,request.workOrderId!!);require(job.status !in listOf("done","cancelled"));val item=job.checklist.first { it.id==request.data["itemId"]?.jsonPrimitive?.content };JsonObject(request.data.toMutableMap().apply { put("expectedCompleted",JsonPrimitive(item.completed)) }) }
                    "transition"-> { val job=api.details(auth,request.workOrderId!!);require(job.status !in listOf("done","cancelled"));JsonObject(request.data.toMutableMap().apply { put("expectedUpdatedAt",JsonPrimitive(job.updatedAt!!)) }) }
                    else->throw IllegalArgumentException("Bu işlem yeniden uygulanamaz.")
                }
                offline.db.withTransaction {
                    val current=offline.dao.find(sessionScope(auth),row.commandId)
                    check(current?.state=="conflict" && state.value.session?.let(::sessionScope)==sessionScope(auth)) { "İşlem zaten çözüldü." }
                    val next=request.copy(idempotencyKey=UUID.randomUUID().toString(),data=data)
                    offline.dao.enqueue(OutboxRecord(scope=sessionScope(auth),commandId=next.idempotencyKey,kind=next.kind,payload=fieldJson.encodeToString(next),position=row.position))
                    offline.dao.update(row.copy(state="delivered",reason="Yeni işlemle yeniden gönderildi."))
                }
                FieldSyncWorker.schedule(getApplication());sync()
            } catch(e: Exception) { fail(e) }
            finally {mutable.update {it.copy(busy=false)}}
        }
    }
    private fun fail(error: Exception) {
        if(error is CancellationException) throw error
        if(error is ApiException && error.status==426) {mutable.update {it.copy(updateRequired=true,stale=true,error=null)};return}
        if(error is ApiException && error.status==401) { logout();mutable.update {it.copy(error="Oturum sona erdi. Bekleyen kayıtlarınız cihazda korunuyor; yeniden giriş yapın.")} }
        else mutable.update { it.copy(error=if(error is java.io.IOException) "Çevrimdışısınız. İşlemler cihazda saklanıyor." else error.message ?: "İşlem tamamlanamadı.",stale=true,accessBlocked=it.accessBlocked || error is ApiException && error.status==403) }
    }
}
private fun overlayJob(job: WorkOrder,rows: List<OutboxRecord>): WorkOrder {
    var result=job
    for(row in rows) {
        if(row.state !in listOf("pending","sending")) continue
        val request=runCatching { fieldJson.decodeFromString<SyncRequest>(row.payload) }.getOrNull() ?: continue
        if(request.workOrderId!=job.id) continue
        val data=request.data
        result=when(request.kind) {
            "checklist"->result.copy(checklist=result.checklist.map { if(it.id==data["itemId"]?.jsonPrimitive?.content) it.copy(completed=data["completed"]!!.jsonPrimitive.boolean) else it })
            "comment"->result.copy(comments=result.comments+Comment(row.commandId,data["body"]!!.jsonPrimitive.content,"Siz",Instant.ofEpochMilli(row.createdAt).toString()))
            "transition"->result.copy(status=data["status"]!!.jsonPrimitive.content,blockedReasonDetail=data["blockedReasonDetail"]?.jsonPrimitive?.contentOrNull)
            else->result
        }
    }
    return result.copy(checklistCompleted=result.checklist.count {it.completed})
}
private fun overlay(snapshot: Snapshot,row: OutboxRecord): Snapshot {
    if(row.state !in listOf("pending","sending")) return snapshot
    val request=runCatching {fieldJson.decodeFromString<SyncRequest>(row.payload)}.getOrNull() ?: return snapshot
    return snapshot.copy(workOrders=snapshot.workOrders.map {overlayJob(it,listOf(row))},operations=if(request.kind!="operation") snapshot.operations else snapshot.operations.map { op->
        val input=runCatching {fieldJson.decodeFromJsonElement<OperationInput>(request.data)}.getOrNull()
        if(input==null || op.id!=input.operationId || op.version!=input.version) op else {
            val rejected=input.qualityResults.any {it.passed==false}
            val total=op.completedQty+if(input.action=="complete"&&!rejected) (input.quantity?:0) else 0
            val status=when(input.action) {"start"->"running";"pause"->"paused";"note","rework"->op.status;else->if(rejected) "blocked" else if(total>=op.plannedQty) "done" else "paused"}
            if(input.action=="rework") op else op.copy(status=status,completedQty=total,version=op.version+1,activeSince=if(input.action=="note") op.activeSince else if(status=="running") Instant.now().toString() else null)
        }
    })
}
