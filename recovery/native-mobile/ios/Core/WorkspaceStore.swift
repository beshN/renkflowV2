// Recovery copy from session output and recorded foreground-validation changes.
import Foundation
import Combine

@MainActor final class WorkspaceStore: ObservableObject {
    @Published var identity:WorkspaceIdentity?
    @Published var restoring=true
    @Published var signingIn=false
    @Published var needsCode=false
    @Published var error:String?
    @Published var access:JSONValue = .null
    @Published var revision=0
    let api:WorkspaceAPI
    private var epoch=0
    var origin:String {UserDefaults.standard.string(forKey:"field.server") ?? "https://renkflow.com"}
    init(api:WorkspaceAPI=WorkspaceAPI()) {self.api=api}
    func restore() async {
        guard restoring else {return}
        defer {restoring=false}
        let generation=epoch
        do {
            try await api.configure(origin)
            guard await api.hasSession() else {return}
            let user=try await api.identity()
            guard generation==epoch else {return}
            let permissions=try await api.request("/api/v1/me/access")
            guard generation==epoch else {return}
            identity=user;access=permissions
        } catch {
            if (error as? FieldAPIError)?.status==401 {await api.clear()}
        }
    }
    func foreground() async {
        guard identity != nil,!restoring,!signingIn else {return}
        let generation=epoch
        do {
            let user=try await api.identity()
            let permissions=try await api.request("/api/v1/me/access")
            guard generation==epoch else {return}
            identity=user;access=permissions
        } catch {
            guard generation==epoch else {return}
            if (error as? FieldAPIError)?.status==401 {epoch+=1;identity=nil;access = .null;self.error="Oturumunuz sona erdi. Yeniden giriş yapın.";await api.clear()}
        }
    }
    @discardableResult func signIn(server:String,email:String,password:String,otp:String?) async -> Bool {
        guard !signingIn,!restoring else {return false}
        signingIn=true;error=nil
        defer {signingIn=false}
        do {
            let origin=try normalizeServer(server)
            let user=try await api.signIn(server:origin,email:email,password:password,otp:needsCode ? otp : nil)
            let permissions=try await api.request("/api/v1/me/access")
            epoch+=1;UserDefaults.standard.set(origin,forKey:"field.server")
            identity=user;access=permissions;needsCode=false;revision+=1
            return true
        } catch {
            if (error as? FieldAPIError)?.status==428 {needsCode=true}
            self.error=error.localizedDescription
            return false
        }
    }
    func logout() async {
        epoch+=1;restoring=true;identity=nil;access = .null;error=nil;needsCode=false;revision+=1
        await api.signOut();restoring=false
    }
    func perform(_ path:String,method:String="GET",body:JSONValue?=nil) async throws -> JSONValue {
        let generation=epoch
        do {
            let response=try await api.request(path,method:method,body:body)
            guard generation==epoch else {throw CancellationError()}
            return response
        } catch {
            guard generation==epoch else {throw CancellationError()}
            if (error as? FieldAPIError)?.status==401 {
                epoch+=1;identity=nil;access = .null;self.error="Oturumunuz sona erdi. Yeniden giriş yapın."
                await api.clear()
            }
            throw error
        }
    }
    func can(_ module:String,_ action:String="view") -> Bool {
        if ["owner","admin"].contains(identity?.role ?? ""),!access["narrowed"].boolean {return true}
        return access["permissions"][module].array.contains {$0.string==action}
    }
}
