// Recovery copy from session output plus the recorded sorted-JSON, empty-session and persistence fixes.
// It has not been re-read from disk. Supporting project files remain required.
import Foundation

struct WorkspaceIdentity: Codable, Equatable {
    var id: String
    var email: String?
    var name: String?
    var role: String?
    var tenantId: String?
}
struct WorkspaceCookie: Codable {
    var name: String
    var value: String
    var domain: String
    var path: String
    var secure: Bool
    var expires: Date?
    init(_ cookie: HTTPCookie) {
        name=cookie.name;value=cookie.value;domain=cookie.domain;path=cookie.path;secure=cookie.isSecure;expires=cookie.expiresDate
    }
    func applies(to url: URL, now: Date=Date()) -> Bool {
        let host=url.host?.lowercased() ?? ""
        let domain=self.domain.trimmingCharacters(in:CharacterSet(charactersIn:".")).lowercased()
        let pathMatches=url.path == path || url.path.hasPrefix(path.hasSuffix("/") ? path : path+"/")
        return (host == domain) && (!secure || url.scheme == "https") && (expires == nil || expires! > now) && pathMatches
    }
}
private struct WorkspaceCredentials: Codable {var origin:String;var cookies:[WorkspaceCookie]}

/// HTTP-only native client. It renders no HTML and never follows an authentication redirect.
actor WorkspaceAPI {
    private let session:URLSession
    private var origin="https://renkflow.com"
    private var cookies:[WorkspaceCookie]=[]
    private let vault=SecureVault()
    private let persistence:Bool
    private var generation=0
    init(session:URLSession?=nil,persistence:Bool=true) {
        self.persistence=persistence
        let config=URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies=false;config.httpCookieAcceptPolicy = .never
        config.timeoutIntervalForRequest=30;config.timeoutIntervalForResource=60
        self.session=session ?? URLSession(configuration:config,delegate:RejectRedirects(),delegateQueue:nil)
        if persistence,let saved=vault.read("workspace.http",as:WorkspaceCredentials.self),let normalized=try? normalizeServer(saved.origin) {
            origin=normalized;cookies=saved.cookies
        }
    }
    func server() -> String {origin}
    func hasSession() -> Bool {cookies.contains {$0.name.contains("session-token") && ($0.expires == nil || $0.expires! > Date())}}
    func configure(_ server:String) throws {
        let next=try normalizeServer(server)
        if origin != next {generation+=1;origin=next;cookies=[];if persistence {vault.remove("workspace.http")}}
    }
    func clear() {generation+=1;cookies=[];if persistence {vault.remove("workspace.http")}}
    private func send(_ path:String,method:String="GET",body:Data?=nil,contentType:String="application/json") async throws -> JSONValue {
        guard path.hasPrefix("/api/"),!path.contains("\\"),let url=URL(string:origin+path),(try? WorkspaceOrigin(origin).contains(url)) == true else {throw FieldAPIError(status:400,message:"Geçersiz API adresi.")}
        let epoch=generation
        var request=URLRequest(url:url);request.httpMethod=method
        request.setValue("application/json",forHTTPHeaderField:"Accept")
        if path.hasPrefix("/api/auth/callback/") || path=="/api/auth/signout" {request.setValue("1",forHTTPHeaderField:"X-Auth-Return-Redirect")}
        request.setValue(origin,forHTTPHeaderField:"Origin")
        request.setValue(origin+"/",forHTTPHeaderField:"Referer")
        request.setValue("RenkFlow-Native/iOS",forHTTPHeaderField:"X-RenkFlow-Client")
        let header=cookies.filter {$0.applies(to:url)}.map {"\($0.name)=\($0.value)"}.joined(separator:"; ")
        if !header.isEmpty {request.setValue(header,forHTTPHeaderField:"Cookie")}
        if let body {request.httpBody=body;request.setValue(contentType,forHTTPHeaderField:"Content-Type")}
        let (data,response)=try await session.data(for:request)
        guard epoch==generation else {throw CancellationError()}
        guard let http=response as? HTTPURLResponse else {throw URLError(.badServerResponse)}
        let headers=http.allHeaderFields.reduce(into:[String:String]()) {if let key=$1.key as? String,let value=$1.value as? String {$0[key]=value}}
        let incoming=HTTPCookie.cookies(withResponseHeaderFields:headers,for:url).map(WorkspaceCookie.init)
        for cookie in incoming where cookie.domain.trimmingCharacters(in:CharacterSet(charactersIn:".")).lowercased()==url.host?.lowercased() {
            cookies.removeAll {$0.name==cookie.name && $0.path==cookie.path && $0.domain==cookie.domain}
            if cookie.expires == nil || cookie.expires! > Date() {cookies.append(cookie)}
        }
        if persistence && !incoming.isEmpty {try vault.save("workspace.http",value:WorkspaceCredentials(origin:origin,cookies:cookies))}
        let result=(try? JSONDecoder().decode(JSONValue.self,from:data)) ?? .null
        guard (200...299).contains(http.statusCode) || path.hasPrefix("/api/auth/callback/") && result["url"].string != nil else {
            throw FieldAPIError(status:http.statusCode,message:result["error"].string ?? result["message"].string ?? (http.statusCode==401 ? "Oturumunuz sona erdi. Yeniden giriş yapın." : "İşlem tamamlanamadı (\(http.statusCode))."))
        }
        if http.statusCode==204 {return .object([:])}
        if path=="/api/auth/session",String(data:data,encoding:.utf8)?.trimmingCharacters(in:.whitespacesAndNewlines)=="null" {return .null}
        guard case .null=result else {return result}
        throw FieldAPIError(status:502,message:"Sunucudan geçerli bir JSON yanıtı alınamadı.")
    }
    func request(_ path:String,method:String="GET",body:JSONValue?=nil) async throws -> JSONValue {
        let encoder=JSONEncoder();encoder.outputFormatting = [.sortedKeys]
        return try await send(path,method:method,body:body.map {try encoder.encode($0)})
    }
    private func form(_ path:String,_ fields:[String:String]) async throws -> JSONValue {
        var components=URLComponents();components.queryItems=fields.sorted {$0.key<$1.key}.map {URLQueryItem(name:$0.key,value:$0.value)}
        return try await send(path,method:"POST",body:Data((components.percentEncodedQuery ?? "").replacingOccurrences(of:"+",with:"%2B").utf8),contentType:"application/x-www-form-urlencoded")
    }
    func signIn(server:String,email:String,password:String,otp:String?=nil) async throws -> WorkspaceIdentity {
        try configure(server)
        if otp == nil {clear()}
        let csrf=try await request("/api/auth/csrf")
        guard let token=csrf["csrfToken"].string else {throw FieldAPIError(status:502,message:"Güvenli giriş başlatılamadı.")}
        var fields=["email":email.trimmingCharacters(in:.whitespacesAndNewlines).lowercased(),"password":password,"csrfToken":token,"callbackUrl":origin+"/dashboard","json":"true"]
        if let otp,!otp.isEmpty {fields["otp"]=otp}
        let response=try await signInForm(fields)
        if let address=response["url"].string,let components=URLComponents(string:address),let error=components.queryItems?.first(where:{$0.name=="error"})?.value {
            let code=components.queryItems?.first(where:{$0.name=="code"})?.value ?? error
            if code=="otp_required" {throw FieldAPIError(status:428,message:"Doğrulama kodunuzu girin.")}
            throw FieldAPIError(status:401,message:code=="otp_invalid" ? "Doğrulama kodu geçersiz." : code=="rate_limited" ? "Çok fazla deneme yapıldı. Biraz bekleyin." : "E-posta veya şifre doğrulanamadı.")
        }
        return try await identity()
    }
    private func signInForm(_ fields:[String:String]) async throws -> JSONValue {
        try await authForm("/api/auth/callback/credentials",fields)
    }
    private func authForm(_ path:String,_ fields:[String:String]) async throws -> JSONValue {
        var components=URLComponents();components.queryItems=fields.sorted {$0.key<$1.key}.map {URLQueryItem(name:$0.key,value:$0.value)}
        return try await send(path,method:"POST",body:Data((components.percentEncodedQuery ?? "").replacingOccurrences(of:"+",with:"%2B").utf8),contentType:"application/x-www-form-urlencoded")
    }
    func identity() async throws -> WorkspaceIdentity {
        let response=try await request("/api/auth/session")
        guard let object=response["user"].object,object["id"]?.string != nil else {throw FieldAPIError(status:401,message:"Oturum açmanız gerekiyor.")}
        return try JSONDecoder().decode(WorkspaceIdentity.self,from:JSONEncoder().encode(JSONValue.object(object)))
    }
    func signOut() async {
        if let token=try? await request("/api/auth/csrf")["csrfToken"].string {
            _ = try? await authForm("/api/auth/signout",["csrfToken":token,"callbackUrl":origin+"/auth/login","json":"true"])
        }
        clear()
    }
}

extension JSONValue {
    subscript(_ key:String) -> JSONValue { if case .object(let object)=self {return object[key] ?? .null};return .null }
    var string:String? {switch self {case .string(let value):return value;case .number(let value):return NSNumber(value:value).stringValue;default:return nil}}
    var object:[String:JSONValue]? {if case .object(let value)=self {return value};return nil}
    var array:[JSONValue] {if case .array(let value)=self {return value};return []}
    var number:Double? {switch self {case .number(let value):return value;case .string(let value):return Double(value);default:return nil}}
    var boolean:Bool {if case .bool(let value)=self {return value};return false}
    func rows(_ keys:[String]) -> [JSONValue] {if case .array=self {return array};for key in keys {if case .array(let values)=self[key] {return values}};if case .object=self["data"] {return self["data"].rows(keys)};if case .array=self["data"] {return self["data"].array};return []}
}
