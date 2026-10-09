import Foundation
import CryptoKit

func retryDelay(_ attempt: Int) -> TimeInterval {min(3600,15*pow(2,Double(min(8,max(0,attempt)))))}
struct DrainResult {let delivered: Int;let retry: Bool}
@MainActor final class OutboxSync {
    let store: OfflineStore
    let send: (OutboxRecord) async throws -> String?
    init(store: OfflineStore,send: @escaping (OutboxRecord) async throws -> String?) {self.store=store;self.send=send}
    func drain(_ scope: String) async throws -> DrainResult {
        guard !store.draining else {return DrainResult(delivered:0,retry:false)}
        store.draining=true;defer {store.draining=false}
        try store.prepare();var delivered=0
        while let row=try store.rows(scope).first {
            guard row.state=="pending" else {return DrainResult(delivered:delivered,retry:false)}
            guard row.nextAttempt<=Date() else {return DrainResult(delivered:delivered,retry:true)}
            do {
                if row.kind=="photo" {let photo=try JSONDecoder().decode(LocalPhoto.self,from:row.payload);guard let bytes=Data(base64Encoded:photo.base64),!bytes.isEmpty else {throw FieldAPIError(status:400,message:"Fotoğraf kaydı bozuk.")}}
                else {let request=try JSONDecoder().decode(SyncRequest.self,from:row.payload);guard request.idempotencyKey==row.commandID && request.kind==row.kind else {throw FieldAPIError(status:0,message:"Kayıt uyuşmuyor.")}}
            } catch {row.state="corrupt";row.reason="Yerel kayıt okunamadı. Kayıt korunuyor; bu işlemi inceleyip vazgeçebilirsiniz.";try store.context.save();return DrainResult(delivered:delivered,retry:false)}
            row.state="sending";try store.context.save()
            do {
                let url=try await send(row);row.state="delivered";row.resultURL=url;row.reason=nil
                if row.kind=="photo" {row.payload=Data("{}".utf8)}
                try store.context.save();delivered+=1
            } catch {
                if error is CancellationError {row.state="pending";try store.context.save();throw error}
                let failure=error as? FieldAPIError
                switch failure?.status {
                case 409: row.state="conflict";row.reason=failure?.message;row.canRetry=failure?.canRetry ?? false
                case 400,403,404,413,415: row.state="blocked";row.reason=failure?.message;row.canRetry=false
                case 401,426: row.state="pending";try store.context.save();throw error
                default: row.state="pending";row.nextAttempt=Date().addingTimeInterval(retryDelay(row.attempts));row.attempts+=1;try store.context.save();return DrainResult(delivered:delivered,retry:true)
                }
                try store.context.save();return DrainResult(delivered:delivered,retry:false)
            }
        }
        return DrainResult(delivered:delivered,retry:false)
    }
}
@MainActor final class APIOutboxSender {
    let store: OfflineStore;let api: FieldAPI;let auth: Session
    init(store: OfflineStore,api: FieldAPI,auth: Session) {self.store=store;self.api=api;self.auth=auth}
    func send(_ row: OutboxRecord) async throws -> String? {
        if row.kind=="photo" {return try await upload(row)}
        var request=try JSONDecoder().decode(SyncRequest.self,from:row.payload)
        if request.kind=="operation",let value=request.data["photos"],case .array(let photos)=value {
            request.data["photos"] = .array(try photos.map {value in
                guard let url=value.text,url.hasPrefix("local://") else {return value}
                guard let photo=try store.find(sessionScope(auth),id:String(url.dropFirst(8))),photo.kind=="photo",photo.state=="delivered",let remote=photo.resultURL else {throw FieldAPIError(status:400,message:"Fotoğraf eşitlenmedi veya silinmiş; bu bildirimi inceleyin.")}
                return .string(remote)
            })
        }
        let result:Accepted=try await api.post(auth,path:"sync",value:request,type:Accepted.self)
        guard result.accepted else {throw FieldAPIError(status:502,message:"Sunucu işlemi onaylamadı.")};return nil
    }
    private func sha(_ data: Data) -> String {SHA256.hash(data:data).map {String(format:"%02x",$0)}.joined()}
    private func call(_ body:[String:JSONValue]) async throws -> UploadStatus {try await api.post(auth,path:"uploads",value:body,type:UploadStatus.self)}
    private func upload(_ row: OutboxRecord) async throws -> String {
        let photo=try JSONDecoder().decode(LocalPhoto.self,from:row.payload)
        guard let bytes=Data(base64Encoded:photo.base64) else {throw FieldAPIError(status:400,message:"Fotoğraf kaydı bozuk.")}
        var status=try await call(["action":.string("init"),"uploadId":.string(row.commandID),"workOrderId":.string(photo.workOrderId),"name":.string(photo.name),"totalBytes":.number(Double(bytes.count)),"sha256":.string(sha(bytes))])
        guard status.totalBytes==bytes.count,(0...bytes.count).contains(status.receivedBytes),(1...262144).contains(status.chunkBytes) else {throw FieldAPIError(status:502,message:"Sunucu yükleme durumu geçersiz.")}
        while !status.completed && status.receivedBytes<bytes.count {
            let offset=status.receivedBytes,part=bytes.subdata(in:offset..<min(bytes.count,offset+status.chunkBytes))
            status=try await call(["action":.string("chunk"),"uploadId":.string(row.commandID),"offset":.number(Double(offset)),"base64":.string(part.base64EncodedString()),"sha256":.string(sha(part))])
            guard status.receivedBytes>offset && status.receivedBytes<=bytes.count else {throw FieldAPIError(status:502,message:"Fotoğraf parçası onaylanmadı.")}
        }
        if !status.completed {status=try await call(["action":.string("finish"),"uploadId":.string(row.commandID)])}
        guard let url=status.url else {throw FieldAPIError(status:502,message:"Fotoğraf tamamlanmadı.")};return url
    }
}
