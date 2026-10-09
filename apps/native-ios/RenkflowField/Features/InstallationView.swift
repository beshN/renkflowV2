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
                    Toggle("Bugünkü ekip işleri",isOn:$today)
                    let list=store.installations.filter {!today || $0.date==day}
                    if list.isEmpty {Text("Bu gün için atanan montaj yok.").foregroundStyle(.secondary)}
                    ForEach(list) {job in
                        Button {selected=job.id;Task {await store.openInstallation(job.id)}} label:{
                            VStack(alignment:.leading,spacing:8) {Text(job.number).font(.headline);Text("\(job.date ?? "") \(job.startTime ?? "") · \(job.productName ?? "")");Text("\(job.checklistCompleted)/\(job.checklistTotal) kontrol").font(.caption)}.frame(minHeight:64)
                        }
                    }
                } else {
                    Button("Listeye dön") {selected=nil}.frame(minHeight:48)
                    if let detail=store.installationDetail,detail.id==selected {
                        Text(detail.status=="planned" ? "Planlandı" : detail.status=="in_progress" ? "Sahada" : "Tamamlandı").font(.headline)
                        if writable && ["planned","in_progress"].contains(detail.status) {Button(detail.status=="planned" ? "Montajı başlat" : "Montajı tamamla") {Task {await store.installationCommand(detail.status=="planned" ? "start" : "complete")}}.buttonStyle(FieldButton())}
                        ForEach(detail.checklist) {item in
                            Button {Task {await store.installationCommand("checklist",item:item)}} label:{Label(item.title,systemImage:item.completed ? "checkmark.circle.fill" : "circle").frame(minHeight:48)}.disabled(!writable || ["done","cancelled"].contains(detail.status))
                        }
                        Text("\(detail.photos?.count ?? 0) saha fotoğrafı")
                        if let photoMessage {Text(photoMessage)}
                        if writable && !["done","cancelled"].contains(detail.status) {PhotosPicker(selection:$photoItem,matching:.images) {Label("Saha fotoğrafı ekle",systemImage:"photo.badge.plus")}.frame(minHeight:48).disabled(preparing)}
                        ForEach(Array(detail.issues.enumerated()),id:\.offset) {_,entry in Text("\(entry.kind=="damage" ? "Hasar" : "Eksik") · \(entry.text)")}
                        if writable && !["done","cancelled"].contains(detail.status) {
                            Picker("Bildirim",selection:$kind) {Text("Eksik").tag("missing");Text("Hasar").tag("damage")}.pickerStyle(.segmented)
                            TextField("Saha notu",text:$issue,axis:.vertical)
                            Button("Notu kaydet") {Task {await store.installationCommand("issue",kind:kind,text:issue);issue=""}}.buttonStyle(FieldButton()).disabled(issue.trimmingCharacters(in:.whitespacesAndNewlines).count<3 || issue.count>1000)
                        }
                    } else {Text("Kayıt yükleniyor. Çevrimdışıysa daha önce açtığınız kayıtlar kullanılabilir.")}
                }
            }.task(id:photoItem) {
                guard let photoItem,let id=selected else {return};preparing=true;defer {preparing=false}
                do {guard let bytes=try await photoItem.loadTransferable(type:Data.self) else {return};let saved=await store.uploadInstallationPhoto(id,bytes:try jpegForUpload(bytes));photoMessage=saved ? "Fotoğraf cihazda kaydedildi." : "Fotoğraf kaydedilemedi."} catch {photoMessage="Fotoğraf hazırlanamadı."}
            }.navigationTitle("Montaj").toolbar {ToolbarItem(placement:.cancellationAction) {Button("Kapat") {dismiss()}}}
        }
    }
}
