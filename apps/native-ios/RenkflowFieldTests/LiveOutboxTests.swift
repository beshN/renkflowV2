import XCTest
import SwiftData
@testable import RenkflowField

@MainActor final class LiveOutboxTests: XCTestCase {
    func testPersistedProductionAndInterruptedPhotoReconnectExactlyOnce() async throws {
        let clean=URLSessionConfiguration.ephemeral
        let client=URLSession(configuration:clean,delegate:LoopbackTestTrust(),delegateQueue:nil)
        let (bytes,_)=try await client.data(from:URL(string:"https://127.0.0.1:3043/fixture")!)
        let fixture=try JSONDecoder().decode(Fixture.self,from:bytes),api=FieldAPI(session:client)
        let login=try await api.login(server:"https://127.0.0.1:3043",email:fixture.email,password:fixture.password)
        let auth=Session(server:"https://127.0.0.1:3043",token:login.accessToken,expiresAt:.distantFuture,user:login.user)
        let initial=try await api.snapshot(auth),op=try XCTUnwrap(initial.operations.first {$0.id==fixture.operationId})
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString,isDirectory:true)
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true);defer {try? FileManager.default.removeItem(at:directory)}
        let url=directory.appendingPathComponent("field.store"),scope=sessionScope(auth),photoID=UUID().uuidString
        func open() throws -> OfflineStore {
            let schema=Schema([CachedRecord.self,OutboxRecord.self]),config=ModelConfiguration(schema:Schema([CachedRecord.self,OutboxRecord.self]),url:url,cloudKitDatabase:.none)
            return OfflineStore(container:try ModelContainer(for:schema,configurations:[config]))
        }
        var store=try open()
        try store.enqueue(scope,request:SyncRequest(idempotencyKey:UUID().uuidString,kind:"operation",data:try payload(OperationInput(operationId:op.id,version:op.version,action:"start")),workOrderId:nil),caches:["snapshot":JSONEncoder().encode(initial)])
        let photo=OutboxRecord(id:photoID,sequence:2,scope:scope,kind:"photo",payload:try JSONEncoder().encode(LocalPhoto(workOrderId:fixture.productionJobId,base64:fixture.jpegLarge)))
        store.context.insert(photo);try store.context.save()
        try store.enqueue(scope,request:SyncRequest(idempotencyKey:UUID().uuidString,kind:"operation",data:try payload(OperationInput(operationId:op.id,version:op.version+1,action:"complete",quantity:1,qualityResults:[QualityResult(checkId:"visual",passed:true)],photos:["local://"+photoID])),workOrderId:nil))
        XCTAssertEqual(try store.rows(scope).count,3)
        let real=APIOutboxSender(store:store,api:api,auth:auth);var lost=false
        _ = try await OutboxSync(store:store,send:{row in let value=try await real.send(row);if !lost {lost=true;throw URLError(.networkConnectionLost)};return value}).drain(scope)
        store=try open();try store.prepare();XCTAssertNotNil(try store.cache(scope,key:"snapshot"))
        for row in try store.rows(scope) {row.nextAttempt = .distantPast};try store.context.save()
        InterruptAfterFirstChunk.enabled=true;InterruptAfterFirstChunk.interrupted=false
        let faulty=URLSessionConfiguration.ephemeral;faulty.protocolClasses=[InterruptAfterFirstChunk.self]
        let sender=APIOutboxSender(store:store,api:FieldAPI(session:URLSession(configuration:faulty,delegate:LoopbackTestTrust(),delegateQueue:nil)),auth:auth)
        _ = try await OutboxSync(store:store,send:{try await sender.send($0)}).drain(scope)
        XCTAssertTrue(InterruptAfterFirstChunk.interrupted);XCTAssertEqual(try store.rows(scope).first?.kind,"photo")
        let status=try await api.request(UploadStatus.self,server:auth.server,token:auth.token,path:"uploads/"+photoID);XCTAssertEqual(status.receivedBytes,262144)
        store=try open();try store.prepare();for row in try store.rows(scope) {row.nextAttempt = .distantPast};try store.context.save()
        let restored=APIOutboxSender(store:store,api:api,auth:auth),sync=OutboxSync(store:store,send:{try await restored.send($0)})
        _ = try await sync.drain(scope);_ = try await sync.drain(scope)
        XCTAssertTrue(try store.rows(scope).isEmpty);XCTAssertNotNil(try store.find(scope,id:photoID)?.resultURL)
        let final=try await api.snapshot(auth);XCTAssertEqual(final.operations.first {$0.id==op.id}?.completedQty,op.completedQty+1)
    }
    private struct Fixture:Decodable {let email:String;let password:String;let operationId:String;let productionJobId:String;let jpegLarge:String}
}
// Network fault injection only in the test target. Forwarded requests still reach the real API.
private final class InterruptAfterFirstChunk:URLProtocol {
    static var enabled=false;static var interrupted=false
    private var forwardingTask:URLSessionDataTask?
    private var forwarding:URLSession?
    override class func canInit(with request:URLRequest)->Bool {enabled && request.url?.host=="127.0.0.1" && request.url?.port==3043 && request.url?.path=="/api/mobile/v1/uploads"}
    override class func canonicalRequest(for request:URLRequest)->URLRequest {request}
    override func startLoading() {
        var forwarded=request
        if forwarded.httpBody==nil,let stream=forwarded.httpBodyStream {
            stream.open();defer {stream.close()};var bytes=Data(),buffer=[UInt8](repeating:0,count:8192)
            while stream.hasBytesAvailable {let count=stream.read(&buffer,maxLength:buffer.count);if count<=0 {break};bytes.append(contentsOf:buffer.prefix(count))}
            forwarded.httpBodyStream=nil;forwarded.httpBody=bytes
        }
        let body=forwarded.httpBody.flatMap {try? JSONSerialization.jsonObject(with:$0) as? [String:Any]}
        if body?["action"] as? String=="chunk",(body?["offset"] as? Int ?? 0)>=262144,!Self.interrupted {
            Self.interrupted=true;Self.enabled=false;client?.urlProtocol(self,didFailWithError:URLError(.networkConnectionLost));return
        }
        let config=URLSessionConfiguration.ephemeral;config.protocolClasses=[]
        let session=URLSession(configuration:config,delegate:LoopbackTestTrust(),delegateQueue:nil);forwarding=session
        forwardingTask=session.dataTask(with:forwarded) {[weak self] data,response,error in
            guard let self else {return};if let error {self.client?.urlProtocol(self,didFailWithError:error);return}
            if let response {self.client?.urlProtocol(self,didReceive:response,cacheStoragePolicy:.notAllowed)}
            if let data {self.client?.urlProtocol(self,didLoad:data)};self.client?.urlProtocolDidFinishLoading(self)
        };forwardingTask?.resume()
    }
    override func stopLoading() {forwardingTask?.cancel();forwarding?.invalidateAndCancel()}
}
