package com.renkflow.field.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

@Serializable data class User(val id: String, val email: String, val name: String? = null, val role: String, val tenantId: String)
@Serializable data class Session(val server: String, val token: String, val expiresAt: Long, val user: User)
@Serializable data class LoginResult(val user: User, val accessToken: String, val expiresIn: Long)
@Serializable data class Permissions(val transition: Boolean, val close: Boolean, val checklist: Boolean, val comment: Boolean)
@Serializable data class Snapshot(val workOrders: List<WorkOrder>, val operations: List<Operation>, val generatedAt: String, val truncated: Boolean, val permissions: Permissions, val cutPlans: List<CutPlan> = emptyList())
@Serializable data class FieldColorInfo(val label: String, val code: String, val name: String, val hex: String? = null, val finish: String? = null, val finishAssumed: Boolean = false, val standIn: Boolean = false, val kind: String)
@Serializable data class WorkOrder(
    val id: String, val title: String, val status: String, val priority: String,
    val color: FieldColorInfo? = null,val productFamily:String?=null, val updatedAt: String? = null, val category: String = "general", val description: String? = null, val location: String? = null,
    val dueAt: String? = null, val assigneeName: String? = null, val blockedReasonDetail: String? = null,
    val checklistTotal: Int = 0, val checklistCompleted: Int = 0,
    val productionManaged: Boolean = false, val checklist: List<ChecklistItem> = emptyList(), val comments: List<Comment> = emptyList()
)
@Serializable data class ChecklistItem(val id: String, val title: String, val required: Boolean, val completed: Boolean)
@Serializable data class Comment(val id: String, val body: String, val authorName: String? = null, val createdAt: String)
@Serializable data class QualityCheck(val id: String, val name: String, val kind: String, val unit: String = "", val minimum: Double? = null, val maximum: Double? = null)
@Serializable data class QualityResult(val checkId: String, val passed: Boolean? = null, val value: Double? = null)
@Serializable data class Operation(
    val id: String, val workOrderId: String, val name: String, val position: Int, val workCenterCode: String,
    val status: String, val version: Int, val plannedQty: Double, val completedQty: Double,
    val activeSeconds: Double, val activeSince: String? = null, val assignedTo: String? = null,
    val operatorName: String? = null, val reason: String? = null, val qualityChecks: List<QualityCheck> = emptyList()
)
@Serializable data class OperationInput(
    val operationId: String, val version: Int, val action: String,
    val quantity: Int? = null, val reason: String? = null,
    val qualityResults: List<QualityResult> = emptyList(), val photos: List<String> = emptyList(),
    val reasonCode:String?=null,val targetOperationId:String?=null,val rootCause:String?=null
)
@Serializable data class Command(val commandId: String, val action: String = "operation", val data: OperationInput)
@Serializable data class Accepted(val accepted: Boolean, val qualityRejected: Boolean = false)
@Serializable data class ScanResult(val kind: String, val id: String, val title: String, val workOrderId: String? = null, val subtitle: String? = null, val quantity: Double? = null, val uom: String? = null, val code: String? = null)
@Serializable data class PhotoInput(val name: String = "saha.jpg", val mime: String = "image/jpeg", val base64: String, val workOrderId: String)
@Serializable data class PhotoResult(val url: String)

fun statusLabel(status: String) = when (status) {
    "open" -> "Açık"; "in_progress", "running" -> "Çalışıyor"; "blocked" -> "Bloke"
    "done" -> "Tamamlandı"; "cancelled" -> "İptal"; "ready" -> "Hazır"; "waiting" -> "Bekliyor"; "paused" -> "Duraklatıldı"
    else -> status
}
fun priorityLabel(priority: String) = when (priority) { "critical" -> "Kritik"; "high" -> "Yüksek"; "low" -> "Düşük"; else -> "Normal" }

@Serializable data class CutPiece(val lengthMm: Double, val workOrderId: String)
@Serializable data class CutBar(val id: String, val itemId: String, val color: String, val lengthMm: Double, val isRemnant: Boolean, val pieces: List<CutPiece>, val remainingMm: Double, val reusable: Boolean, val lossMm: Double)
@Serializable data class CutPlan(val id: String, val status: String, val wastePercent: Double? = null, val bars: List<CutBar>)
@Serializable data class SyncRequest(val idempotencyKey: String, val kind: String, val data: kotlinx.serialization.json.JsonObject, val workOrderId: String? = null,val installationId:String?=null)
@Serializable data class LocalPhoto(val workOrderId: String?=null, val base64: String, val name: String = "saha.jpg",val installationId:String?=null)
@Serializable data class UploadStatus(val uploadId: String, val receivedBytes: Int, val totalBytes: Int, val chunkBytes: Int, val completed: Boolean, val url: String? = null)

@Serializable data class ReasonCode(val kind:String,val code:String,val label:String)
@Serializable data class FieldCapabilities(val reasonCodes:Boolean=false,val installations:Boolean=false,val remotePush:Boolean=false,val crashReporting:Boolean=false,val installationEdit:Boolean=false,val productionView:Boolean=true)
@Serializable data class FieldReferences(val reasons:List<ReasonCode> = emptyList(),val capabilities:FieldCapabilities=FieldCapabilities())

@Serializable data class Installation(val id:String,val number:String,val date:String?=null,val startTime:String?=null,val productName:String?=null,val status:String,val version:Int,val signed:Boolean,val checklistTotal:Int,val checklistCompleted:Int)
@Serializable data class InstallationList(val available:Boolean,val installations:List<Installation> = emptyList())
@Serializable data class InstallationCheck(val id:String,val title:String,val completed:Boolean)
@Serializable data class InstallationIssue(val kind:String,val text:String)
@Serializable data class InstallationDetails(val id:String,val status:String,val version:Int,val checklist:List<InstallationCheck>,val issues:List<InstallationIssue>,val photos:List<InstallationPhoto> = emptyList())
fun overlayInstallation(detail:InstallationDetails,rows:List<OutboxRecord>):InstallationDetails {
    var result=detail
    for(row in rows) {
        if(row.kind!="installation" || row.state !in listOf("pending","sending")) continue
        val request=runCatching {fieldJson.decodeFromString<SyncRequest>(row.payload)}.getOrNull() ?: continue
        val d=request.data
        if(request.installationId!=result.id || d["expectedVersion"]?.jsonPrimitive?.intOrNull!=result.version) continue
        result=when(d["action"]?.jsonPrimitive?.content) {
            "start"->result.copy(status="in_progress")
            "complete"->result.copy(status="done")
            "checklist"->result.copy(checklist=result.checklist.map {if(it.id==d["itemId"]?.jsonPrimitive?.content) it.copy(completed=d["completed"]?.jsonPrimitive?.boolean==true) else it})
            "issue"->result.copy(issues=result.issues+InstallationIssue(d["kind"]?.jsonPrimitive?.content.orEmpty(),d["text"]?.jsonPrimitive?.content.orEmpty()))
            else->result
        }.copy(version=result.version+1)
    }
    return result
}

@Serializable data class InstallationPhoto(val id:String,val url:String)
