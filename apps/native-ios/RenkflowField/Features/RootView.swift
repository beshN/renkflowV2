import SwiftUI

struct RootView: View {
    @EnvironmentObject private var lock:AppLock
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var store: FieldStore
    @State private var tab = 0
    @State private var operation: ProductionOperation?
    var body: some View {
        Group {
            if store.updateRequired {
                VStack(spacing: 24) {
                    Image(systemName: "arrow.down.app").font(.system(size: 48)).foregroundStyle(FieldColor.accent)
                    Text("Güncelleme gerekli").font(.title2.bold())
                    Text("Yeni RenkFlow Saha sürümünü kurun. Bekleyen işlemleriniz korunuyor.").multilineTextAlignment(.center)
                }.padding(32).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.restoring {
                VStack(spacing: 28) { Brand(); ProgressView().tint(FieldColor.onInk) }.frame(maxWidth: .infinity, maxHeight: .infinity).background(FieldColor.ink)
            } else if store.session != nil && (scenePhase != .active || lock.enabled && !lock.unlocked) {
                VStack(spacing:24) {
                    Image(systemName:"lock.fill").font(.system(size:48)).accessibilityLabel("Uygulama kilitli")
                    Text("RenkFlow Saha").font(.title.bold())
                    if let message=lock.message {Text(message)}
                    if scenePhase == .active {Button("Kilidi aç") {Task {await lock.unlock()}}.buttonStyle(FieldButton())}
                }.padding(24)
            } else if store.session == nil { LoginView() }
            else {
                NavigationStack {
                    VStack(spacing: 0) {
                        banners
                        TabView(selection: $tab) {
                            HomeView(scan: { tab = 3 }, operation: { operation = $0 }).tabItem { Label("Saha", systemImage: "square.grid.2x2") }.tag(0)
                            if store.references?.capabilities.productionView != false {
                            JobsView().tabItem { Label("İşler", systemImage: "list.clipboard") }.tag(1)
                            ProductionView(operation: { operation = $0 }).tabItem { Label("Üretim", systemImage: "gearshape.2") }.tag(2)
                            }
                            ScanView().tabItem { Label("Tara", systemImage: "qrcode.viewfinder") }.tag(3)
                            ProfileView().tabItem { Label("Hesap", systemImage: "person.crop.circle") }.tag(4)
                        }
                    }
                    .navigationTitle("renkflow")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { Task { await store.refresh() } } label: { Image(systemName: "arrow.clockwise") }.disabled(store.busy).accessibilityLabel("Verileri yenile") } }
                    .navigationDestination(isPresented: Binding(get: { store.selectedID != nil }, set: { if !$0 { store.closeJob() } })) {
                        VStack(spacing: 0) {
                            banners
                            if let job = store.detail { JobDetailView(job: job, operation: { operation = $0 }) }
                            else { EmptyState(title: "İş emri yükleniyor", subtitle: "Bağlantıyı kontrol edip yenileyebilirsiniz.", icon: "list.clipboard") }
                        }.navigationTitle("İş emri").navigationBarTitleDisplayMode(.inline)
                            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { Task { await store.refresh() } } label: { Image(systemName: "arrow.clockwise") }.disabled(store.busy).accessibilityLabel("Verileri yenile") } }
                    }
                }
                .sheet(item: $operation) { OperationView(operation: $0).environmentObject(store) }
            }
        }.onChange(of: store.session?.user.id) { _, _ in tab = 0; operation = nil }
    }
    @ViewBuilder private var banners: some View {
        if store.busy { ProgressView().frame(maxWidth: .infinity).padding(8) }
        if let error = store.error { banner(error, error: true) { store.error = nil } }
        if let message = store.message { banner(message, error: false) { store.message = nil } }
        SyncStatusView()

    }
    private func banner(_ text: String, error: Bool, dismiss: @escaping () -> Void) -> some View {
        HStack { Text(text).font(.subheadline); Spacer(); Button(action: dismiss) { Image(systemName: "xmark") }.accessibilityLabel("Bildirimi kapat") }
            .padding(14).background(error ? FieldColor.error.opacity(0.12) : FieldColor.accent.opacity(0.12))
    }
}

private struct SyncStatusView: View {
    @EnvironmentObject var store: FieldStore
    var issue: OutboxRecord? {store.outbox.first {$0.state=="conflict" || $0.state=="blocked" || $0.state=="corrupt"}}
    var body: some View {
        VStack(spacing:8) {
            HStack(spacing:12) {
                Image(systemName:store.stale ? "wifi.slash" : store.syncing || !store.outbox.isEmpty ? "icloud.and.arrow.up" : "checkmark.icloud").accessibilityLabel(store.stale ? "Çevrimdışı" : "Eşitleme durumu")
                VStack(alignment:.leading) {Text(store.stale ? "Çevrimdışı" : store.syncing ? "Eşitleniyor" : "Eşitleme").font(.subheadline.bold());if let time=store.lastSync {Text(time,style:.time).font(.caption).foregroundStyle(.secondary)}}
                Spacer()
                if !store.outbox.isEmpty {Text("\(store.outbox.count)").font(.subheadline.monospacedDigit().bold()).padding(8).background(FieldColor.accent.opacity(0.12),in:Capsule()).accessibilityLabel("\(store.outbox.count) bekleyen işlem")}
                Button {Task {await store.sync()}} label:{Image(systemName:"arrow.triangle.2.circlepath").frame(minWidth:48,minHeight:48)}.disabled(store.syncing || store.updateRequired).accessibilityLabel("Şimdi eşitle")
            }.padding(.horizontal,16).background(FieldColor.card)
            if let issue {
                VStack(alignment:.leading,spacing:8) {
                    Text(issue.state=="conflict" ? "Sunucudaki kayıt değişmiş" : "İşlem uygulanamadı").font(.subheadline.bold())
                    Text(issue.kind=="operation" ? "Üretim bildirimi" : issue.kind=="photo" ? "Saha fotoğrafı" : issue.kind=="checklist" ? "Kontrol listesi" : "Saha kaydı").font(.caption)
                    Text(issue.reason ?? "İşlemi inceleyin.").font(.subheadline)
                    HStack {
                        if issue.state=="conflict" && issue.canRetry {Button("Yine de uygula") {Task {await store.reapply(issue)}}.buttonStyle(FieldButton())}
                        Button("Vazgeç") {Task {await store.discard(issue)}}.buttonStyle(FieldButton(bright:true))
                    }.disabled(store.syncing || store.busy)
                }.padding(16).frame(maxWidth:.infinity,alignment:.leading).background(FieldColor.card).clipShape(RoundedRectangle(cornerRadius:12)).padding(.horizontal,16)
            }
        }
    }
}
