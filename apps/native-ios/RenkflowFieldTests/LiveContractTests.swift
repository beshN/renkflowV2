import XCTest
import Security
@testable import RenkflowField

final class LiveContractTests: XCTestCase {
    func testAssignedWorkQualityPhotoAndBarcodeThroughRealServer() async throws {
        let config = URLSessionConfiguration.ephemeral
        let client = URLSession(configuration: config, delegate: LoopbackTestTrust(), delegateQueue: nil)
        let (data, response) = try await client.data(from: URL(string: "https://127.0.0.1:3043/fixture")!)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        let fixture = try JSONDecoder().decode(Fixture.self, from: data)
        let api = FieldAPI(session: client)
        let login = try await api.login(server: "https://127.0.0.1:3043", email: fixture.email, password: fixture.password)
        let auth = Session(server: "https://127.0.0.1:3043", token: login.accessToken, expiresAt: .distantFuture, user: login.user)
        let user = try await api.me(auth); XCTAssertEqual(user.role, "worker")
        let snapshot = try await api.snapshot(auth); XCTAssertTrue(snapshot.workOrders.contains { $0.id == fixture.productionJobId })
        let job = try await api.details(auth, id: fixture.jobId)
        let checklist = try XCTUnwrap(job.checklist?.first)
        let _: Accepted = try await api.post(auth, path: "work-orders/\(job.id)/checklist/\(checklist.id)", value: ChecklistInput(completed: false), type: Accepted.self)
        let _: Accepted = try await api.post(auth, path: "work-orders/\(job.id)/comments", value: CommentInput(body: "iOS contract note"), type: Accepted.self)
        let updated = try await api.details(auth, id: job.id); XCTAssertEqual(updated.checklist?.first?.completed, false)
        let start = ProductionCommand(commandId: UUID().uuidString, action: "operation", data: OperationInput(operationId: fixture.operationId, version: 1, action: "start"))
        let started = try await api.command(auth, value: start); XCTAssertTrue(started.accepted)
        let replayed = try await api.command(auth, value: start); XCTAssertTrue(replayed.accepted)
        let complete = ProductionCommand(commandId: UUID().uuidString, action: "operation", data: OperationInput(operationId: fixture.operationId, version: 2, action: "complete", quantity: 2, qualityResults: [QualityResult(checkId: "visual", passed: true)]))
        let done = try await api.command(auth, value: complete); XCTAssertTrue(done.accepted)
        let doneAgain = try await api.command(auth, value: complete); XCTAssertTrue(doneAgain.accepted)
        let result = try await api.snapshot(auth); XCTAssertEqual(result.operations.first { $0.id == fixture.operationId }?.completedQty, 2)
        let photo: PhotoResult = try await api.post(auth, path: "files", value: PhotoInput(base64: fixture.jpeg, workOrderId: fixture.productionJobId), type: PhotoResult.self)
        XCTAssertTrue(photo.url.hasPrefix("/api/v1/production/files/"))
        let scan = try await api.scan(auth, code: fixture.code); XCTAssertEqual(scan.workOrderId, fixture.productionJobId)
    }
    private struct Fixture: Decodable { let email: String; let password: String; let jobId: String; let productionJobId: String; let operationId: String; let code: String; let jpeg: String }
}
// Test target only: the self-signed temporary certificate is accepted only on this loopback port.
final class LoopbackTestTrust: NSObject, URLSessionDelegate {
    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        guard challenge.protectionSpace.host == "127.0.0.1", challenge.protectionSpace.port == 3043,
              challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust else { completionHandler(.performDefaultHandling, nil); return }
        completionHandler(.useCredential, URLCredential(trust: trust))
    }
}
