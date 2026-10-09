import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var store: FieldStore
    @State private var installations=false
    let scan: () -> Void; let operation: (ProductionOperation) -> Void
    private var jobs: [WorkOrder] { store.snapshot?.workOrders ?? [] }
    private var operations: [ProductionOperation] { store.snapshot?.operations ?? [] }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                HStack {
                    VStack(alignment: .leading, spacing: 5) { Text(L("text_iyi_calismalar_c024d")).foregroundStyle(.secondary); Text(store.session?.user.name?.components(separatedBy: " ").first ?? L("text_renkflow_6ac42")).font(.largeTitle.bold()) }
                    Spacer(); Image(systemName: "person.fill.checkmark").font(.title).padding(18).background(FieldColor.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                }
                VStack(alignment: .leading, spacing: 20) {
                    Text(L("text_bugunun_akisi_e3c32")).font(.caption.weight(.semibold)).tracking(2).foregroundStyle(FieldColor.onInk)
                    Text(L("text_is_hazir_sira_sizde_a7bfe")).font(.system(.largeTitle, design: .default, weight: .semibold)).foregroundStyle(.white)
                    HStack(spacing: 28) { metric(jobs.count, L("text_acik_is_709f6")); metric(operations.filter { $0.status == "running" }.count, L("text_calisan_adim_a84f5")); metric(operations.filter { $0.status == "blocked" }.count, L("text_bloke_9e16b")) }
                    Button(action: scan) { Label(L("text_etiket_tara_658b9"), systemImage: "qrcode.viewfinder") }.buttonStyle(FieldButton(bright: true))
                }.padding(24).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.ink, in: RoundedRectangle(cornerRadius: 12))
                if store.snapshot?.truncated == true { Text(L("text_liste_sinirina_ulasildi_etiket_tarayarak_belirli_7e7b6")).font(.subheadline).foregroundStyle(FieldColor.error) }
                if store.references?.capabilities.installations==true {Button(L("text_montaj_ekibi_isleri_418a5")) {installations=true}.frame(minHeight:48).buttonStyle(.bordered)}
                SectionTitle(title: L("text_siradaki_operasyonlar_99c52"), caption: L("text_baslatmak_veya_devam_etmek_icin_secin_393a8"))
                let active = operations.filter { ["running", "ready", "paused", "blocked"].contains($0.status) }
                if active.isEmpty { EmptyState(title: L("text_hazir_operasyon_yok_c826f"), subtitle: L("text_size_atanan_yeni_adimlar_burada_gorunecek_1109f"), icon: "checkmark.circle") }
                ForEach(Array(active.prefix(4))) { op in OperationCard(operation: op, jobTitle: jobs.first { $0.id == op.workOrderId }?.title) { operation(op) } }
                SectionTitle(title: L("text_oncelikli_isler_2c513"), caption: L("text_acik_is_emirleriniz_015d7"))
                ForEach(Array(jobs.prefix(5))) { job in JobCard(job: job) { Task { await store.openJob(job.id) } } }
                if jobs.isEmpty { EmptyState(title: L("text_is_listeniz_bos_de4a8"), subtitle: L("text_atanan_is_emirleri_burada_gorunecek_492b5"), icon: "list.clipboard") }
                if let snapshot = store.snapshot { Text(L("text_son_guncelleme_1_488f0", String(describing: displayDate(snapshot.generatedAt)))).font(.caption).foregroundStyle(.secondary) }
            }.padding(20).fieldCanvas()
        }.background(FieldColor.background).refreshable { await store.refresh() }.sheet(isPresented:$installations) {InstallationView().environmentObject(store)}
    }
    private func metric(_ value: Int, _ label: String) -> some View { VStack(alignment: .leading, spacing: 4) { Text(value.formatted()).font(.largeTitle.bold()).foregroundStyle(.white); Text(label).font(.caption).foregroundStyle(.white.opacity(0.72)) } }
}

struct JobsView: View {
    @EnvironmentObject private var store: FieldStore
    @State private var query = ""
    @State private var filter = "all"
    private var jobs: [WorkOrder] { (store.snapshot?.workOrders ?? []).filter { (filter == "all" || $0.status == filter) && (query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) || ($0.location ?? "").localizedCaseInsensitiveContains(query)) } }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                SectionTitle(title: L("text_is_emirleri_d8461"), caption: L("text_onceliginiz_ve_bir_sonraki_adiminiz_6f665"))
                HStack { Image(systemName: "magnifyingglass"); TextField(L("text_is_veya_konum_ara_ad84a"), text: $query).autocorrectionDisabled() }.fieldInput()
                Picker(L("text_durum_8bd05"), selection: $filter) { Text(L("text_tumu_f43a6")).tag("all"); Text(L("text_acik_bbb11")).tag("open"); Text(L("text_calisan_0f548")).tag("in_progress"); Text(L("text_bloke_9e16b")).tag("blocked") }.pickerStyle(.segmented)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 16)], spacing: 16) { ForEach(jobs) { job in JobCard(job: job) { Task { await store.openJob(job.id) } } } }
                if jobs.isEmpty { EmptyState(title: L("text_eslesen_is_yok_3f481"), subtitle: L("text_aramayi_veya_durum_filtresini_degistirebilirsini_d6ed2"), icon: "magnifyingglass") }
            }.padding(20).fieldCanvas()
        }.background(FieldColor.background).refreshable { await store.refresh() }.scrollDismissesKeyboard(.interactively)
    }
}

struct ProductionView: View {
    @EnvironmentObject private var store: FieldStore
    @State private var activeOnly = true
    let operation: (ProductionOperation) -> Void
    private var operations: [ProductionOperation] { (store.snapshot?.operations ?? []).filter { !activeOnly || !["done", "cancelled"].contains($0.status) } }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                SectionTitle(title: L("text_uretim_adimlari_8d861"), caption: L("text_her_adimda_guncel_durum_ve_kalite_kontrolu_8de56"))
                CuttingPlansView(plans:store.snapshot?.cutPlans ?? [])
                Toggle(L("text_yalnizca_acik_adimlar_5fe29"), isOn: $activeOnly)
                ForEach(operations) { op in OperationCard(operation: op, jobTitle: store.snapshot?.workOrders.first { $0.id == op.workOrderId }?.title) { operation(op) } }
                if operations.isEmpty { EmptyState(title: L("text_operasyon_yok_29cac"), subtitle: L("text_atanan_uretim_adimlari_burada_listelenir_64aed"), icon: "gearshape.2") }
            }.padding(20).fieldCanvas()
        }.background(FieldColor.background).refreshable { await store.refresh() }
    }
}

struct JobDetailView: View {
    @EnvironmentObject private var store: FieldStore
    let job: WorkOrder; let operation: (ProductionOperation) -> Void
    @State private var note = ""
    @State private var reason = ""
    @State private var blocking = false
    @State private var completing = false
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                StatusPill(status: job.status)
                Text(job.title).font(.title.bold())
                if let description = job.description { Text(description) }
                HStack { Text(priorityLabel(job.priority)).foregroundStyle(FieldColor.error); if let location = job.location { Label(location, systemImage: "mappin") } }.font(.subheadline)
                if let reason = job.blockedReasonDetail { Text(reason).foregroundStyle(FieldColor.error) }
                if job.productionManaged == true { Text(L("text_bu_is_uretim_adimlari_uzerinden_ilerler_e8d59")).font(.subheadline).foregroundStyle(.secondary) }
                else if store.snapshot?.permissions.transition == true {
                    VStack(spacing: 12) {
                        if ["open", "blocked"].contains(job.status) { Button(L("text_isi_baslat_50c33")) { Task { await store.transition("in_progress") } }.buttonStyle(FieldButton()).disabled(!store.writable) }
                        if ["open", "in_progress"].contains(job.status) { Button(L("text_bloke_bildir_aa95a")) { blocking = true }.buttonStyle(.bordered).disabled(!store.writable) }
                        if job.status == "in_progress" && store.snapshot?.permissions.close == true { Button(L("text_tamamla_d95ff")) { completing = true }.buttonStyle(FieldButton()).disabled(!store.writable) }
                    }
                }
                CuttingPlansView(plans:(store.snapshot?.cutPlans ?? []).filter {$0.bars.contains {bar in bar.pieces.contains {$0.workOrderId==job.id}}})
                FieldEventView(jobID:job.id)
                SectionTitle(title: L("text_kontrol_listesi_4914c"), caption: L("text_zorunlu_adimlari_dogrulayin_5c79a"))
                ForEach(job.checklist ?? []) { item in
                    Button { Task { await store.toggle(item) } } label: {
                        HStack(spacing: 14) { Image(systemName: item.completed ? "checkmark.circle.fill" : "circle").font(.title2).foregroundStyle(FieldColor.accent); VStack(alignment: .leading, spacing: 4) { Text(item.title).foregroundStyle(.primary); if item.required { Text(L("text_zorunlu_a0394")).font(.caption).foregroundStyle(FieldColor.error) } }; Spacer() }
                            .padding(16).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 8))
                    }.buttonStyle(.plain).disabled(!store.writable || store.snapshot?.permissions.checklist != true).accessibilityLabel(L("text_1_2_adb7e", String(describing: item.title), String(describing: item.completed ? L("field.completed") : L("field.pending"))))
                }
                if (job.checklist ?? []).isEmpty { Text(L("text_bu_iste_kontrol_listesi_yok_4adbe")).font(.subheadline).foregroundStyle(.secondary) }
                ForEach((store.snapshot?.operations ?? []).filter { $0.workOrderId == job.id }) { op in OperationCard(operation: op) { operation(op) } }
                SectionTitle(title: L("text_saha_notlari_7d9a6"), caption: L("text_ekibinizle_ayni_bilgide_kalin_51b74"))
                ForEach(job.comments ?? []) { comment in
                    VStack(alignment: .leading, spacing: 8) { Text(comment.body); Text("\(comment.authorName ?? "Ekip") · \(displayDate(comment.createdAt))").font(.caption).foregroundStyle(.secondary) }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 8))
                }
                if store.snapshot?.permissions.comment == true {
                    TextField(L("text_saha_notu_ekle_e9d60"), text: $note, axis: .vertical).lineLimit(3...6).fieldInput()
                    Button(L("text_notu_kaydet_04416")) { let value = note; Task { await store.comment(value); if store.error == nil { note = "" } } }.buttonStyle(FieldButton()).disabled(!store.writable || note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || note.count > 2000)
                }
            }.padding(20).fieldCanvas()
        }.background(FieldColor.background).refreshable { await store.refresh() }.scrollDismissesKeyboard(.interactively)
            .sheet(isPresented: $blocking) {
                NavigationStack { Form { Section(L("text_ne_engelliyor_09dfe")) { TextField(L("text_en_az_5_karakter_aciklama_cc2c9"), text: $reason, axis: .vertical).lineLimit(3...8) }; Button(L("text_bloke_bildir_aa95a")) { Task { await store.transition("blocked", reason: reason); blocking = false } }.disabled(!store.writable || reason.trimmingCharacters(in: .whitespacesAndNewlines).count < 5 || reason.count > 1000) }.navigationTitle(L("text_bloke_nedeni_345e2")).toolbar { ToolbarItem(placement: .cancellationAction) { Button(L("text_vazgec_39a8d")) { blocking = false } } } }.presentationDetents([.medium, .large])
            }
            .confirmationDialog(L("text_is_emri_tamamlansin_mi_07980"), isPresented: $completing, titleVisibility: .visible) { Button(L("text_tamamla_d95ff")) { Task { await store.transition("done") } } } message: { Text(L("text_kontrol_listesi_ve_son_durum_sunucuda_dogrulanac_f8705")) }
    }
}

struct ProfileView: View {
    @EnvironmentObject private var lock:AppLock
    @EnvironmentObject private var store: FieldStore
    @State private var logout = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                SectionTitle(title: L("text_hesabiniz_91e78"), caption: L("text_renkflow_saha_671f9"))
                VStack(alignment: .leading, spacing: 14) {
                    Text(store.session?.user.name ?? L("text_renkflow_6ac42")).font(.title2.bold())
                    Text(store.session?.user.email ?? "")
                    Text(["worker": L("text_saha_calisani_931cb"), "office": L("text_operasyon_fc6e7"), "owner": L("text_firma_sahibi_180a9"), "admin": L("text_yonetici_1a342")][store.session?.user.role ?? ""] ?? L("text_hesap_1c56a")).foregroundStyle(FieldColor.accent)
                    Divider(); Text(store.session?.server ?? "").font(.subheadline)
                }.padding(24).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 12))
                NotificationsView()
                Text(L("text_uretim_kayitlari_firmanizin_renkflow_sistemine_k_8131f")).foregroundStyle(.secondary)
                Toggle(L("text_uygulama_kilidi_52772"),isOn:Binding(get:{lock.enabled},set:{enabled in if enabled {Task {await lock.unlock(enable:true)}} else {lock.disable()}})).frame(minHeight:48)
                if let message=lock.message {Text(message).foregroundStyle(FieldColor.error)}
                Button(role: .destructive) { logout = true } label: { Label(L("text_cikis_yap_ea5b6"), systemImage: "rectangle.portrait.and.arrow.right").frame(maxWidth: .infinity).padding(12) }.buttonStyle(.bordered).disabled(store.busy || store.pending != nil)
                Text(L("text_surum_1_3975b", String(describing: MobileContract.version))).font(.caption).foregroundStyle(.secondary)
            }.padding(24).fieldCanvas()
        }.background(FieldColor.background)
            .confirmationDialog(L("text_cikis_yapilsin_mi_4c115"), isPresented: $logout, titleVisibility: .visible) { Button(L("text_cikis_yap_ea5b6"), role: .destructive) { store.logout() } } message: { Text(L("text_bu_cihazdaki_oturumunuz_temizlenecek_112d5")) }
    }
}
