import Foundation
import Combine

@MainActor final class FieldStore: ObservableObject {
    @Published var session: Session?
    @Published var restoring = true
    @Published var busy = false
    @Published var stale = true
    @Published var updateRequired = false
    @Published var snapshot: Snapshot?
    @Published var detail: WorkOrder?
    @Published var selectedID: String?
    @Published var scanResult: ScanResult?
    @Published var pending: ProductionCommand?
    @Published var error: String?
    @Published var message: String?
    private let api = FieldAPI()
    private let vault = SecureVault()
    private var lastValidation = Date.distantPast
    private var epoch = 0
    var writable: Bool { session != nil && !busy && !stale && pending == nil && snapshot?.permissions.transition == true }
    func restore() async {
        guard restoring else { return }
        defer { restoring = false; busy = false }
        guard let saved = vault.read("session", as: Session.self), saved.expiresAt > Date() else { vault.clear(); return }
        session = saved; pending = vault.read("pending", as: ProductionCommand.self); busy = true
        do {
            var verified = saved; verified.user = try await api.me(saved)
            try vault.save("session", value: verified); session = verified
            try await loadSnapshot(verified); lastValidation = Date()
        } catch { fail(error) }
    }
    func login(server: String, email: String, password: String) async {
        guard !busy else { return }
        busy = true; error = nil
        defer { busy = false }
        do {
            let host = try normalizeServer(server)
            let result = try await api.login(server: host, email: email.trimmingCharacters(in: .whitespaces).lowercased(), password: password)
            guard ["owner", "admin", "office", "worker"].contains(result.user.role) else { throw FieldAPIError(status: 403, message: "Bu hesap saha uygulamasına erişemiyor.") }
            var verified = Session(server: host, token: result.accessToken, expiresAt: Date().addingTimeInterval(result.expiresIn), user: result.user)
            verified.user = try await api.me(verified)
            vault.clear(); try vault.save("session", value: verified)
            epoch += 1; session = verified; snapshot = nil; detail = nil; pending = nil; scanResult = nil
            try await loadSnapshot(verified); lastValidation = Date()
        } catch { fail(error) }
    }
    func logout() {
        epoch += 1; vault.clear(); session = nil; snapshot = nil; detail = nil; selectedID = nil
        pending = nil; scanResult = nil; error = nil; message = nil; stale = true
    }
    func foreground() async { if Date().timeIntervalSince(lastValidation) > 60 { await refresh() } }
    func refresh() async {
        guard let auth = session, !busy else { return }
        busy = true; error = nil
        let generation = epoch
        defer { if generation == epoch { busy = false } }
        do {
            try checkExpiry(auth); _ = try await api.me(auth)
            guard generation == epoch else { return }
            lastValidation = Date(); try await loadSnapshot(auth)
            if let id = selectedID { let job = try await api.details(auth, id: id); if generation == epoch && selectedID == id { detail = job } }
        } catch { if generation == epoch { fail(error) } }
    }
    private func loadSnapshot(_ auth: Session) async throws {
        let generation = epoch, result = try await api.snapshot(auth)
        if generation == epoch { snapshot = result; stale = false }
    }
    func openJob(_ id: String) async {
        guard let auth = session else { return }
        selectedID = id; detail = nil; error = nil
        let generation = epoch
        do { let job = try await api.details(auth, id: id); if generation == epoch && selectedID == id { detail = job } }
        catch { if generation == epoch { fail(error) } }
    }
    func closeJob() { selectedID = nil; detail = nil }
    func scan(_ code: String) async {
        await perform { auth in
            guard !code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, code.count <= 1000 else { throw FieldAPIError(status: 0, message: "Geçerli bir etiket kodu girin.") }
            self.scanResult = nil
            self.scanResult = try await self.api.scan(auth, code: code.trimmingCharacters(in: .whitespacesAndNewlines))
        }
    }
    func toggle(_ item: ChecklistItem) async {
        guard let id = selectedID else { return }
        await mutation(path: "work-orders/\(id)/checklist/\(item.id)", value: ChecklistInput(completed: !item.completed))
    }
    func comment(_ text: String) async {
        guard let id = selectedID else { return }
        await mutation(path: "work-orders/\(id)/comments", value: CommentInput(body: text.trimmingCharacters(in: .whitespacesAndNewlines)))
    }
    func transition(_ status: String, reason: String? = nil) async {
        guard let id = selectedID else { return }
        await mutation(path: "work-orders/\(id)/transition", value: TransitionInput(status: status, blockedReasonCategory: status == "blocked" ? "other" : nil, blockedReasonDetail: reason))
    }
    private func mutation<Input: Encodable>(path: String, value: Input) async {
        await perform(writing: true) { auth in
            let _: Accepted = try await self.api.post(auth, path: path, value: value, type: Accepted.self)
            self.message = "İşlem kaydedildi."
            await self.reloadAfterWrite(auth)
        }
    }
    func command(_ input: OperationInput) async {
        guard writable else { return }
        let value = ProductionCommand(commandId: UUID().uuidString.lowercased(), action: "operation", data: input)
        do { try vault.save("pending", value: value); pending = value }
        catch { fail(error); return }
        await retryCommand()
    }
    func retryCommand() async {
        guard let value = pending else { return }
        await perform(writing: true, retry: true) { auth in
            do {
                let result = try await self.api.command(auth, value: value)
                self.vault.remove("pending"); self.pending = nil
                self.message = result.qualityRejected == true ? "Kalite kontrol başarısız. Operasyon bloke edildi." : "Üretim işlemi kaydedildi."
                await self.reloadAfterWrite(auth)
            } catch let error as FieldAPIError {
                if [400, 403, 404, 409, 413, 415].contains(error.status) { self.vault.remove("pending"); self.pending = nil }
                throw error
            }
        }
    }
    func uploadPhoto(jobID: String, bytes: Data) async -> String? {
        var url: String?
        await perform(writing: true) { auth in
            guard bytes.count <= 2_000_000 else { throw FieldAPIError(status: 0, message: "Fotoğraf çok büyük. Daha küçük bir fotoğraf seçin.") }
            let result: PhotoResult = try await self.api.post(auth, path: "files", value: PhotoInput(base64: bytes.base64EncodedString(), workOrderId: jobID), type: PhotoResult.self)
            url = result.url
        }
        return url
    }
    private func reloadAfterWrite(_ auth: Session) async {
        do {
            try await loadSnapshot(auth)
            if let id = selectedID { let job = try await api.details(auth, id: id); if selectedID == id { detail = job } }
        } catch { fail(error) }
    }
    private func perform(writing: Bool = false, retry: Bool = false, action: (Session) async throws -> Void) async {
        guard let auth = session, !busy, !writing || retry || writable else { return }
        let generation = epoch
        busy = true; error = nil
        defer { if generation == epoch { busy = false } }
        do { try checkExpiry(auth); try await action(auth) }
        catch { if generation == epoch { fail(error) } }
    }
    private func checkExpiry(_ auth: Session) throws { if auth.expiresAt <= Date() { throw FieldAPIError(status: 401, message: "Oturumunuz sona erdi.") } }
    private func fail(_ failure: Error) {
        if failure is CancellationError { return }
        if (failure as? FieldAPIError)?.status == 426 { updateRequired = true; stale = true; error = nil; return }
        if (failure as? FieldAPIError)?.status == 401 { logout(); busy = false; error = "Oturumunuz sona erdi. Yeniden giriş yapın." }
        else { stale = true; error = failure is URLError ? "Bağlantı kurulamadı. Son veriler gösteriliyor; yenilemeyi deneyin." : failure.localizedDescription }
    }
}
