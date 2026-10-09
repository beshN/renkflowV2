import SwiftUI
import PhotosUI
struct FieldEventView:View {
    @EnvironmentObject private var store:FieldStore
    let jobID:String
    @State private var show=false
    @State private var kind="scrap"
    @State private var code=""
    @State private var count="1"
    @State private var note=""
    @State private var photoItem:PhotosPickerItem?
    @State private var photo:String?
    @State private var preparing=false
    @State private var photoError=false
    var body:some View {
        if store.references?.capabilities.reasonCodes==true {
            Button("Fire / gecikme bildir") {show=true}.frame(minHeight:48).buttonStyle(.bordered).disabled(!store.writable)
                .sheet(isPresented:$show) {
                    NavigationStack {
                        Form {
                            Picker("Bildirim",selection:$kind) {Text("Fire").tag("scrap");Text("Gecikme").tag("delay")}.pickerStyle(.segmented).onChange(of:kind) {_,_ in code=""}
                            Picker("Neden",selection:$code) {Text("Seçin").tag("");ForEach((store.references?.reasons ?? []).filter {$0.kind==kind},id:\.code) {Text($0.label).tag($0.code)}}
                            if kind=="scrap" {TextField("Adet",text:$count).keyboardType(.numberPad)}
                            if kind=="scrap" {PhotosPicker(selection:$photoItem,matching:.images) {Label(photo==nil ? "Fotoğraf ekle (isteğe bağlı)" : "Fotoğraf eklendi",systemImage:"photo.badge.plus")}.frame(minHeight:48).disabled(preparing)}
                            if photoError {Text("Fotoğraf hazırlanamadı.").foregroundStyle(FieldColor.error)}
                            TextField("Açıklama (isteğe bağlı)",text:$note,axis:.vertical)
                            Button("Kaydet") {Task {await store.fieldEvent(kind,jobID:jobID,reason:code,count:Int(count) ?? 1,note:note,photo:photo);show=false}}.buttonStyle(FieldButton()).disabled(!store.writable || preparing || code.isEmpty || note.count>500 || kind=="scrap" && !(1...100000).contains(Int(count) ?? 0))
                        }.task(id:photoItem) {
                            guard let photoItem else {return};preparing=true;photoError=false;defer {preparing=false}
                            do {guard let bytes=try await photoItem.loadTransferable(type:Data.self) else {photoError=true;return};photo=await store.uploadPhoto(jobID:jobID,bytes:try jpegForUpload(bytes));photoError=photo==nil} catch {photoError=true}
                        }.navigationTitle("Saha bildirimi").toolbar {ToolbarItem(placement:.cancellationAction) {Button("Vazgeç") {show=false}}}
                    }
                }
        }
    }
}
