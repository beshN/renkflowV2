import SwiftUI

@main struct RenkflowFieldApp: App {
    @StateObject private var store = FieldStore()
    @Environment(\.scenePhase) private var phase
    init() {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--reset-session") { SecureVault().clear() }
        #endif
    }
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store).tint(FieldColor.teal)
                .task { await store.restore() }
                .onChange(of: phase) { _, value in if value == .active { Task { await store.foreground() } } }
        }
    }
}
