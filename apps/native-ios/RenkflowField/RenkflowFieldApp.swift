import SwiftUI

@main struct RenkflowFieldApp: App {
    @StateObject private var lock=AppLock()
    @StateObject private var store = FieldStore()
    @Environment(\.scenePhase) private var phase
    init() {
        FieldBackgroundSync.register()
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--reset-session") { SecureVault().clear() }
        #endif
    }
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store).environmentObject(lock).tint(FieldColor.accent).foregroundStyle(FieldColor.text)
                .task { FieldBackgroundSync.foregroundStore=store; await store.restore() }
                .onChange(of: phase) { _, value in if value == .active { Task { await store.foreground() } } else if value == .background { lock.lock();FieldBackgroundSync.schedule() } }
        }
    }
}
