import XCTest
import SwiftData
@testable import RenkflowField

@MainActor final class OfflineStoreTests: XCTestCase {
    private func store(_ url: URL?=nil) throws -> OfflineStore {
        let schema=Schema([CachedRecord.self,OutboxRecord.self])
        let config=url.map {ModelConfiguration(schema:schema,url:$0,cloudKitDatabase:.none)} ?? ModelConfiguration(schema:schema,isStoredInMemoryOnly:true,cloudKitDatabase:.none)
        return OfflineStore(container:try ModelContainer(for:schema,configurations:[config]))
    }
    private func request() -> SyncRequest {SyncRequest(idempotencyKey:UUID().uuidString,kind:"comment",data:["body":.string("Offline note")],workOrderId:UUID().uuidString)}
    func testRestartRetainsQueueCacheAndAccountScope() throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString,isDirectory:true)
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true);defer {try? FileManager.default.removeItem(at:directory)}
        let url=directory.appendingPathComponent("field.store"),value=request()
        var db=try store(url);try db.enqueue("scope-A",request:value,caches:["snapshot":Data("{}".utf8)])
        db=try store(url);try db.prepare()
        XCTAssertEqual(try db.rows("scope-A").first?.commandID,value.idempotencyKey);XCTAssertNotNil(try db.cache("scope-A",key:"snapshot"));XCTAssertNil(try db.cache("scope-B",key:"snapshot"));XCTAssertTrue(try db.rows("scope-B").isEmpty)
    }
    func testOfflineReconnectAndRepeatedDrainDeliverOnce() async throws {
        let db=try store(),value=request();try db.enqueue("scope",request:value)
        _ = try await OutboxSync(store:db,send:{_ in throw URLError(.notConnectedToInternet)}).drain("scope")
        let row=try XCTUnwrap(db.rows("scope").first);XCTAssertEqual(row.attempts,1);XCTAssertEqual(row.state,"pending");row.nextAttempt = .distantPast;try db.context.save()
        var sends=0;let sync=OutboxSync(store:db,send:{_ in sends+=1;return nil})
        _ = try await sync.drain("scope");_ = try await sync.drain("scope")
        XCTAssertEqual(sends,1);XCTAssertTrue(try db.rows("scope").isEmpty);XCTAssertEqual(try db.find("scope",id:value.idempotencyKey)?.state,"delivered")
    }
    func testSendingRecoveryPreservesOriginalUUID() throws {
        let db=try store(),value=request();let row=try db.enqueue("scope",request:value);row.state="sending";try db.context.save();try db.prepare()
        XCTAssertEqual(try db.rows("scope").first?.state,"pending");XCTAssertEqual(try db.rows("scope").first?.commandID,value.idempotencyKey)
    }
    func testDuplicateLegacyMigrationKeepsOneIdentity() throws {
        let db=try store(),auth=Session(server:"https://renkflow.com",token:"test",expiresAt:.distantFuture,user:FieldUser(id:"u",email:"test@example.invalid",name:nil,role:"worker",tenantId:"t"))
        let legacy=ProductionCommand(commandId:UUID().uuidString,action:"operation",data:OperationInput(operationId:UUID().uuidString,version:1,action:"start"))
        try db.migrate(auth,legacy:legacy);try db.migrate(auth,legacy:legacy)
        XCTAssertEqual(try db.rows(sessionScope(auth)).count,1);XCTAssertEqual(try db.rows(sessionScope(auth)).first?.commandID,legacy.commandId)
    }
    func testCorruptPartialQueueIsPreservedAndQuarantined() async throws {
        let db=try store(),row=OutboxRecord(id:UUID().uuidString,sequence:1,scope:"scope",kind:"comment",payload:Data("{broken".utf8));db.context.insert(row);try db.context.save()
        var sends=0;_ = try await OutboxSync(store:db,send:{_ in sends+=1;return nil}).drain("scope")
        XCTAssertEqual(sends,0);XCTAssertEqual(row.state,"corrupt");XCTAssertEqual(row.payload,Data("{broken".utf8))
    }
    func testConflictIsNotSilentlyOverwrittenOrReplayed() async throws {
        let db=try store();try db.enqueue("scope",request:request());var sends=0
        let sync=OutboxSync(store:db,send:{_ in sends+=1;throw FieldAPIError(status:409,message:"changed",canRetry:true)})
        _ = try await sync.drain("scope");_ = try await sync.drain("scope")
        XCTAssertEqual(sends,1);XCTAssertEqual(try db.rows("scope").first?.state,"conflict");XCTAssertEqual(try db.rows("scope").first?.canRetry,true)
    }
    func testReassignedWriteCannotForceReplay() async throws {
        let db=try store();try db.enqueue("scope",request:request())
        _ = try await OutboxSync(store:db,send:{_ in throw FieldAPIError(status:404,message:"reassigned")}).drain("scope")
        XCTAssertEqual(try db.rows("scope").first?.state,"blocked");XCTAssertEqual(try db.rows("scope").first?.canRetry,false)
    }
    func testRebaseKeepsNewUUIDAheadOfDependentCommands() throws {
        let db=try store(),old=try db.enqueue("scope",request:request());old.state="conflict";old.canRetry=true;try db.context.save()
        let dependent=try db.enqueue("scope",request:request()),replacement=request()
        try db.rebase("scope",row:old,request:replacement)
        XCTAssertEqual(try db.rows("scope").map(\.commandID),[replacement.idempotencyKey,dependent.commandID]);XCTAssertNotEqual(old.commandID,replacement.idempotencyKey)
    }
    func testDuplicateUUIDCannotReplaceAnotherAccountsQueue() throws {
        let db=try store(),value=request();try db.enqueue("scope-A",request:value)
        XCTAssertThrowsError(try db.enqueue("scope-B",request:value));XCTAssertEqual(try db.rows("scope-A").count,1);XCTAssertTrue(try db.rows("scope-B").isEmpty)
    }
    func testBoundedBackoffAndScopeIgnoreRotatedTokens() {
        XCTAssertEqual(retryDelay(0),15);XCTAssertEqual(retryDelay(1),30);XCTAssertLessThanOrEqual(retryDelay(100),3600)
        let auth=Session(server:"https://renkflow.com",token:"secret",expiresAt:.distantFuture,user:FieldUser(id:"u",email:"test@example.invalid",name:nil,role:"worker",tenantId:"t"))
        var rotated=auth;rotated.token="rotated";XCTAssertEqual(sessionScope(auth),sessionScope(rotated));rotated.user.tenantId="other";XCTAssertNotEqual(sessionScope(auth),sessionScope(rotated))
    }
}
