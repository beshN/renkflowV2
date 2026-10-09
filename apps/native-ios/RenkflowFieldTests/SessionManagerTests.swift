import XCTest
@testable import RenkflowField
private final class SessionProtocol:URLProtocol {
    static var handler:((URLRequest)->Data)?
    override class func canInit(with request:URLRequest)->Bool {true}
    override class func canonicalRequest(for request:URLRequest)->URLRequest {request}
    override func startLoading() {
        let bytes=Self.handler?(request) ?? Data()
        client?.urlProtocol(self,didReceive:HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:["Content-Type":"application/json"])!,cacheStoragePolicy:.notAllowed)
        client?.urlProtocol(self,didLoad:bytes);client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
@MainActor final class SessionManagerTests:XCTestCase {
    private let vault=SecureVault()
    private func token(_ id:String)->String {let bytes=Data("{\"sid\":\"\(id)\"}".utf8).base64EncodedString().replacingOccurrences(of:"=",with:"").replacingOccurrences(of:"+",with:"-").replacingOccurrences(of:"/",with:"_");return "a."+bytes+".c"}
    override func tearDown() {vault.clear();SessionProtocol.handler=nil;super.tearDown()}
    func testRotationSavesRequestBeforeNetworkAndNewRefreshAfterAck() async throws {
        let user=FieldUser(id:"u",email:"worker@test.invalid",role:"worker",tenantId:"t")
        let saved=Session(server:"https://renkflow.com",token:token("sid"),expiresAt:.distantPast,user:user,refreshToken:"old",sessionId:"sid",deviceId:"device")
        try vault.save("session",value:saved)
        var capturedBody:Data?
        let response=LoginResult(user:user,accessToken:token("sid"),expiresIn:900,refreshToken:"new",sessionId:"sid",deviceId:"device")
        let json=try JSONSerialization.jsonObject(with:JSONEncoder().encode(response)),bytes=try JSONSerialization.data(withJSONObject:["data":json])
        SessionProtocol.handler={request in
            if let body=request.httpBody {capturedBody=body}
            else if let stream=request.httpBodyStream {
                stream.open();defer {stream.close()};var body=Data(),buffer=[UInt8](repeating:0,count:4096)
                while stream.hasBytesAvailable {let count=stream.read(&buffer,maxLength:buffer.count);if count<=0 {break};body.append(buffer,count:count)}
                capturedBody=body
            }
            return bytes
        }
        let config=URLSessionConfiguration.ephemeral;config.protocolClasses=[SessionProtocol.self]
        let manager=SessionManager(vault:vault,api:FieldAPI(session:URLSession(configuration:config)))
        let result=try await manager.token(server:saved.server,requested:saved.token)
        XCTAssertEqual(result,response.accessToken);XCTAssertEqual(vault.read("session",as:Session.self)?.refreshToken,"new");XCTAssertNil(vault.read("session",as:Session.self)?.refreshRequestId)
        let requestBody=try XCTUnwrap(capturedBody)
        let body=try JSONSerialization.jsonObject(with:requestBody) as! [String:String];XCTAssertNotNil(UUID(uuidString:body["requestId"]!));XCTAssertEqual(body["refreshToken"],"old")
    }
    func testPreviousAccountCannotBorrowCurrentCredentials() async throws {
        let saved=Session(server:"https://renkflow.com",token:token("new"),expiresAt:.distantFuture,user:FieldUser(id:"u",email:"worker@test.invalid",role:"worker",tenantId:"t"),sessionId:"new")
        try vault.save("session",value:saved)
        do {_ = try await SessionManager().token(server:saved.server,requested:token("old"));XCTFail("Stale session was accepted")} catch let error as FieldAPIError {XCTAssertEqual(error.status,401)}
        XCTAssertEqual(vault.read("session",as:Session.self)?.sessionId,"new")
    }
}
