import Foundation
import SwiftData
import CryptoKit

func sessionScope(_ auth: Session) -> String {
    SHA256.hash(data: Data("\(auth.server.trimmingCharacters(in: CharacterSet(charactersIn: "/")))|\(auth.user.tenantId)|\(auth.user.id)".utf8)).map { String(format: "%02x", $0) }.joined()
}
@Model final class CachedRecord {
    @Attribute(.unique) var id: String
    var scope: String; var cacheKey: String; var payload: Data; var savedAt: Date
    init(scope: String,key: String,payload: Data) { self.id=scope+":"+key;self.scope=scope;self.cacheKey=key;self.payload=payload;self.savedAt=Date() }
}
@Model final class OutboxRecord {
    @Attribute(.unique) var commandID: String
    var sequence: Int64; var scope: String; var kind: String; var payload: Data
    var state: String; var attempts: Int; var nextAttempt: Date; var reason: String?; var canRetry: Bool; var resultURL: String?; var createdAt: Date
    init(id: String,sequence: Int64,scope: String,kind: String,payload: Data) {
        self.commandID=id;self.sequence=sequence;self.scope=scope;self.kind=kind;self.payload=payload
        self.state="pending";self.attempts=0;self.nextAttempt = .distantPast;self.canRetry=false;self.createdAt=Date()
    }
}
@MainActor final class OfflineStore {
    let container: ModelContainer
    let context: ModelContext
    var draining=false
    private var recovered=false
    private static var shared: OfflineStore?
    static func persistent() throws -> OfflineStore {
        if let shared {return shared}
        let directory=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true).appendingPathComponent("RenkFlowField",isDirectory:true)
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        var url=directory;var resources=URLResourceValues();resources.isExcludedFromBackup=true;try url.setResourceValues(resources)
        try FileManager.default.setAttributes([.protectionKey:FileProtectionType.completeUntilFirstUserAuthentication],ofItemAtPath:directory.path)
        let schema=Schema([CachedRecord.self,OutboxRecord.self])
        let config=ModelConfiguration(schema:schema,url:directory.appendingPathComponent("field.store"),cloudKitDatabase:.none)
        let store=OfflineStore(container:try ModelContainer(for:schema,configurations:[config]));shared=store;return store
    }
    init(container: ModelContainer) {self.container=container;self.context=ModelContext(container);self.context.autosaveEnabled=false}
    func prepare() throws {
        guard !recovered else {return}
        let rows=try context.fetch(FetchDescriptor<OutboxRecord>(predicate:#Predicate {$0.state=="sending"}))
        rows.forEach {$0.state="pending"};try context.save();recovered=true
    }
    func rows(_ scope: String,includeDelivered: Bool=false) throws -> [OutboxRecord] {
        let value=scope
        let descriptor=FetchDescriptor<OutboxRecord>(predicate:#Predicate {$0.scope==value},sortBy:[SortDescriptor(\.sequence)])
        return try context.fetch(descriptor).filter {includeDelivered || $0.state != "delivered"}
    }
    func find(_ scope: String,id: String) throws -> OutboxRecord? {
        let selected=scope,identity=id
        return try context.fetch(FetchDescriptor<OutboxRecord>(predicate:#Predicate {$0.scope==selected && $0.commandID==identity})).first
    }
    func cache(_ scope: String,key: String) throws -> CachedRecord? {
        let identity=scope+":"+key
        return try context.fetch(FetchDescriptor<CachedRecord>(predicate:#Predicate {$0.id==identity})).first
    }
    func setCache(_ scope: String,key: String,data: Data) throws {
        if let old=try cache(scope,key:key) {old.payload=data;old.savedAt=Date()} else {context.insert(CachedRecord(scope:scope,key:key,payload:data))}
    }
    func read<T:Decodable>(_ scope: String,key: String,as type: T.Type) throws -> T? {
        guard let record=try cache(scope,key:key) else {return nil};return try JSONDecoder().decode(type,from:record.payload)
    }
    @discardableResult func enqueue(_ scope: String,request: SyncRequest,caches: [String:Data]=[:]) throws -> OutboxRecord {
        let identity=request.idempotencyKey
        if let global=try context.fetch(FetchDescriptor<OutboxRecord>(predicate:#Predicate {$0.commandID==identity})).first,global.scope != scope {throw FieldAPIError(status:0,message:L("text_yerel_islem_kimligi_baska_hesaba_ait_1c761"))}
        let bytes=try JSONEncoder().encode(request)
        if let existing=try find(scope,id:request.idempotencyKey) {
            let old=try JSONDecoder().decode(SyncRequest.self,from:existing.payload)
            let encoder=JSONEncoder();encoder.outputFormatting = .sortedKeys
            guard try encoder.encode(old)==encoder.encode(request) else {throw FieldAPIError(status:0,message:L("text_yerel_islem_kimligi_cakisti_d4e59"))};return existing
        }
        var descriptor=FetchDescriptor<OutboxRecord>(sortBy:[SortDescriptor(\.sequence,order:.reverse)]);descriptor.fetchLimit=1
        let sequence=(try context.fetch(descriptor).first?.sequence ?? 0)+1
        let row=OutboxRecord(id:request.idempotencyKey,sequence:sequence,scope:scope,kind:request.kind,payload:bytes)
        try context.transaction {context.insert(row);for (key,value) in caches {try setCache(scope,key:key,data:value)};try context.save()}
        return row
    }
    @discardableResult func photo(_ scope: String,value: LocalPhoto) throws -> OutboxRecord {
        var descriptor=FetchDescriptor<OutboxRecord>(sortBy:[SortDescriptor(\.sequence,order:.reverse)]);descriptor.fetchLimit=1
        let sequence=(try context.fetch(descriptor).first?.sequence ?? 0)+1
        let row=OutboxRecord(id:UUID().uuidString,sequence:sequence,scope:scope,kind:"photo",payload:try JSONEncoder().encode(value))
        context.insert(row);try context.save();return row
    }
    func rebase(_ scope: String,row: OutboxRecord,request: SyncRequest) throws {
        guard row.state=="conflict" && row.canRetry && row.scope==scope else {throw FieldAPIError(status:0,message:L("text_islem_zaten_cozuldu_5c198"))}
        let next=OutboxRecord(id:request.idempotencyKey,sequence:row.sequence,scope:scope,kind:request.kind,payload:try JSONEncoder().encode(request))
        try context.transaction {context.insert(next);row.state="delivered";row.reason=L("text_yeni_islemle_yeniden_gonderildi_c3082");try context.save()}
    }
    func migrate(_ auth: Session,legacy: ProductionCommand?) throws {
        if let legacy {try enqueue(sessionScope(auth),request:SyncRequest(idempotencyKey:legacy.commandId,kind:"operation",data:try payload(legacy.data),workOrderId:nil))}
    }
}
