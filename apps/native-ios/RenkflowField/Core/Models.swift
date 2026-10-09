import Foundation

struct FieldUser: Codable, Equatable { var id: String; var email: String; var name: String?; var role: String; var tenantId: String }
struct Session: Codable { var server: String; var token: String; var expiresAt: Date; var user: FieldUser }
struct LoginResult: Codable { var user: FieldUser; var accessToken: String; var expiresIn: Double }
struct FieldPermissions: Codable { var transition: Bool; var close: Bool; var checklist: Bool; var comment: Bool }
struct Snapshot: Codable { var workOrders: [WorkOrder]; var operations: [ProductionOperation]; var generatedAt: String; var truncated: Bool; var permissions: FieldPermissions; var cutPlans: [CutPlan]? }
struct FieldColorInfo: Codable { var label: String; var code: String; var name: String; var hex: String?; var finish: String?; var finishAssumed: Bool; var standIn: Bool; var kind: String }
struct WorkOrder: Codable, Identifiable {
    var id: String; var title: String; var status: String; var priority: String; var category: String
    var updatedAt: String?; var color: FieldColorInfo?
    var description: String?; var location: String?; var dueAt: String?; var assigneeName: String?; var blockedReasonDetail: String?
    var checklistTotal: Int; var checklistCompleted: Int
    var productionManaged: Bool?; var checklist: [ChecklistItem]?; var comments: [FieldComment]?
}
struct ChecklistItem: Codable, Identifiable { var id: String; var title: String; var required: Bool; var completed: Bool }
struct FieldComment: Codable, Identifiable { var id: String; var body: String; var authorName: String?; var createdAt: String }
struct QualityCheck: Codable, Identifiable { var id: String; var name: String; var kind: String; var unit: String; var minimum: Double?; var maximum: Double? }
struct QualityResult: Codable { var checkId: String; var passed: Bool? = nil; var value: Double? = nil }
struct ProductionOperation: Codable, Identifiable {
    var id: String; var workOrderId: String; var name: String; var position: Int; var workCenterCode: String
    var status: String; var version: Int; var plannedQty: Double; var completedQty: Double
    var activeSeconds: Double; var activeSince: String?; var assignedTo: String?; var operatorName: String?; var reason: String?; var qualityChecks: [QualityCheck]
}
struct OperationInput: Codable {
    var operationId: String; var version: Int; var action: String
    var quantity: Int? = nil; var reason: String? = nil
    var qualityResults: [QualityResult] = []; var photos: [String] = []
    var reasonCode:String? = nil;var targetOperationId:String? = nil;var rootCause:String? = nil
}
struct ProductionCommand: Codable { var commandId: String; var action: String; var data: OperationInput }
struct Accepted: Codable { var accepted: Bool; var qualityRejected: Bool? }
struct ScanResult: Codable { var kind: String; var id: String; var title: String; var workOrderId: String?; var subtitle: String?; var quantity: Double?; var uom: String?; var code: String? }
struct PhotoInput: Codable { var name = "saha.jpg"; var mime = "image/jpeg"; var base64: String; var workOrderId: String }
struct PhotoResult: Codable { var url: String }
struct LoginInput: Codable { var email: String; var password: String }
struct ChecklistInput: Codable { var completed: Bool }
struct CommentInput: Codable { var body: String }
struct TransitionInput: Codable { var status: String; var blockedReasonCategory: String? = nil; var blockedReasonDetail: String? = nil }

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

struct CutPiece: Codable { var lengthMm: Double; var workOrderId: String }
struct CutBar: Codable, Identifiable { var id: String; var itemId: String; var color: String; var lengthMm: Double; var isRemnant: Bool; var pieces: [CutPiece]; var remainingMm: Double; var reusable: Bool; var lossMm: Double }
struct CutPlan: Codable, Identifiable { var id: String; var status: String; var wastePercent: Double?; var bars: [CutBar] }
struct LocalPhoto: Codable { var workOrderId: String; var base64: String; var name: String = "saha.jpg" }
struct UploadStatus: Decodable { var uploadId: String; var receivedBytes: Int; var totalBytes: Int; var chunkBytes: Int; var completed: Bool; var url: String? }
struct SyncRequest: Codable { var idempotencyKey: String; var kind: String; var data: [String: JSONValue]; var workOrderId: String? }
enum JSONValue: Codable {
    case string(String), number(Double), bool(Bool), object([String:JSONValue]), array([JSONValue]), null
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([String:JSONValue].self) { self = .object(v) }
        else { self = .array(try c.decode([JSONValue].self)) }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self { case .string(let v): try c.encode(v); case .number(let v): try c.encode(v); case .bool(let v): try c.encode(v); case .object(let v): try c.encode(v); case .array(let v): try c.encode(v); case .null: try c.encodeNil() }
    }
    var text: String? { if case .string(let value) = self { return value }; return nil }
    var flag: Bool? { if case .bool(let value) = self { return value }; return nil }
}
func payload<T: Encodable>(_ value: T) throws -> [String:JSONValue] { try JSONDecoder().decode([String:JSONValue].self,from:JSONEncoder().encode(value)) }

struct ReasonCode:Codable {var kind:String;var code:String;var label:String}
struct FieldCapabilities:Codable {var reasonCodes:Bool;var installations:Bool;var remotePush:Bool;var crashReporting:Bool}
struct FieldReferences:Codable {var reasons:[ReasonCode];var capabilities:FieldCapabilities}
