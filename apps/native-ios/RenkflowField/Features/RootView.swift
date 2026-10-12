import SwiftUI

struct RootView: View {
    @EnvironmentObject private var lock:AppLock
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var store: FieldStore
    @State private var tab = 0
    @State private var operation: ProductionOperation?
    var body: some View {
        Group {
            if store.updateRequired {
                VStack(spacing: 24) {
                    Image(systemName: "arrow.down.app").font(.system(size: 48)).foregroundStyle(FieldColor.accent)
                    Text(L("text_guncelleme_gerekli_089dc")).font(.title2.bold())
                    Text(L("text_yeni_renkflow_saha_surumunu_kurun_bekleyen_islem_61fc9")).multilineTextAlignment(.center)
                }.padding(32).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.restoring {
                VStack(spacing: 28) { Brand(); ProgressView().tint(FieldColor.onInk) }.frame(maxWidth: .infinity, maxHeight: .infinity).background(FieldColor.ink)
            } else if store.session != nil && (scenePhase != .active || lock.enabled && !lock.unlocked) {
                VStack(spacing:24) {
                    Image(systemName:"lock.fill").font(.system(size:48)).accessibilityLabel(L("text_uygulama_kilitli_3853e"))
                    Text(L("text_renkflow_saha_671f9")).font(.title.bold())
                    if let message=lock.message {Text(message)}
                    if scenePhase == .active {Button(L("text_kilidi_ac_5ff1b")) {Task {await lock.unlock()}}.buttonStyle(FieldButton())}
                }.padding(24)
            } else if store.session == nil { LoginView() }
            else {
                NavigationStack {
                    VStack(spacing: 0) {
                        banners
                        TabView(selection: $tab) {
                            HomeView(scan: { tab = 3 }, operation: { operation = $0 }).tabItem { Label(L("text_saha_2ee48"), systemImage: "square.grid.2x2") }.tag(0)
                            if store.references?.capabilities.productionView != false {
                            Group {
                                if horizontalSizeClass == .regular {
                                    HStack(spacing:0) {
                                        JobsView().frame(width:340)
                                        Divider()
                                        if let job=store.detail {JobDetailView(job:job,operation:{operation=$0}).frame(maxWidth:.infinity)} else {ContentUnavailableView(L("text_is_emirleri_d8461"),systemImage:"list.clipboard",description:Text(L("text_onceliginiz_ve_bir_sonraki_adiminiz_6f665"))).frame(maxWidth:.infinity)}
                                    }
                                } else {JobsView()}
                            }.tabItem { Label(L("text_isler_fd39e"), systemImage: "list.clipboard") }.tag(1)
                            ProductionView(operation: { operation = $0 }).tabItem { Label(L("text_uretim_0d3d1"), systemImage: "gearshape.2") }.tag(2)
                            }
                            ScanView().tabItem { Label(L("text_tara_11607"), systemImage: "qrcode.viewfinder") }.tag(3)
                            ProfileView().tabItem { Label(L("text_hesap_1c56a"), systemImage: "person.crop.circle") }.tag(4)
                        }
                    }
                    .navigationTitle("renkflow")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { Task { await store.refresh() } } label: { Image(systemName: "arrow.clockwise") }.disabled(store.busy).accessibilityLabel(L("text_verileri_yenile_1db09")) } }
                    .navigationDestination(isPresented: Binding(get: { store.selectedID != nil && !(horizontalSizeClass == .regular && tab==1) }, set: { if !$0 && !(horizontalSizeClass == .regular && tab==1) { store.closeJob() } })) {
                        VStack(spacing: 0) {
                            banners
                            if let job = store.detail { JobDetailView(job: job, operation: { operation = $0 }) }
                            else { EmptyState(title: L("text_is_emri_yukleniyor_adba4"), subtitle: L("text_baglantiyi_kontrol_edip_yenileyebilirsiniz_c97fa"), icon: "list.clipboard") }
                        }.navigationTitle(L("text_is_emri_10fe2")).navigationBarTitleDisplayMode(.inline)
                            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { Task { await store.refresh() } } label: { Image(systemName: "arrow.clockwise") }.disabled(store.busy).accessibilityLabel(L("text_verileri_yenile_1db09")) } }
                    }
                }
                .sheet(item: $operation) { OperationView(operation: $0).environmentObject(store) }
            }
        }.sensoryFeedback(.success,trigger:store.message).sensoryFeedback(.error,trigger:store.error)
        .onChange(of: store.session?.user.id) { _, _ in tab = 0; operation = nil }
    }
    @ViewBuilder private var banners: some View {
        if store.busy { ProgressView().frame(maxWidth: .infinity).padding(8) }
        if let error = store.error { banner(error, error: true) { store.error = nil } }
        if let message = store.message { banner(message, error: false) { store.message = nil } }
        SyncStatusView()

    }
    private func banner(_ text: String, error: Bool, dismiss: @escaping () -> Void) -> some View {
        HStack { Text(text).font(.subheadline); Spacer(); Button(action: dismiss) { Image(systemName: "xmark") }.accessibilityLabel(L("text_bildirimi_kapat_b034a")) }
            .padding(14).background(error ? FieldColor.error.opacity(0.12) : FieldColor.accent.opacity(0.12))
    }
}

private struct SyncStatusView: View {
    @EnvironmentObject var store: FieldStore
    var issue: OutboxRecord? {store.outbox.first {$0.state=="conflict" || $0.state=="blocked" || $0.state=="corrupt"}}
    var body: some View {
        VStack(spacing:8) {
            HStack(spacing:12) {
                Image(systemName:store.stale ? "wifi.slash" : store.syncing || !store.outbox.isEmpty ? "icloud.and.arrow.up" : "checkmark.icloud").accessibilityLabel(store.stale ? L("text_cevrimdisi_47108") : L("text_esitleme_durumu_ab6d6"))
                VStack(alignment:.leading) {Text(store.stale ? L("text_cevrimdisi_47108") : store.syncing ? L("text_esitleniyor_b1a3a") : L("text_esitleme_30651")).font(.subheadline.bold());if let time=store.lastSync {Text(time,style:.time).font(.caption).foregroundStyle(.secondary)}}
                Spacer()
                if !store.outbox.isEmpty {Text("\(store.outbox.count)").font(.subheadline.monospacedDigit().bold()).padding(8).background(FieldColor.accent.opacity(0.12),in:Capsule()).accessibilityLabel(L("text_1_bekleyen_islem_c7f26", String(describing: store.outbox.count)))}
                Button {Task {await store.sync()}} label:{Image(systemName:"arrow.triangle.2.circlepath").frame(minWidth:48,minHeight:48)}.disabled(store.syncing || store.updateRequired).accessibilityLabel(L("text_simdi_esitle_f9e46"))
            }.padding(.horizontal,16).background(FieldColor.card)
            if let issue {
                VStack(alignment:.leading,spacing:8) {
                    Text(issue.state=="conflict" ? L("text_sunucudaki_kayit_degismis_8ac59") : L("text_islem_uygulanamadi_33a9a")).font(.subheadline.bold())
                    Text(issue.kind=="operation" ? L("text_uretim_bildirimi_ee55b") : issue.kind=="photo" ? L("text_saha_fotografi_655b0") : issue.kind=="checklist" ? L("text_kontrol_listesi_4914c") : L("text_saha_kaydi_8394f")).font(.caption)
                    Text(issue.reason ?? L("text_islemi_inceleyin_74943")).font(.subheadline)
                    HStack {
                        if issue.state=="conflict" && issue.canRetry {Button(L("text_yine_de_uygula_4e5b5")) {Task {await store.reapply(issue)}}.buttonStyle(FieldButton())}
                        Button(L("text_vazgec_39a8d")) {Task {await store.discard(issue)}}.buttonStyle(FieldButton(bright:true))
                    }.disabled(store.syncing || store.busy)
                }.padding(16).frame(maxWidth:.infinity,alignment:.leading).background(FieldColor.card).clipShape(RoundedRectangle(cornerRadius:12)).padding(.horizontal,16)
            }
        }
    }
}
