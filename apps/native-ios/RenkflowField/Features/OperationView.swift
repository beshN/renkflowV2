import SwiftUI
import PhotosUI
import ImageIO

struct OperationView: View {
    @EnvironmentObject private var store: FieldStore
    @Environment(\.dismiss) private var dismiss
    let operation: ProductionOperation
    @State private var count = ""
    @State private var note = ""
    @State private var values: [String: String] = [:]
    @State private var passes: [String: Bool] = [:]
    @State private var photoItem: PhotosPickerItem?
    @State private var photoURL: String?
    @State private var photoError: String?
    @State private var preparing = false
    @State private var confirm = false
    private var canWrite: Bool { store.writable && !preparing && (store.session?.user.role != "worker" || operation.assignedTo == store.session?.user.id) }
    private var validQuantity: Bool { if let value = Int(count), value > 0 { return Double(value) <= operation.plannedQty - operation.completedQty }; return false }
    private var qualityValid: Bool { operation.qualityChecks.allSatisfy { check in switch check.kind { case "pass_fail": return passes[check.id] != nil; case "measurement": return Double((values[check.id] ?? "").replacingOccurrences(of: ",", with: "."))?.isFinite == true; case "photo": return photoURL != nil; default: return false } } }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    StatusPill(status: operation.status)
                    Text(operation.name).font(.title2.bold())
                    Text("\(operation.workCenterCode) · \(quantity(operation.completedQty)) / \(quantity(operation.plannedQty)) adet").foregroundStyle(.secondary)
                    if let reason = operation.reason { Text(reason).foregroundStyle(FieldColor.clay) }
                }
                if ["ready", "paused", "blocked"].contains(operation.status) {
                    Section { Button { submit("start") } label: { Label("Üretimi başlat", systemImage: "play.fill") }.disabled(!canWrite) }
                }
                if operation.status == "running" {
                    Section { Button { submit("pause") } label: { Label("Duraklat", systemImage: "pause.fill") }.disabled(!canWrite) }
                    Section("Tamamlanan miktar") { TextField("Adet", text: $count).keyboardType(.numberPad).accessibilityLabel("Tamamlanan adet") }
                    ForEach(operation.qualityChecks) { check in
                        Section(check.name) {
                            if check.kind == "pass_fail" {
                                HStack {
                                    Button { passes[check.id] = true } label: { Label("Geçti", systemImage: passes[check.id] == true ? "checkmark.circle.fill" : "circle") }
                                    Spacer()
                                    Button { passes[check.id] = false } label: { Label("Kaldı", systemImage: passes[check.id] == false ? "xmark.circle.fill" : "circle") }.tint(FieldColor.clay)
                                }.buttonStyle(.borderless)
                            } else if check.kind == "measurement" {
                                Text("\(quantity(check.minimum ?? 0)) – \(quantity(check.maximum ?? 0)) \(check.unit)").font(.caption).foregroundStyle(.secondary)
                                TextField("Ölçüm (\(check.unit))", text: Binding(get: { values[check.id] ?? "" }, set: { values[check.id] = $0 })).keyboardType(.numbersAndPunctuation)
                            } else if check.kind == "photo" { Label("Yeni fotoğraf gerekli", systemImage: "camera").foregroundStyle(FieldColor.clay) }
                        }
                    }
                    Section("İş fotoğrafı") {
                        PhotosPicker(selection: $photoItem, matching: .images) { Label(photoURL == nil ? "Fotoğraf ekle" : "Fotoğraf yüklendi", systemImage: photoURL == nil ? "photo.badge.plus" : "checkmark.circle") }.disabled(!canWrite)
                        if preparing { ProgressView("Fotoğraf hazırlanıyor…") }
                        if let photoError { Text(photoError).foregroundStyle(FieldColor.clay) }
                    }
                    Section("Üretim notu") { TextField("İsteğe bağlı", text: $note, axis: .vertical).lineLimit(2...6) }
                    Section { Button("Tamamlanan miktarı kaydet") { confirm = true }.disabled(!canWrite || !validQuantity || !qualityValid || note.count > 2000) }
                }
                if ["waiting", "done", "cancelled"].contains(operation.status) {
                    Section { Text(operation.status == "waiting" ? "Önceki adımlar tamamlandığında bu operasyon hazır olacak." : operation.status == "done" ? "Bu adım tamamlandı." : "Bu operasyon iptal edilmiş.").foregroundStyle(.secondary) }
                }
                if let error = store.error { Section { Text(error).foregroundStyle(FieldColor.clay) } }
            }.navigationTitle("Üretim adımı").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } } }
                .interactiveDismissDisabled(preparing || store.busy)
                .onAppear { count = String(Int(operation.plannedQty - operation.completedQty)) }
                .task(id: photoItem) {
                    guard let photoItem else { return }
                    preparing = true; photoError = nil
                    defer { preparing = false }
                    do {
                        guard let data = try await photoItem.loadTransferable(type: Data.self) else { throw FieldAPIError(status: 0, message: "Fotoğraf okunamadı.") }
                        let bytes = try jpegForUpload(data)
                        photoURL = await store.uploadPhoto(jobID: operation.workOrderId, bytes: bytes)
                    } catch { photoError = error.localizedDescription }
                }
                .confirmationDialog("\(count) adet kaydedilsin mi?", isPresented: $confirm, titleVisibility: .visible) {
                    Button("Kaydet") { submit("complete") }
                } message: { Text("Kalite sonuçları sunucuda kontrol edilecek. Başarısız kontrol operasyonu bloke eder.") }
        }
    }
    private func submit(_ action: String) {
        guard canWrite else { return }
        let results = action == "complete" ? operation.qualityChecks.map { check in QualityResult(checkId: check.id, passed: check.kind == "pass_fail" ? passes[check.id] : check.kind == "photo" ? true : nil, value: check.kind == "measurement" ? Double((values[check.id] ?? "").replacingOccurrences(of: ",", with: ".")) : nil) } : []
        let input = OperationInput(operationId: operation.id, version: operation.version, action: action, quantity: action == "complete" ? Int(count) : nil, reason: note.isEmpty ? nil : note, qualityResults: results, photos: photoURL.map { [$0] } ?? [])
        Task { await store.command(input); dismiss() }
    }
}

func jpegForUpload(_ data: Data) throws -> Data {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 1600, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary),
          let bytes = UIImage(cgImage: thumbnail).jpegData(compressionQuality: 0.75), bytes.count <= 2_000_000 else {
        throw FieldAPIError(status: 0, message: "Fotoğraf hazırlanamadı veya çok büyük. Daha küçük bir fotoğraf seçin.")
    }
    return bytes
}
