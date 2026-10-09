import Foundation
import Combine

@MainActor final class FieldStore: ObservableObject {
    @Published var session: Session?
    @Published var restoring=true
    @Published var busy=false
    @Published var stale=true
    @Published var updateRequired=false
    @Published var snapshot: Snapshot?
    @Published var references:FieldReferences?
    @Published var installations:[Installation]=[]
    @Published var installationDetail:InstallationDetails?
    @Published var detail: WorkOrder?
    @Published var selectedID: String?
    @Published var scanResult: ScanResult?
    @Published var pending: ProductionCommand?
    @Published var outbox: [OutboxRecord]=[]
    @Published var syncing=false
    @Published var lastSync: Date?
    @Published var accessBlocked=false
    @Published var error: String?
    @Published var message: String?
    let offline: OfflineStore?
    private let api: FieldAPI
    private let vault=SecureVault()
    private var lastValidation=Date.distantPast
    private var epoch=0
    var writable: Bool {session != nil && offline != nil && !updateRequired && !accessBlocked && snapshot?.permissions.transition==true}
    init(offline: OfflineStore?=nil,api: FieldAPI=FieldAPI()) {
        self.api=api
        if let offline {self.offline=offline} else {self.offline=try? OfflineStore.persistent()}
    }
    private func storage() throws -> OfflineStore {guard let offline else {throw FieldAPIError(status:0,message:"Yerel kayıt deposu açılamadı. Bekleyen işler korunuyor; uygulamayı yeniden açın.")};return offline}
    private func reloadQueue() {
        guard let auth=session else {outbox=[];return}
        do {outbox=try storage().rows(sessionScope(auth))} catch {fail(error)}
    }
    private func attach(_ auth: Session) throws {
        let store=try storage(),scope=sessionScope(auth)
        try store.prepare();try store.migrate(auth,legacy:vault.read("pending",as:ProductionCommand.self));vault.remove("pending")
        snapshot=try store.read(scope,key:"snapshot",as:Snapshot.self)
        references=try store.read(scope,key:"references",as:FieldReferences.self)
        installations=try store.read(scope,key:"installations",as:InstallationList.self)?.installations ?? []
        if let stamp=try store.read(scope,key:"last-sync",as:Double.self) {lastSync=Date(timeIntervalSince1970:stamp)}
        stale=true;reloadQueue();FieldBackgroundSync.schedule()
    }
    func restore() async {
        guard restoring else {return};defer {restoring=false;busy=false}
        guard let saved=vault.read("session",as:Session.self) else {return}
        session=saved
        do {try attach(saved);restoring=false;await refresh()} catch {fail(error)}
    }
    func login(server: String,email: String,password: String) async {
        guard !busy else {return};busy=true;error=nil;defer {busy=false}
        do {
            let origin=try normalizeServer(server),result=try await api.login(server:origin,email:email.trimmingCharacters(in:.whitespaces).lowercased(),password:password)
            var auth=Session(server:origin,token:result.accessToken,expiresAt:Date().addingTimeInterval(result.expiresIn),user:result.user)
            auth.user=try await api.me(auth);vault.clear();try vault.save("session",value:auth)
            epoch+=1;session=auth;snapshot=nil;detail=nil;scanResult=nil;selectedID=nil
            try attach(auth);try await loadSnapshot(auth);lastValidation=Date();busy=false;await sync()
        } catch {fail(error)}
    }
    func logout() {
        epoch+=1;vault.clear();FieldBackgroundSync.cancel();session=nil;snapshot=nil;detail=nil;selectedID=nil;scanResult=nil;outbox=[];references=nil;installations=[];installationDetail=nil;error=nil;message=nil;stale=true;syncing=false
    }
    func foreground() async {if Date().timeIntervalSince(lastValidation)>60 {await refresh()} else {await sync()}}
    func refresh() async {
        guard let auth=session,!busy else {return};busy=true;error=nil;let generation=epoch
        defer {if generation==epoch {busy=false}}
        do {
            if auth.expiresAt<=Date() {throw FieldAPIError(status:401,message:"Oturumunuz sona erdi.")}
            _ = try await api.me(auth);guard generation==epoch else {return}
            lastValidation=Date();try await loadSnapshot(auth)
            if let id=selectedID {let job=try overlayJob(await api.details(auth,id:id),rows:outbox);try cacheDetail(auth,job:job);if generation==epoch && selectedID==id {detail=job}}
            accessBlocked=false;busy=false;await sync()
        } catch {if generation==epoch {fail(error)}}
    }
    private func loadSnapshot(_ auth: Session) async throws {
        let generation=epoch,store=try storage(),scope=sessionScope(auth)
        let base=try await api.snapshot(auth)
        var result=base;for row in try store.rows(scope) {result=try overlay(result,row:row)}
        try store.context.transaction {
            try store.setCache(scope,key:"snapshot-base",data:JSONEncoder().encode(base))
            try store.setCache(scope,key:"snapshot",data:JSONEncoder().encode(result))
            for job in result.workOrders {try store.setCache(scope,key:"job:"+job.id,data:JSONEncoder().encode(job))}
            try store.setCache(scope,key:"last-sync",data:JSONEncoder().encode(Date().timeIntervalSince1970));try store.context.save()
        }
        if generation==epoch {snapshot=result;stale=false;lastSync=Date()}
        // Cache server reference/module data too; these remain technical projections.
        let references:[String:JSONValue]=try await api.request([String:JSONValue].self,server:auth.server,token:auth.token,path:"references")
        try store.setCache(scope,key:"references",data:JSONEncoder().encode(references))
        if generation==epoch {self.references=try JSONDecoder().decode(FieldReferences.self,from:JSONEncoder().encode(references))}
        var keys=["notifications/preferences"]
        if let value=references["capabilities"],case .object(let capabilities)=value,capabilities["installations"]?.flag==true {keys.append("installations")}
        for key in keys {
            let values:[String:JSONValue]=try await api.request([String:JSONValue].self,server:auth.server,token:auth.token,path:key)
            try store.setCache(scope,key:key,data:JSONEncoder().encode(values))
            if key=="installations",generation==epoch {installations=try JSONDecoder().decode(InstallationList.self,from:JSONEncoder().encode(values)).installations}
        }
        if self.references?.capabilities.installations != true {installations=[];installationDetail=nil}
        if let id=installationDetail?.id {try await loadInstallation(auth,id:id,generation:generation)}
        try store.context.save()
    }
    private func cacheDetail(_ auth: Session,job: WorkOrder) throws {let store=try storage();try store.setCache(sessionScope(auth),key:"job:"+job.id,data:JSONEncoder().encode(job));try store.context.save()}
    func openJob(_ id: String) async {
        guard let auth=session else {return};selectedID=id;detail=nil;error=nil;let generation=epoch
        do {
            detail=try storage().read(sessionScope(auth),key:"job:"+id,as:WorkOrder.self)
            let job=try overlayJob(await api.details(auth,id:id),rows:outbox);try cacheDetail(auth,job:job)
            if generation==epoch && selectedID==id {detail=job}
        } catch {if generation==epoch {fail(error)}}
    }
    func openInstallation(_ id:String) async {
        guard let auth=session else {return};let generation=epoch
        do {
            installationDetail=try storage().read(sessionScope(auth),key:"installation:"+id,as:InstallationDetails.self)
            try await loadInstallation(auth,id:id,generation:generation)
        } catch {if generation==epoch {fail(error)}}
    }
    private func loadInstallation(_ auth:Session,id:String,generation:Int) async throws {
        let current=try await api.request(InstallationDetails.self,server:auth.server,token:auth.token,path:"installations/"+id)
        let result=overlayInstallation(current,rows:try storage().rows(sessionScope(auth)))
        try storage().setCache(sessionScope(auth),key:"installation:"+id,data:JSONEncoder().encode(result));try storage().context.save()
        if generation==epoch {installationDetail=result}
    }
    func installationCommand(_ action:String,item:InstallationCheck?=nil,kind:String?=nil,text:String?=nil) async {
        guard let current=installationDetail else {return}
        var data:[String:JSONValue]=["action":.string(action),"expectedVersion":.number(Double(current.version))]
        if let item {data["itemId"] = .string(item.id);data["completed"] = .bool(!item.completed)}
        if let kind {data["kind"] = .string(kind)};if let text {data["text"] = .string(text.trimmingCharacters(in:.whitespacesAndNewlines))}
        await enqueue("installation",jobID:current.id,data:data)
    }
    func closeJob() {selectedID=nil;detail=nil}
    func scan(_ code: String) async {
        guard let auth=session else {return};let value=code.trimmingCharacters(in:.whitespacesAndNewlines)
        do {
            guard !value.isEmpty,value.count<=1000 else {throw FieldAPIError(status:400,message:"Geçerli bir etiket kodu girin.")}
            let result=try await api.scan(auth,code:value);let store=try storage();try store.setCache(sessionScope(auth),key:"scan:"+value,data:JSONEncoder().encode(result));try store.context.save();scanResult=result
        } catch {
            if let cached=try? storage().read(sessionScope(auth),key:"scan:"+value,as:ScanResult.self) {scanResult=cached;stale=true} else {fail(error)}
        }
    }
    func toggle(_ item: ChecklistItem) async {
        guard let job=detail else {return};await enqueue("checklist",jobID:job.id,data:["itemId":.string(item.id),"completed":.bool(!item.completed),"expectedCompleted":.bool(item.completed)])
    }
    func comment(_ text: String) async {
        guard let job=detail else {return};let value=text.trimmingCharacters(in:.whitespacesAndNewlines)
        guard (1...2000).contains(value.count) else {return};await enqueue("comment",jobID:job.id,data:["body":.string(value)])
    }
    func transition(_ status: String,reason: String?=nil) async {
        guard let job=detail,let revision=job.updatedAt else {return}
        var data:[String:JSONValue]=["status":.string(status),"expectedUpdatedAt":.string(revision)]
        if status=="blocked" {data["blockedReasonCategory"] = .string("other");data["blockedReasonDetail"] = .string(reason?.trimmingCharacters(in:.whitespacesAndNewlines) ?? "")}
        await enqueue("transition",jobID:job.id,data:data)
    }
    func fieldEvent(_ kind:String,jobID:String,reason:String,count:Int,note:String,photo:String?) async {
        var data:[String:JSONValue]=["reasonCode":.string(reason),"note":.string(note)]
        if kind=="scrap" {data["quantity"] = .number(Double(count));data["photos"] = .array(photo.map {[.string($0)]} ?? [])}
        await enqueue(kind,jobID:jobID,data:data)
    }
    func command(_ input: OperationInput) async {do {await enqueue("operation",jobID:nil,data:try payload(input))} catch {fail(error)}}
    private func enqueue(_ kind: String,jobID: String?,data: [String:JSONValue]) async {
        guard let auth=session,!updateRequired,!accessBlocked,(kind=="installation" ? references?.capabilities.installationEdit==true : writable) else {return}
        do {
            let request=SyncRequest(idempotencyKey:UUID().uuidString,kind:kind,data:data,workOrderId:kind=="installation" ? nil : jobID,installationId:kind=="installation" ? jobID : nil)
            let temporary=OutboxRecord(id:request.idempotencyKey,sequence:0,scope:sessionScope(auth),kind:kind,payload:try JSONEncoder().encode(request))
            var next=snapshot;if let current=next {next=try overlay(current,row:temporary)}
            let job=try detail.map {try overlayJob($0,rows:[temporary])}
            let installation=installationDetail.map {overlayInstallation($0,rows:[temporary])}
            var caches:[String:Data]=[:];if let installation {caches["installation:"+installation.id]=try JSONEncoder().encode(installation)};if let next {caches["snapshot"]=try JSONEncoder().encode(next)};if let job {caches["job:"+job.id]=try JSONEncoder().encode(job)}
            try storage().enqueue(sessionScope(auth),request:request,caches:caches)
            snapshot=next;detail=job;installationDetail=installation;message="İşlem cihazda kaydedildi.";reloadQueue();FieldBackgroundSync.schedule();await sync()
        } catch {fail(error)}
    }
    func retryCommand() async {await sync()}
    func sync() async {
        guard let auth=session,!syncing,!updateRequired else {return};let generation=epoch
        syncing=true;defer {if generation==epoch {syncing=false;reloadQueue()}}
        do {
            let store=try storage(),sender=APIOutboxSender(store:try storage(),api:api,auth:auth)
            let result=try await OutboxSync(store:store,send:{[weak self] row in guard self?.epoch==generation else {throw CancellationError()};return try await sender.send(row)}).drain(sessionScope(auth))
            reloadQueue()
            if generation==epoch && (result.delivered>0 || outbox.contains {$0.state=="conflict" || $0.state=="blocked"}) {
                try await loadSnapshot(auth)
                if let id=selectedID {let job=try overlayJob(await api.details(auth,id:id),rows:outbox);try cacheDetail(auth,job:job);detail=job}
            }
            if result.retry {stale=true;FieldBackgroundSync.schedule()}
        } catch {if generation==epoch {fail(error)}}
    }
    func uploadPhoto(jobID: String,bytes: Data) async -> String? {
        guard let auth=session,writable else {return nil}
        do {
            guard bytes.count<=2_000_000 else {throw FieldAPIError(status:400,message:"Fotoğraf çok büyük.")}
            let row=try storage().photo(sessionScope(auth),value:LocalPhoto(workOrderId:jobID,base64:bytes.base64EncodedString()))
            reloadQueue();FieldBackgroundSync.schedule();Task {await sync()};return "local://"+row.commandID
        } catch {fail(error);return nil}
    }
    func discard(_ row: OutboxRecord) async {
        guard let auth=session,row.scope==sessionScope(auth),row.state != "sending" else {return}
        do {row.state="delivered";row.reason="Kullanıcı vazgeçti.";row.canRetry=false;try storage().context.save();reloadQueue();await refresh()} catch {fail(error)}
    }
    func reapply(_ row: OutboxRecord) async {
        guard let auth=session,row.scope==sessionScope(auth),row.state=="conflict",row.canRetry,!busy else {return}
        busy=true;defer {busy=false}
        do {
            var request=try JSONDecoder().decode(SyncRequest.self,from:row.payload)
            let fresh=try await api.snapshot(auth);guard fresh.permissions.transition else {throw FieldAPIError(status:403,message:"Yazma yetkiniz yok.")}
            switch request.kind {
            case "operation":
                guard let op=fresh.operations.first(where:{$0.id==request.data["operationId"]?.text}),op.status != "done" else {throw FieldAPIError(status:404,message:"Operasyon artık size atanmamış veya kapatılmış.")};request.data["version"] = .number(Double(op.version))
            case "checklist":
                let job=try await api.details(auth,id:request.workOrderId!)
                guard !["done","cancelled"].contains(job.status),let item=job.checklist?.first(where:{$0.id==request.data["itemId"]?.text}) else {throw FieldAPIError(status:404,message:"Kontrol öğesi artık uygulanamaz.")};request.data["expectedCompleted"] = .bool(item.completed)
            case "transition":
                let job=try await api.details(auth,id:request.workOrderId!)
                guard !["done","cancelled"].contains(job.status),let revision=job.updatedAt else {throw FieldAPIError(status:409,message:"Kapatılan iş yeniden uygulanamaz.")};request.data["expectedUpdatedAt"] = .string(revision)
            default: throw FieldAPIError(status:400,message:"Bu işlem yeniden uygulanamaz.")
            }
            request.idempotencyKey=UUID().uuidString
            guard session.map(sessionScope)==sessionScope(auth) else {return}
            try storage().rebase(sessionScope(auth),row:row,request:request)
            reloadQueue();FieldBackgroundSync.schedule();await sync()
        } catch {fail(error)}
    }
    private func fail(_ failure: Error) {
        if failure is CancellationError {return}
        if (failure as? FieldAPIError)?.status==426 {updateRequired=true;stale=true;error=nil;return}
        if (failure as? FieldAPIError)?.status==401 {logout();busy=false;error="Oturum sona erdi. Bekleyen kayıtlar cihazda korunuyor; yeniden giriş yapın."}
        else {stale=true;error=failure is URLError ? "Çevrimdışısınız. İşlemler cihazda saklanıyor." : (failure as? FieldAPIError)?.message ?? "Yerel işlem tamamlanamadı; kayıtlar korunuyor.";if (failure as? FieldAPIError)?.status==403 {accessBlocked=true}}
    }
}
private func overlayJob(_ job: WorkOrder,rows: [OutboxRecord]) throws -> WorkOrder {
    var result=job
    for row in rows where ["pending","sending"].contains(row.state) && row.kind != "photo" {
        guard let request=try? JSONDecoder().decode(SyncRequest.self,from:row.payload),request.workOrderId==job.id else {continue}
        switch request.kind {
        case "checklist":result.checklist=result.checklist?.map {item in var value=item;if value.id==request.data["itemId"]?.text {value.completed=request.data["completed"]?.flag ?? value.completed};return value}
        case "comment":result.comments=(result.comments ?? [])+[FieldComment(id:row.commandID,body:request.data["body"]?.text ?? "",authorName:"Siz",createdAt:ISO8601DateFormatter().string(from:row.createdAt))]
        case "transition":result.status=request.data["status"]?.text ?? result.status;result.blockedReasonDetail=request.data["blockedReasonDetail"]?.text
        default:break
        }
    }
    result.checklistCompleted=result.checklist?.filter(\.completed).count ?? result.checklistCompleted;return result
}
private func overlay(_ snapshot: Snapshot,row: OutboxRecord) throws -> Snapshot {
    guard ["pending","sending"].contains(row.state),row.kind != "photo",let request=try? JSONDecoder().decode(SyncRequest.self,from:row.payload) else {return snapshot}
    var result=snapshot;result.workOrders=try result.workOrders.map {try overlayJob($0,rows:[row])}
    if request.kind=="operation",let input=try? JSONDecoder().decode(OperationInput.self,from:JSONEncoder().encode(request.data)) {
        result.operations=result.operations.map {op in
            guard op.id==input.operationId,op.version==input.version else {return op}
            if input.action=="rework" {return op}
            var changed=op;let rejected=input.qualityResults.contains {$0.passed==false}
            if input.action=="complete" && !rejected {changed.completedQty+=Double(input.quantity ?? 0)}
            changed.version+=1;changed.status=input.action=="start" ? "running" : input.action=="pause" ? "paused" : input.action=="note" ? op.status : rejected ? "blocked" : changed.completedQty>=changed.plannedQty ? "done" : "paused"
            changed.activeSince=input.action=="note" ? op.activeSince : changed.status=="running" ? ISO8601DateFormatter().string(from:Date()) : nil;return changed
        }
    }
    return result
}
