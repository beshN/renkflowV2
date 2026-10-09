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
                    VStack(alignment: .leading, spacing: 5) { Text("İyi çalışmalar,").foregroundStyle(.secondary); Text(store.session?.user.name?.components(separatedBy: " ").first ?? "RenkFlow").font(.largeTitle.bold()) }
                    Spacer(); Image(systemName: "person.fill.checkmark").font(.title).padding(18).background(FieldColor.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                }
                VStack(alignment: .leading, spacing: 20) {
                    Text("BUGÜNÜN AKIŞI").font(.caption.weight(.semibold)).tracking(2).foregroundStyle(FieldColor.onInk)
                    Text("İş hazır.\nSıra sizde.").font(.system(.largeTitle, design: .default, weight: .semibold)).foregroundStyle(.white)
                    HStack(spacing: 28) { metric(jobs.count, "Açık iş"); metric(operations.filter { $0.status == "running" }.count, "Çalışan adım"); metric(operations.filter { $0.status == "blocked" }.count, "Bloke") }
                    Button(action: scan) { Label("Etiket tara", systemImage: "qrcode.viewfinder") }.buttonStyle(FieldButton(bright: true))
                }.padding(24).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.ink, in: RoundedRectangle(cornerRadius: 12))
                if store.snapshot?.truncated == true { Text("Liste sınırına ulaşıldı. Etiket tarayarak belirli bir işe erişebilirsiniz.").font(.subheadline).foregroundStyle(FieldColor.error) }
                if store.references?.capabilities.installations==true {Button("Montaj ekibi işleri") {installations=true}.frame(minHeight:48).buttonStyle(.bordered)}
                SectionTitle(title: "Sıradaki operasyonlar", caption: "Başlatmak veya devam etmek için seçin")
                let active = operations.filter { ["running", "ready", "paused", "blocked"].contains($0.status) }
                if active.isEmpty { EmptyState(title: "Hazır operasyon yok", subtitle: "Size atanan yeni adımlar burada görünecek.", icon: "checkmark.circle") }
                ForEach(Array(active.prefix(4))) { op in OperationCard(operation: op, jobTitle: jobs.first { $0.id == op.workOrderId }?.title) { operation(op) } }
                SectionTitle(title: "Öncelikli işler", caption: "Açık iş emirleriniz")
                ForEach(Array(jobs.prefix(5))) { job in JobCard(job: job) { Task { await store.openJob(job.id) } } }
                if jobs.isEmpty { EmptyState(title: "İş listeniz boş", subtitle: "Atanan iş emirleri burada görünecek.", icon: "list.clipboard") }
                if let snapshot = store.snapshot { Text("Son güncelleme \(displayDate(snapshot.generatedAt))").font(.caption).foregroundStyle(.secondary) }
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
                SectionTitle(title: "İş emirleri", caption: "Önceliğiniz ve bir sonraki adımınız")
                HStack { Image(systemName: "magnifyingglass"); TextField("İş veya konum ara", text: $query).autocorrectionDisabled() }.fieldInput()
                Picker("Durum", selection: $filter) { Text("Tümü").tag("all"); Text("Açık").tag("open"); Text("Çalışan").tag("in_progress"); Text("Bloke").tag("blocked") }.pickerStyle(.segmented)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 16)], spacing: 16) { ForEach(jobs) { job in JobCard(job: job) { Task { await store.openJob(job.id) } } } }
                if jobs.isEmpty { EmptyState(title: "Eşleşen iş yok", subtitle: "Aramayı veya durum filtresini değiştirebilirsiniz.", icon: "magnifyingglass") }
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
                SectionTitle(title: "Üretim adımları", caption: "Her adımda güncel durum ve kalite kontrolü")
                CuttingPlansView(plans:store.snapshot?.cutPlans ?? [])
                Toggle("Yalnızca açık adımlar", isOn: $activeOnly)
                ForEach(operations) { op in OperationCard(operation: op, jobTitle: store.snapshot?.workOrders.first { $0.id == op.workOrderId }?.title) { operation(op) } }
                if operations.isEmpty { EmptyState(title: "Operasyon yok", subtitle: "Atanan üretim adımları burada listelenir.", icon: "gearshape.2") }
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
                if job.productionManaged == true { Text("Bu iş üretim adımları üzerinden ilerler.").font(.subheadline).foregroundStyle(.secondary) }
                else if store.snapshot?.permissions.transition == true {
                    VStack(spacing: 12) {
                        if ["open", "blocked"].contains(job.status) { Button("İşi başlat") { Task { await store.transition("in_progress") } }.buttonStyle(FieldButton()).disabled(!store.writable) }
                        if ["open", "in_progress"].contains(job.status) { Button("Bloke bildir") { blocking = true }.buttonStyle(.bordered).disabled(!store.writable) }
                        if job.status == "in_progress" && store.snapshot?.permissions.close == true { Button("Tamamla") { completing = true }.buttonStyle(FieldButton()).disabled(!store.writable) }
                    }
                }
                CuttingPlansView(plans:(store.snapshot?.cutPlans ?? []).filter {$0.bars.contains {bar in bar.pieces.contains {$0.workOrderId==job.id}}})
                FieldEventView(jobID:job.id)
                SectionTitle(title: "Kontrol listesi", caption: "Zorunlu adımları doğrulayın")
                ForEach(job.checklist ?? []) { item in
                    Button { Task { await store.toggle(item) } } label: {
                        HStack(spacing: 14) { Image(systemName: item.completed ? "checkmark.circle.fill" : "circle").font(.title2).foregroundStyle(FieldColor.accent); VStack(alignment: .leading, spacing: 4) { Text(item.title).foregroundStyle(.primary); if item.required { Text("Zorunlu").font(.caption).foregroundStyle(FieldColor.error) } }; Spacer() }
                            .padding(16).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 8))
                    }.buttonStyle(.plain).disabled(!store.writable || store.snapshot?.permissions.checklist != true).accessibilityLabel("\(item.title), \(item.completed ? "tamamlandı" : "bekliyor")")
                }
                if (job.checklist ?? []).isEmpty { Text("Bu işte kontrol listesi yok.").font(.subheadline).foregroundStyle(.secondary) }
                ForEach((store.snapshot?.operations ?? []).filter { $0.workOrderId == job.id }) { op in OperationCard(operation: op) { operation(op) } }
                SectionTitle(title: "Saha notları", caption: "Ekibinizle aynı bilgide kalın")
                ForEach(job.comments ?? []) { comment in
                    VStack(alignment: .leading, spacing: 8) { Text(comment.body); Text("\(comment.authorName ?? "Ekip") · \(displayDate(comment.createdAt))").font(.caption).foregroundStyle(.secondary) }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 8))
                }
                if store.snapshot?.permissions.comment == true {
                    TextField("Saha notu ekle", text: $note, axis: .vertical).lineLimit(3...6).fieldInput()
                    Button("Notu kaydet") { let value = note; Task { await store.comment(value); if store.error == nil { note = "" } } }.buttonStyle(FieldButton()).disabled(!store.writable || note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || note.count > 2000)
                }
            }.padding(20).fieldCanvas()
        }.background(FieldColor.background).refreshable { await store.refresh() }.scrollDismissesKeyboard(.interactively)
            .sheet(isPresented: $blocking) {
                NavigationStack { Form { Section("Ne engelliyor?") { TextField("En az 5 karakter açıklama", text: $reason, axis: .vertical).lineLimit(3...8) }; Button("Bloke bildir") { Task { await store.transition("blocked", reason: reason); blocking = false } }.disabled(!store.writable || reason.trimmingCharacters(in: .whitespacesAndNewlines).count < 5 || reason.count > 1000) }.navigationTitle("Bloke nedeni").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Vazgeç") { blocking = false } } } }.presentationDetents([.medium, .large])
            }
            .confirmationDialog("İş emri tamamlansın mı?", isPresented: $completing, titleVisibility: .visible) { Button("Tamamla") { Task { await store.transition("done") } } } message: { Text("Kontrol listesi ve son durum sunucuda doğrulanacak.") }
    }
}

struct ProfileView: View {
    @EnvironmentObject private var lock:AppLock
    @EnvironmentObject private var store: FieldStore
    @State private var logout = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                SectionTitle(title: "Hesabınız", caption: "RenkFlow Saha")
                VStack(alignment: .leading, spacing: 14) {
                    Text(store.session?.user.name ?? "RenkFlow").font(.title2.bold())
                    Text(store.session?.user.email ?? "")
                    Text(["worker": "Saha çalışanı", "office": "Operasyon", "owner": "Firma sahibi", "admin": "Yönetici"][store.session?.user.role ?? ""] ?? "Hesap").foregroundStyle(FieldColor.accent)
                    Divider(); Text(store.session?.server ?? "").font(.subheadline)
                }.padding(24).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 12))
                NotificationsView()
                Text("Üretim kayıtları firmanızın RenkFlow sistemine kaydedilir. Bağlantı kurulamadığında verileri yenileyin.").foregroundStyle(.secondary)
                Toggle("Uygulama kilidi",isOn:Binding(get:{lock.enabled},set:{enabled in if enabled {Task {await lock.unlock(enable:true)}} else {lock.disable()}})).frame(minHeight:48)
                if let message=lock.message {Text(message).foregroundStyle(FieldColor.error)}
                Button(role: .destructive) { logout = true } label: { Label("Çıkış yap", systemImage: "rectangle.portrait.and.arrow.right").frame(maxWidth: .infinity).padding(12) }.buttonStyle(.bordered).disabled(store.busy || store.pending != nil)
                Text("Sürüm \(MobileContract.version)").font(.caption).foregroundStyle(.secondary)
            }.padding(24).fieldCanvas()
        }.background(FieldColor.background)
            .confirmationDialog("Çıkış yapılsın mı?", isPresented: $logout, titleVisibility: .visible) { Button("Çıkış yap", role: .destructive) { store.logout() } } message: { Text("Bu cihazdaki oturumunuz temizlenecek.") }
    }
}
