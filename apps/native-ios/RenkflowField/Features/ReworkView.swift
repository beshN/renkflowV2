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
                Text(L("text_onceki_asamalar_yeniden_acilir_sunucu_miktari_ve_e05c5"))
                Picker(L("text_hedef_asama_d52b7"),selection:$target) {ForEach((store.snapshot?.operations ?? []).filter {$0.workOrderId==operation.workOrderId && $0.position<=operation.position}) {Text($0.name).tag($0.id)}}
                Picker("Neden",selection:$code) {Text(L("text_olcum_be440")).tag("measurement");Text(L("text_malzeme_97571")).tag("material");Text(L("text_montaj_1e486")).tag("assembly");Text("Kalite").tag("quality");Text(L("text_diger_6cceb")).tag("other")}
                TextField(L("text_etkilenen_adet_29647"),text:$count).keyboardType(.numberPad)
                TextField(L("text_gerekce_d11ad"),text:$reason,axis:.vertical)
                Button(L("text_rework_kaydet_b23df")) {
                    let input=OperationInput(operationId:operation.id,version:operation.version,action:"rework",quantity:Int(count),reason:reason.trimmingCharacters(in:.whitespacesAndNewlines),reasonCode:code,targetOperationId:target)
                    Task {await store.command(input);dismiss()}
                }.buttonStyle(FieldButton()).disabled(!store.writable || target.isEmpty || reason.trimmingCharacters(in:.whitespacesAndNewlines).count<5 || reason.count>1000 || (Int(count) ?? 0)<1 || Double(Int(count) ?? 0)>operation.plannedQty)
            }.navigationTitle(L("text_yeniden_isleme_4ca75")).toolbar {ToolbarItem(placement:.cancellationAction) {Button(L("text_vazgec_39a8d")) {dismiss()}}}.onAppear {target=operation.id}
        }
    }
}
