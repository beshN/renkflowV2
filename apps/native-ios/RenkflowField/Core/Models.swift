import Foundation

struct FieldUser: Codable, Equatable { let id: String; let email: String; let name: String?; let role: String; let tenantId: String }
struct Session: Codable { let server: String; let token: String; let expiresAt: Date; var user: FieldUser }
struct LoginResult: Decodable { let user: FieldUser; let accessToken: String; let expiresIn: Double }
struct FieldPermissions: Decodable { let transition: Bool; let close: Bool; let checklist: Bool; let comment: Bool }
struct Snapshot: Decodable { let workOrders: [WorkOrder]; let operations: [ProductionOperation]; let generatedAt: String; let truncated: Bool; let permissions: FieldPermissions }
struct WorkOrder: Decodable, Identifiable {
    let id: String; let title: String; let status: String; let priority: String; let category: String
    let description: String?; let location: String?; let dueAt: String?; let assigneeName: String?; let blockedReasonDetail: String?
    let checklistTotal: Int; let checklistCompleted: Int
    let productionManaged: Bool?; let checklist: [ChecklistItem]?; let comments: [FieldComment]?
}
struct ChecklistItem: Decodable, Identifiable { let id: String; let title: String; let required: Bool; let completed: Bool }
struct FieldComment: Decodable, Identifiable { let id: String; let body: String; let authorName: String?; let createdAt: String }
struct QualityCheck: Decodable, Identifiable { let id: String; let name: String; let kind: String; let unit: String; let minimum: Double?; let maximum: Double? }
struct QualityResult: Codable { let checkId: String; var passed: Bool? = nil; var value: Double? = nil }
struct ProductionOperation: Decodable, Identifiable {
    let id: String; let workOrderId: String; let name: String; let position: Int; let workCenterCode: String
    let status: String; let version: Int; let plannedQty: Double; let completedQty: Double
    let activeSeconds: Double; let activeSince: String?; let assignedTo: String?; let operatorName: String?; let reason: String?; let qualityChecks: [QualityCheck]
}
struct OperationInput: Codable {
    let operationId: String; let version: Int; let action: String
    var quantity: Int? = nil; var reason: String? = nil
    var qualityResults: [QualityResult] = []; var photos: [String] = []
}
struct ProductionCommand: Codable { let commandId: String; let action: String; let data: OperationInput }
struct Accepted: Decodable { let accepted: Bool; let qualityRejected: Bool? }
struct ScanResult: Decodable { let kind: String; let id: String; let title: String; let workOrderId: String?; let subtitle: String?; let quantity: Double?; let uom: String?; let code: String? }
struct PhotoInput: Encodable { let name = "saha.jpg"; let mime = "image/jpeg"; let base64: String; let workOrderId: String }
struct PhotoResult: Decodable { let url: String }
struct LoginInput: Encodable { let email: String; let password: String }
struct ChecklistInput: Encodable { let completed: Bool }
struct CommentInput: Encodable { let body: String }
struct TransitionInput: Encodable { let status: String; var blockedReasonCategory: String? = nil; var blockedReasonDetail: String? = nil }

func statusLabel(_ value: String) -> String {
    ["open": "Açık", "in_progress": "Çalışıyor", "running": "Çalışıyor", "blocked": "Bloke", "done": "Tamamlandı", "cancelled": "İptal", "ready": "Hazır", "waiting": "Bekliyor", "paused": "Duraklatıldı"][value] ?? value
}
func priorityLabel(_ value: String) -> String { ["critical": "Kritik", "high": "Yüksek", "low": "Düşük", "medium": "Normal"][value] ?? value }
func quantity(_ number: Double) -> String { number.formatted(.number.precision(.fractionLength(0...2)).locale(Locale(identifier: "tr_TR"))) }
func displayDate(_ string: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = formatter.date(from: string) ?? ISO8601DateFormatter().date(from: string)
    guard let date else { return String(string.prefix(10)) }
    let output = DateFormatter(); output.locale = Locale(identifier: "tr_TR"); output.dateFormat = "d MMM, HH:mm"
    return output.string(from: date)
}
