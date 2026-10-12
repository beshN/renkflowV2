import Foundation
func tokenSessionID(_ token:String)->String? {
    let parts=token.split(separator:".");guard parts.count==3 else {return nil}
    var encoded=String(parts[1]).replacingOccurrences(of:"-",with:"+").replacingOccurrences(of:"_",with:"/")
    while encoded.count % 4 != 0 {encoded.append("=")}
    guard let bytes=Data(base64Encoded:encoded),let json=try? JSONSerialization.jsonObject(with:bytes) as? [String:Any] else {return nil}
    return json["sid"] as? String
}
actor SessionManager {
    static let shared=SessionManager()
    private let vault:SecureVault
    private let api:FieldAPI
    init(vault:SecureVault=SecureVault(),api:FieldAPI=FieldAPI()) {self.vault=vault;self.api=api}
    private var refreshing:Task<Session,Error>?
    func token(server:String,requested:String) async throws -> String {
        guard let saved=vault.read("session",as:Session.self),saved.server==server,tokenSessionID(requested)==saved.sessionId else {throw FieldAPIError(status:401,message:L("text_cihaz_oturumu_degisti_5ca29"))}
        if saved.expiresAt>Date().addingTimeInterval(60) {return saved.token}
        if let refreshing {let result=try await refreshing.value;guard result.sessionId==saved.sessionId else {throw FieldAPIError(status:401,message:L("text_cihaz_oturumu_degisti_5ca29"))};return result.token}
        let task=Task {try await self.renew(saved)};refreshing=task;defer {refreshing=nil}
        return try await task.value.token
    }
    private func renew(_ saved:Session) async throws -> Session {
        guard let refresh=saved.refreshToken,let device=saved.deviceId else {throw FieldAPIError(status:401,message:L("text_yeniden_giris_yapin_4870f"))}
        var pending=saved;let request=saved.refreshRequestId ?? UUID().uuidString;pending.refreshRequestId=request;try vault.save("session",value:pending)
        let body=try JSONEncoder().encode(["refreshToken":refresh,"requestId":request,"deviceId":device])
        let result=try await api.request(LoginResult.self,server:saved.server,path:"auth/refresh",body:body)
        guard let latest=vault.read("session",as:Session.self),latest.sessionId==saved.sessionId,latest.refreshToken==saved.refreshToken else {throw FieldAPIError(status:401,message:L("text_cihaz_oturumu_degisti_5ca29"))}
        var next=saved;next.token=result.accessToken;next.expiresAt=Date().addingTimeInterval(result.expiresIn);next.user=result.user;next.refreshToken=result.refreshToken;next.sessionId=result.sessionId;next.deviceId=result.deviceId;next.refreshRequestId=nil
        try vault.save("session",value:next);return next
    }
}
