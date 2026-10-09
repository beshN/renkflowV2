import SwiftUI

struct RootView: View {
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
            } else if store.session == nil { LoginView() }
            else {
                NavigationStack {
                    VStack(spacing: 0) {
                        banners
                        TabView(selection: $tab) {
                            HomeView(scan: { tab = 3 }, operation: { operation = $0 }).tabItem { Label("Saha", systemImage: "square.grid.2x2") }.tag(0)
                            JobsView().tabItem { Label("İşler", systemImage: "list.clipboard") }.tag(1)
                            ProductionView(operation: { operation = $0 }).tabItem { Label("Üretim", systemImage: "gearshape.2") }.tag(2)
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
        if store.stale && store.snapshot != nil { Text("Son alınan veriler • İşlem için yenileyin").font(.caption).foregroundStyle(FieldColor.error).padding(8) }
        if store.pending != nil {
            HStack(spacing: 12) {
                VStack(alignment: .leading) { Text("İşlemin sonucu bekleniyor").font(.subheadline.bold()); Text("Aynı işlemi güvenle tekrar sorgulayın.").font(.caption) }
                Spacer()
                Button("Tekrar dene") { Task { await store.retryCommand() } }.disabled(store.busy)
            }.padding(14).background(FieldColor.accent.opacity(0.12))
        }
    }
    private func banner(_ text: String, error: Bool, dismiss: @escaping () -> Void) -> some View {
        HStack { Text(text).font(.subheadline); Spacer(); Button(action: dismiss) { Image(systemName: "xmark") }.accessibilityLabel("Bildirimi kapat") }
            .padding(14).background(error ? FieldColor.error.opacity(0.12) : FieldColor.accent.opacity(0.12))
    }
}
