import Foundation

struct FieldAPIError: LocalizedError {
    let status: Int; let message: String; let canRetry: Bool
    init(status: Int,message: String,canRetry: Bool = false) { self.status=status;self.message=message;self.canRetry=canRetry }
    var errorDescription: String? { message }
}
private struct Envelope<T: Decodable>: Decodable { let data: T }
private struct ErrorEnvelope: Decodable { let error: String?; let canRetry: Bool? }
final class RejectRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

func normalizeServer(_ input: String) throws -> String {
    guard let components = URLComponents(string: input.trimmingCharacters(in: .whitespacesAndNewlines)),
          components.scheme?.lowercased() == "https", let host = components.host, !host.isEmpty,
          components.user == nil, components.password == nil, components.query == nil, components.fragment == nil,
          components.path.isEmpty || components.path == "/", let url = components.url else {
        throw FieldAPIError(status: 0, message: "Adres HTTPS ile başlamalı ve yalnızca alan adını içermeli.")
    }
    return url.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
}

final class FieldAPI {
    private let tokenResolver:(@Sendable (String,String) async throws -> String)?
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    init(session: URLSession? = nil,tokenResolver:(@Sendable (String,String) async throws -> String)?=nil) {
        self.tokenResolver=tokenResolver
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 35; config.timeoutIntervalForResource = 45
        config.httpCookieAcceptPolicy = .never; config.httpShouldSetCookies = false
        self.session = session ?? URLSession(configuration: config, delegate: RejectRedirects(), delegateQueue: nil)
    }
    static func live()->FieldAPI {FieldAPI(tokenResolver:{server,token in try await SessionManager.shared.token(server:server,requested:token)})}
    func request<T: Decodable>(_ type: T.Type, server: String, token: String? = nil, path: String, body: Data? = nil, code: String? = nil) async throws -> T {
        let origin = try normalizeServer(server)
        guard var components = URLComponents(string: origin + MobileContract.basePath + "/" + (path.hasPrefix("field/") ? String(path.dropFirst(6)) : path)) else { throw FieldAPIError(status: 0, message: "Sunucu adresi geçersiz.") }
        if let code { components.queryItems = [URLQueryItem(name: "code", value: code)] }
        guard let url = components.url else { throw FieldAPIError(status: 0, message: "İstek adresi geçersiz.") }
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(MobileContract.version, forHTTPHeaderField: "X-RenkFlow-App-Version")
        request.setValue("ios", forHTTPHeaderField: "X-RenkFlow-Platform")
        if let token { request.setValue("Bearer " + (try await tokenResolver?(server,token) ?? token), forHTTPHeaderField: "Authorization") }
        if let body { request.httpMethod = "POST"; request.httpBody = body; request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (bytes, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw FieldAPIError(status: 502, message: "Sunucudan yanıt alınamadı.") }
        guard (200...299).contains(http.statusCode) else {
            let failure = try? decoder.decode(ErrorEnvelope.self, from: bytes)
            throw FieldAPIError(status: http.statusCode, message: failure?.error ?? "İşlem tamamlanamadı (\(http.statusCode)).", canRetry: failure?.canRetry == true)
        }
        do { return try decoder.decode(Envelope<T>.self, from: bytes).data }
        catch { throw FieldAPIError(status: 502, message: "Sunucudan beklenmeyen yanıt alındı.") }
    }
    func login(server: String, email: String, password: String,deviceId:String?=nil) async throws -> LoginResult {
        try await request(LoginResult.self, server: server, path: "auth/login", body: encoder.encode(LoginInput(email: email, password: password,deviceId:deviceId)))
    }
    func me(_ auth: Session) async throws -> FieldUser { try await request(FieldUser.self, server: auth.server, token: auth.token, path: "auth/me") }
    func snapshot(_ auth: Session) async throws -> Snapshot { try await request(Snapshot.self, server: auth.server, token: auth.token, path: "field/snapshot") }
    func details(_ auth: Session, id: String) async throws -> WorkOrder { try await request(WorkOrder.self, server: auth.server, token: auth.token, path: "field/work-orders/" + id) }
    func scan(_ auth: Session, code: String) async throws -> ScanResult { try await request(ScanResult.self, server: auth.server, token: auth.token, path: "field/scan", code: code) }
    func command(_ auth: Session, value: ProductionCommand) async throws -> Accepted { try await post(auth, path: "commands", value: value, type: Accepted.self) }
    func post<Input: Encodable, Output: Decodable>(_ auth: Session, path: String, value: Input, type: Output.Type) async throws -> Output {
        try await request(type, server: auth.server, token: auth.token, path: "field/" + path, body: encoder.encode(value))
    }
}
