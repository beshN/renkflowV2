import SwiftUI
struct ReworkView:View {
    @EnvironmentObject private var store:FieldStore
    @Environment(\.dismiss) private var dismiss
    let operation:ProductionOperation
    @State private var target=""
    @State private var code="measurement"
    @State private var count="1"
    @State private var reason=""
    var body:some View {
        NavigationStack {
            Form {
                Text("Önceki aşamalar yeniden açılır. Sunucu miktarı ve stok durumunu doğrular.")
                Picker("Hedef aşama",selection:$target) {ForEach((store.snapshot?.operations ?? []).filter {$0.workOrderId==operation.workOrderId && $0.position<=operation.position}) {Text($0.name).tag($0.id)}}
                Picker("Neden",selection:$code) {Text("Ölçüm").tag("measurement");Text("Malzeme").tag("material");Text("Montaj").tag("assembly");Text("Kalite").tag("quality");Text("Diğer").tag("other")}
                TextField("Etkilenen adet",text:$count).keyboardType(.numberPad)
                TextField("Gerekçe",text:$reason,axis:.vertical)
                Button("Rework kaydet") {
                    let input=OperationInput(operationId:operation.id,version:operation.version,action:"rework",quantity:Int(count),reason:reason.trimmingCharacters(in:.whitespacesAndNewlines),reasonCode:code,targetOperationId:target)
                    Task {await store.command(input);dismiss()}
                }.buttonStyle(FieldButton()).disabled(!store.writable || target.isEmpty || reason.trimmingCharacters(in:.whitespacesAndNewlines).count<5 || reason.count>1000 || (Int(count) ?? 0)<1 || Double(Int(count) ?? 0)>operation.plannedQty)
            }.navigationTitle("Yeniden işleme").toolbar {ToolbarItem(placement:.cancellationAction) {Button("Vazgeç") {dismiss()}}}.onAppear {target=operation.id}
        }
    }
}
