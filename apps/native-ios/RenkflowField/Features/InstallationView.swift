import SwiftUI
import PhotosUI
struct InstallationView:View {
    @EnvironmentObject private var store:FieldStore
    @Environment(\.dismiss) private var dismiss
    @State private var today=true
    @State private var selected:String?
    @State private var issue=""
    @State private var kind="missing"
    @State private var photoItem:PhotosPickerItem?
    @State private var preparing=false
    @State private var photoMessage:String?
    private var writable:Bool {store.references?.capabilities.installationEdit==true && !store.accessBlocked && !store.updateRequired}
    private var day:String {let f=DateFormatter();f.locale=Locale(identifier:"en_US_POSIX");f.dateFormat="yyyy-MM-dd";return f.string(from:Date())}
    var body:some View {
        NavigationStack {
            List {
                if selected==nil {
                    Toggle(L("text_bugunku_ekip_isleri_29058"),isOn:$today)
                    let list=store.installations.filter {!today || $0.date==day}
                    if list.isEmpty {Text(L("text_bu_gun_icin_atanan_montaj_yok_c987e")).foregroundStyle(.secondary)}
                    ForEach(list) {job in
                        Button {selected=job.id;Task {await store.openInstallation(job.id)}} label:{
                            VStack(alignment:.leading,spacing:8) {Text(job.number).font(.headline);Text("\(job.date ?? "") \(job.startTime ?? "") · \(job.productName ?? "")");Text("\(job.checklistCompleted)/\(job.checklistTotal) kontrol").font(.caption)}.frame(minHeight:64)
                        }
                    }
                } else {
                    Button(L("text_listeye_don_bb341")) {selected=nil}.frame(minHeight:48)
                    if let detail=store.installationDetail,detail.id==selected {
                        Text(detail.status=="planned" ? L("text_planlandi_03e58") : detail.status=="in_progress" ? "Sahada" : L("text_tamamlandi_7c6f3")).font(.headline)
                        if writable && ["planned","in_progress"].contains(detail.status) {Button(detail.status=="planned" ? L("text_montaji_baslat_769f7") : L("text_montaji_tamamla_9f08c")) {Task {await store.installationCommand(detail.status=="planned" ? "start" : "complete")}}.buttonStyle(FieldButton())}
                        ForEach(detail.checklist) {item in
                            Button {Task {await store.installationCommand("checklist",item:item)}} label:{Label(item.title,systemImage:item.completed ? "checkmark.circle.fill" : "circle").frame(minHeight:48)}.disabled(!writable || ["done","cancelled"].contains(detail.status))
                        }
                        Text(L("text_1_saha_fotografi_f555f", String(describing: detail.photos?.count ?? 0)))
                        if let photoMessage {Text(photoMessage)}
                        if writable && !["done","cancelled"].contains(detail.status) {PhotosPicker(selection:$photoItem,matching:.images) {Label(L("text_saha_fotografi_ekle_51f0d"),systemImage:"photo.badge.plus")}.frame(minHeight:48).disabled(preparing)}
                        ForEach(Array(detail.issues.enumerated()),id:\.offset) {_,entry in Text("\(entry.kind=="damage" ? "Hasar" : "Eksik") · \(entry.text)")}
                        if writable && !["done","cancelled"].contains(detail.status) {
                            Picker("Bildirim",selection:$kind) {Text("Eksik").tag("missing");Text(L("text_hasar_1b191")).tag("damage")}.pickerStyle(.segmented)
                            TextField(L("text_saha_notu_10e6a"),text:$issue,axis:.vertical)
                            Button(L("text_notu_kaydet_04416")) {Task {await store.installationCommand("issue",kind:kind,text:issue);issue=""}}.buttonStyle(FieldButton()).disabled(issue.trimmingCharacters(in:.whitespacesAndNewlines).count<3 || issue.count>1000)
                        }
                    } else {Text(L("text_kayit_yukleniyor_cevrimdisiysa_daha_once_actigin_3e69a"))}
                }
            }.task(id:photoItem) {
                guard let photoItem,let id=selected else {return};preparing=true;defer {preparing=false}
                do {guard let bytes=try await photoItem.loadTransferable(type:Data.self) else {return};let saved=await store.uploadInstallationPhoto(id,bytes:try jpegForUpload(bytes));photoMessage=saved ? L("text_fotograf_cihazda_kaydedildi_51f1d") : L("text_fotograf_kaydedilemedi_822b0")} catch {photoMessage=L("text_fotograf_hazirlanamadi_2156d")}
            }.navigationTitle(L("text_montaj_1e486")).toolbar {ToolbarItem(placement:.cancellationAction) {Button("Kapat") {dismiss()}}}
        }
    }
}
