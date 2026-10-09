package com.renkflow.field.data

import kotlinx.serialization.Serializable

@Serializable data class User(val id: String, val email: String, val name: String? = null, val role: String, val tenantId: String)
@Serializable data class Session(val server: String, val token: String, val expiresAt: Long, val user: User)
@Serializable data class LoginResult(val user: User, val accessToken: String, val expiresIn: Long)
@Serializable data class Permissions(val transition: Boolean, val close: Boolean, val checklist: Boolean, val comment: Boolean)
@Serializable data class Snapshot(val workOrders: List<WorkOrder>, val operations: List<Operation>, val generatedAt: String, val truncated: Boolean, val permissions: Permissions)
@Serializable data class WorkOrder(
    val id: String, val title: String, val status: String, val priority: String,
    val category: String = "general", val description: String? = null, val location: String? = null,
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
    val qualityResults: List<QualityResult> = emptyList(), val photos: List<String> = emptyList()
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
