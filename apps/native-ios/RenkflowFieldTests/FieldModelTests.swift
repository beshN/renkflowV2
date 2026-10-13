import XCTest
import SwiftData
@testable import RenkflowField
@MainActor final class FieldModelTests:XCTestCase {
    func testSequentialInstallationOverlaySurvivesRepeatedRestoration() throws {
        let base=InstallationDetails(id:"i",status:"planned",version:1,checklist:[],issues:[])
        func row(_ action:String,_ version:Int,kind:String?=nil,text:String?=nil) throws -> OutboxRecord {
            var data:[String:JSONValue]=["action":.string(action),"expectedVersion":.number(Double(version))]
            if let kind {data["kind"] = .string(kind)};if let text {data["text"] = .string(text)}
            let request=SyncRequest(idempotencyKey:"id-\(version)",kind:"installation",data:data,workOrderId:nil,installationId:"i")
            return OutboxRecord(id:request.idempotencyKey,sequence:Int64(version),scope:"scope",kind:"installation",payload:try JSONEncoder().encode(request))
        }
        let rows=try [row("start",1),row("issue",2,kind:"damage",text:"Paint scratched")],result=overlayInstallation(base,rows:rows)
        XCTAssertEqual(result.status,"in_progress");XCTAssertEqual(result.version,3);XCTAssertEqual(result.issues.count,1)
        XCTAssertEqual(overlayInstallation(result,rows:rows).issues.count,1)
        rows.forEach {$0.state="conflict"};XCTAssertEqual(overlayInstallation(base,rows:rows).version,1)
    }
    func testLegacyPhotoSchemaAndInstallationTarget() throws {
        let old=try JSONDecoder().decode(LocalPhoto.self,from:Data(#"{"workOrderId":"job","base64":"/9g="}"#.utf8))
        XCTAssertEqual(old.workOrderId,"job");XCTAssertNil(old.installationId)
        let photo=LocalPhoto(base64:"/9g=",installationId:"i"),data=try JSONSerialization.jsonObject(with:JSONEncoder().encode(photo)) as! [String:Any]
        XCTAssertNil(data["workOrderId"]);XCTAssertEqual(data["installationId"] as? String,"i")
    }
}

private final class ReapplyProtocol: URLProtocol {
    static var started: (() -> Void)?
    static var pending: ReapplyProtocol?
    override class func canInit(with request: URLRequest) -> Bool {true}
    override class func canonicalRequest(for request: URLRequest) -> URLRequest {request}
    override func startLoading() {Self.pending=self;Self.started?()}
    override func stopLoading() {}
    func respond(status:Int,body:Data) {
        let response=HTTPURLResponse(url:request.url!,statusCode:status,httpVersion:nil,headerFields:["Content-Type":"application/json"])!
        client?.urlProtocol(self,didReceive:response,cacheStoragePolicy:.notAllowed)
        client?.urlProtocol(self,didLoad:body);client?.urlProtocolDidFinishLoading(self)
    }
    func unauthorized() {respond(status:401,body:Data("{\"error\":\"Expired previous account\"}".utf8))}
}
@MainActor final class ReapplyIsolationTests: XCTestCase {
    func testPreviousAccountFailureCannotClearTheNewAccountOrItsBusyState() async throws {
        SecureVault().clear();defer {SecureVault().clear();ReapplyProtocol.pending=nil;ReapplyProtocol.started=nil}
        let schema=Schema([CachedRecord.self,OutboxRecord.self])
        let offline=OfflineStore(container:try ModelContainer(for:schema,configurations:[ModelConfiguration(schema:schema,isStoredInMemoryOnly:true,cloudKitDatabase:.none)]))
        let config=URLSessionConfiguration.ephemeral;config.protocolClasses=[ReapplyProtocol.self]
        let store=FieldStore(offline:offline,api:FieldAPI(session:URLSession(configuration:config)))
        let first=Session(server:"https://renkflow.com",token:"first-token",expiresAt:.distantFuture,user:FieldUser(id:"first",email:"first@example.invalid",role:"worker",tenantId:"t1"))
        let next=Session(server:"https://renkflow.com",token:"next-token",expiresAt:.distantFuture,user:FieldUser(id:"next",email:"next@example.invalid",role:"worker",tenantId:"t2"))
        store.session=first
        let request=SyncRequest(idempotencyKey:UUID().uuidString,kind:"operation",data:["operationId":.string(UUID().uuidString),"version":.number(1),"action":.string("start")])
        let row=try offline.enqueue(sessionScope(first),request:request);row.state="conflict";row.canRetry=true;try offline.context.save()
        let started=expectation(description:"Old account request suspended")
        ReapplyProtocol.started={started.fulfill()}
        let task=Task {await store.reapply(row)}
        await fulfillment(of:[started],timeout:3)
        store.logout();store.session=next;store.busy=true
        try XCTUnwrap(ReapplyProtocol.pending).unauthorized()
        await task.value
        XCTAssertEqual(store.session?.user.id,next.user.id)
        XCTAssertTrue(store.busy);XCTAssertNil(store.error)
        XCTAssertEqual(row.state,"conflict")
    }
    func testOldScanResponseCannotAppearInTheNewAccount() async throws {
        SecureVault().clear();defer {ReapplyProtocol.pending=nil;ReapplyProtocol.started=nil}
        let schema=Schema([CachedRecord.self,OutboxRecord.self])
        let offline=OfflineStore(container:try ModelContainer(for:schema,configurations:[ModelConfiguration(schema:schema,isStoredInMemoryOnly:true,cloudKitDatabase:.none)]))
        let config=URLSessionConfiguration.ephemeral;config.protocolClasses=[ReapplyProtocol.self]
        let store=FieldStore(offline:offline,api:FieldAPI(session:URLSession(configuration:config)))
        let first=Session(server:"https://renkflow.com",token:"first",expiresAt:.distantFuture,user:FieldUser(id:"first",email:"first@test.invalid",role:"worker",tenantId:"t1"))
        let next=Session(server:"https://renkflow.com",token:"next",expiresAt:.distantFuture,user:FieldUser(id:"next",email:"next@test.invalid",role:"worker",tenantId:"t2"))
        store.session=first
        let started=expectation(description:"Old account scan suspended");ReapplyProtocol.started={started.fulfill()}
        let task=Task {await store.scan("old-job-label")}
        await fulfillment(of:[started],timeout:3);store.logout();store.session=next
        let result=ScanResult(kind:"job",id:"old-record",title:"Old company record",workOrderId:"old-job")
        let value=try JSONSerialization.jsonObject(with:JSONEncoder().encode(result)),body=try JSONSerialization.data(withJSONObject:["data":value])
        try XCTUnwrap(ReapplyProtocol.pending).respond(status:200,body:body);await task.value
        XCTAssertNil(store.scanResult);XCTAssertEqual(store.session?.user.id,next.user.id)
    }
    func testDelayedOldAccountPhotoCannotEnterTheNewAccountsQueue() async throws {
        let schema=Schema([CachedRecord.self,OutboxRecord.self])
        let offline=OfflineStore(container:try ModelContainer(for:schema,configurations:[ModelConfiguration(schema:schema,isStoredInMemoryOnly:true,cloudKitDatabase:.none)]))
        let store=FieldStore(offline:offline)
        let first=Session(server:"https://renkflow.com",token:"first",expiresAt:.distantFuture,user:FieldUser(id:"first",email:"first@test.invalid",role:"worker",tenantId:"t1"))
        let next=Session(server:"https://renkflow.com",token:"next",expiresAt:.distantFuture,user:FieldUser(id:"next",email:"next@test.invalid",role:"worker",tenantId:"t2"))
        store.session=next;store.snapshot=Snapshot(workOrders:[],operations:[],generatedAt:"2026-10-13T12:00:00Z",truncated:false,permissions:FieldPermissions(transition:true,close:false,checklist:true,comment:true))
        XCTAssertTrue(store.writable)
        let result=await store.uploadPhoto(jobID:UUID().uuidString,bytes:Data([1,2,3]),expectedScope:sessionScope(first))
        XCTAssertNil(result);XCTAssertTrue(try offline.rows(sessionScope(next)).isEmpty)
    }

}
