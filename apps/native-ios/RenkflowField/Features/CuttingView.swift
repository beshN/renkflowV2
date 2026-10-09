import SwiftUI

struct CuttingPlansView: View {
    @EnvironmentObject private var store: FieldStore
    @State private var selected: CutPlan?
    let plans:[CutPlan]
    var body: some View {
        VStack(spacing:12) {
            ForEach(plans) {plan in
                Button {selected=plan} label:{Label(L("text_kesim_1_cubuk_2_b58b8", String(describing: plan.bars.count), String(describing: statusLabel(plan.status))),systemImage:"scissors").frame(maxWidth:.infinity,minHeight:48)}.buttonStyle(.bordered)
            }
        }.sheet(item:$selected) {plan in
            NavigationStack {
                ScrollView {
                    LazyVStack(alignment:.leading,spacing:24) {
                        Text(L("text_parcaya_dokunun_saga_kaydirarak_inceleyin_d268d")).font(.subheadline).foregroundStyle(.secondary)
                        ForEach(Array(plan.bars.enumerated()),id:\.element.id) {index,bar in
                            CutBarView(bar:bar,index:index,jobs:store.snapshot?.workOrders ?? []) {id in selected=nil;Task {await store.openJob(id)}}
                        }
                    }.padding(20)
                }.navigationTitle(L("text_kesim_semasi_92476")).toolbar {ToolbarItem(placement:.cancellationAction) {Button("Kapat") {selected=nil}}}
            }
        }
    }
}
private struct CutBarView: View {
    let bar:CutBar;let index:Int;let jobs:[WorkOrder];let open:(String)->Void
    @State private var zoom=1.0
    @State private var selected:Int?
    var body:some View {
        VStack(alignment:.leading,spacing:12) {
            Text("\(index+1) · \(bar.color) · \(quantity(bar.lengthMm)) mm").font(.headline)
            GeometryReader {geometry in
                ScrollView(.horizontal) {
                    HStack(spacing:0) {
                        ForEach(Array(bar.pieces.enumerated()),id:\.offset) {i,piece in
                            Button {selected=i} label:{Text(quantity(piece.lengthMm)).font(.caption.monospacedDigit()).lineLimit(1).frame(width:max(1,geometry.size.width*zoom*piece.lengthMm/max(1,bar.lengthMm)),height:64).background(i%2==0 ? FieldColor.accent : FieldColor.success).foregroundStyle(i%2==0 ? FieldColor.onAccent : Color.white)}.buttonStyle(.plain).accessibilityLabel(L("text_1_milimetre_parca_a0e84", String(describing: quantity(piece.lengthMm))))
                        }
                        Rectangle().fill(FieldColor.muted.opacity(0.3)).frame(width:max(0,geometry.size.width*zoom*(bar.lossMm+bar.remainingMm)/max(1,bar.lengthMm)),height:64).accessibilityLabel(L("text_fire_ve_kalan_98970"))
                    }.frame(width:geometry.size.width*zoom,alignment:.leading)
                }
            }.frame(height:64)
            Slider(value:$zoom,in:1...4).accessibilityLabel(L("text_kesim_semasi_yakinlastirma_12738"))
            Text(L("text_fire_1_mm_kalan_2_mm_3_1e69c", String(describing: quantity(bar.lossMm)), String(describing: quantity(bar.remainingMm)), String(describing: bar.reusable ? " · " + L("field.reusable") : ""))).font(.caption)
            if let selected,bar.pieces.indices.contains(selected) {
                let piece=bar.pieces[selected],job=jobs.first {$0.id==piece.workOrderId}
                Text(L("text_1_mm_2_c0ff2", String(describing: quantity(piece.lengthMm)), String(describing: job?.title ?? L("field.job"))))
                if let job {Button(L("text_is_emrini_ac_516de")) {open(job.id)}.frame(minHeight:48).buttonStyle(.bordered)}
            }
        }
    }
}
