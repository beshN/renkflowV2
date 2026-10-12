import SwiftUI
import PhotosUI
import ImageIO
import UIKit

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
    @State private var rework=false
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
                    if let reason = operation.reason { Text(reason).foregroundStyle(FieldColor.error) }
                }
                if ["ready", "paused", "blocked"].contains(operation.status) {
                    Section { Button { submit("start") } label: { Label(L("text_uretimi_baslat_9c3f4"), systemImage: "play.fill") }.buttonStyle(FieldButton()).disabled(!canWrite) }
                }
                if operation.status == "running" {
                    Section { Button { submit("pause") } label: { Label(L("text_duraklat_19b6a"), systemImage: "pause.fill") }.buttonStyle(FieldButton()).disabled(!canWrite) }
                    Section(L("text_tamamlanan_miktar_c35e7")) { TextField(L("text_adet_fb2a0"), text: $count).keyboardType(.numberPad).accessibilityLabel(L("text_tamamlanan_adet_0e48d")) }
                    ForEach(operation.qualityChecks) { check in
                        Section(check.name) {
                            if check.kind == "pass_fail" {
                                HStack {
                                    Button { passes[check.id] = true } label: { Label(L("text_gecti_06942"), systemImage: passes[check.id] == true ? "checkmark.circle.fill" : "circle") }
                                    Spacer()
                                    Button { passes[check.id] = false } label: { Label(L("text_kaldi_3d982"), systemImage: passes[check.id] == false ? "xmark.circle.fill" : "circle") }.tint(FieldColor.error)
                                }.buttonStyle(.borderless)
                            } else if check.kind == "measurement" {
                                Text("\(quantity(check.minimum ?? 0)) – \(quantity(check.maximum ?? 0)) \(check.unit)").font(.caption).foregroundStyle(.secondary)
                                TextField(L("text_olcum_1_1cc7a", String(describing: check.unit)), text: Binding(get: { values[check.id] ?? "" }, set: { values[check.id] = $0 })).keyboardType(.numbersAndPunctuation)
                            } else if check.kind == "photo" { Label(L("text_yeni_fotograf_gerekli_2a5e5"), systemImage: "camera").foregroundStyle(FieldColor.error) }
                        }
                    }
                    Section(L("text_is_fotografi_67a08")) {
                        PhotosPicker(selection: $photoItem, matching: .images) { Label(photoURL == nil ? L("text_fotograf_ekle_81995") : L("text_fotograf_eklendi_d9a66"), systemImage: photoURL == nil ? "photo.badge.plus" : "checkmark.circle") }.disabled(!canWrite)
                        if preparing { ProgressView(L("text_fotograf_hazirlaniyor_68711")) }
                        if let photoError { Text(photoError).foregroundStyle(FieldColor.error) }
                    }
                    Section(L("text_uretim_notu_a9731")) { TextField(L("text_istege_bagli_fd278"), text: $note, axis: .vertical).lineLimit(2...6) }
                    Section { Button(L("text_tamamlanan_miktari_kaydet_8737f")) { confirm = true }.disabled(!canWrite || !validQuantity || !qualityValid || note.count > 2000) }
                }
                if ["paused","blocked","done"].contains(operation.status) {Section {Button(L("text_yeniden_isleme_rework_4f689")) {rework=true}.frame(minHeight:48).disabled(!canWrite)}}
                if ["waiting", "done", "cancelled"].contains(operation.status) {
                    Section { Text(operation.status == "waiting" ? L("text_onceki_adimlar_tamamlandiginda_bu_operasyon_hazi_d2bc2") : operation.status == "done" ? L("text_bu_adim_tamamlandi_5fe67") : L("text_bu_operasyon_iptal_edilmis_85982")).foregroundStyle(.secondary) }
                }
                if let error = store.error { Section { Text(error).foregroundStyle(FieldColor.error) } }
            }.navigationTitle(L("text_uretim_adimi_7c2b3")).navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } } }
                .interactiveDismissDisabled(preparing || store.busy)
                .sheet(isPresented:$rework) {ReworkView(operation:operation).environmentObject(store)}
                .onAppear { count = String(Int(operation.plannedQty - operation.completedQty)) }
                .task(id: photoItem) {
                    guard let photoItem else { return }
                    preparing = true; photoError = nil
                    defer { preparing = false }
                    do {
                        guard let data = try await photoItem.loadTransferable(type: Data.self) else { throw FieldAPIError(status: 0, message: L("text_fotograf_okunamadi_c6d4b")) }
                        let bytes = try jpegForUpload(data)
                        photoURL = await store.uploadPhoto(jobID: operation.workOrderId, bytes: bytes)
                    } catch { photoError = error.localizedDescription }
                }
                .confirmationDialog(L("text_1_adet_kaydedilsin_mi_d43b8", String(describing: count)), isPresented: $confirm, titleVisibility: .visible) {
                    Button(L("text_kaydet_c1fe2")) { submit("complete") }
                } message: { Text(L("text_kalite_sonuclari_sunucuda_kontrol_edilecek_basar_51fbc")) }
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
        throw FieldAPIError(status: 0, message: L("text_fotograf_hazirlanamadi_veya_cok_buyuk_daha_kucuk_f082a"))
    }
    return bytes
}
