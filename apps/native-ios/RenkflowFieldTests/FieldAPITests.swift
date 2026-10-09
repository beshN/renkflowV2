import XCTest
@testable import RenkflowField

final class FieldAPITests: XCTestCase {
    func testRejectsInsecureOrAmbiguousServerAddresses() throws {
        for address in ["http://renkflow.com", "https://user:pass@renkflow.com", "https://renkflow.com/path", "https://renkflow.com?code=1", "https://renkflow.com#fragment"] { XCTAssertThrowsError(try normalizeServer(address)) }
        XCTAssertEqual(try normalizeServer(" https://renkflow.com/ "), "https://renkflow.com")
    }
    func testCommandReplayPreservesIdentityVersionAndQuality() throws {
        let value = ProductionCommand(commandId: "00000000-0000-4000-8000-000000000001", action: "operation", data: OperationInput(operationId: "op", version: 7, action: "complete", quantity: 2, qualityResults: [QualityResult(checkId: "length", value: 12.4)]))
        let encoder = JSONEncoder(); encoder.outputFormatting = .sortedKeys
        let bytes = try encoder.encode(value), restored = try JSONDecoder().decode(ProductionCommand.self, from: bytes)
        XCTAssertEqual(bytes, try encoder.encode(restored)); XCTAssertEqual(restored.data.version, 7)
    }
    func testScanPayloadDecodesWithoutFollowingNavigationURLs() async throws {
        let api = mockAPI(status: 200, body: #"{"success":true,"data":{"kind":"job","id":"job-1","title":"Kesim","workOrderId":"job-1"}}"#)
        let auth = Session(server: "https://renkflow.com", token: "test-token", expiresAt: .distantFuture, user: FieldUser(id: "u", email: "x@example.com", name: "Test", role: "worker", tenantId: "t"))
        let result = try await api.scan(auth, code: "https://renkflow.com/factory?job=one&unit=two")
        XCTAssertEqual(result.workOrderId, "job-1")
        XCTAssertEqual(StubURLProtocol.lastRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer test-token")
        let query = URLComponents(url: try XCTUnwrap(StubURLProtocol.lastRequest?.url), resolvingAgainstBaseURL: false)?.queryItems
        XCTAssertEqual(query?.first?.value, "https://renkflow.com/factory?job=one&unit=two")
    }
    func testUnauthorizedIsNotReportedAsSuccess() async throws {
        let api = mockAPI(status: 401, body: #"{"error":"Oturum sona erdi"}"#)
        do { let _: FieldUser = try await api.request(FieldUser.self, server: "https://renkflow.com", path: "auth/me"); XCTFail("401 must fail") }
        catch let error as FieldAPIError { XCTAssertEqual(error.status, 401) }
    }
    private func mockAPI(status: Int, body: String) -> FieldAPI {
        StubURLProtocol.status = status; StubURLProtocol.body = Data(body.utf8)
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [StubURLProtocol.self]
        return FieldAPI(session: URLSession(configuration: config))
    }
}
private final class StubURLProtocol: URLProtocol {
    static var status = 200; static var body = Data(); static var lastRequest: URLRequest?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lastRequest = request
        let response = HTTPURLResponse(url: request.url!, statusCode: Self.status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.body); client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
