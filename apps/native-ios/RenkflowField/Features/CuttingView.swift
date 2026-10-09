import SwiftUI

struct CuttingPlansView: View {
    @EnvironmentObject private var store: FieldStore
    @State private var selected: CutPlan?
    let plans:[CutPlan]
    var body: some View {
        VStack(spacing:12) {
            ForEach(plans) {plan in
                Button {selected=plan} label:{Label("Kesim · \(plan.bars.count) çubuk · \(statusLabel(plan.status))",systemImage:"scissors").frame(maxWidth:.infinity,minHeight:48)}.buttonStyle(.bordered)
            }
        }.sheet(item:$selected) {plan in
            NavigationStack {
                ScrollView {
                    LazyVStack(alignment:.leading,spacing:24) {
                        Text("Parçaya dokunun · sağa kaydırarak inceleyin").font(.subheadline).foregroundStyle(.secondary)
                        ForEach(Array(plan.bars.enumerated()),id:\.element.id) {index,bar in
                            CutBarView(bar:bar,index:index,jobs:store.snapshot?.workOrders ?? []) {id in selected=nil;Task {await store.openJob(id)}}
                        }
                    }.padding(20)
                }.navigationTitle("Kesim şeması").toolbar {ToolbarItem(placement:.cancellationAction) {Button("Kapat") {selected=nil}}}
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
                            Button {selected=i} label:{Text(quantity(piece.lengthMm)).font(.caption.monospacedDigit()).lineLimit(1).frame(width:max(1,geometry.size.width*zoom*piece.lengthMm/max(1,bar.lengthMm)),height:64).background(i%2==0 ? FieldColor.accent : FieldColor.success).foregroundStyle(i%2==0 ? FieldColor.onAccent : Color.white)}.buttonStyle(.plain).accessibilityLabel("\(quantity(piece.lengthMm)) milimetre parça")
                        }
                        Rectangle().fill(FieldColor.muted.opacity(0.3)).frame(width:max(0,geometry.size.width*zoom*(bar.lossMm+bar.remainingMm)/max(1,bar.lengthMm)),height:64).accessibilityLabel("Fire ve kalan")
                    }.frame(width:geometry.size.width*zoom,alignment:.leading)
                }
            }.frame(height:64)
            Slider(value:$zoom,in:1...4).accessibilityLabel("Kesim şeması yakınlaştırma")
            Text("Fire \(quantity(bar.lossMm)) mm · kalan \(quantity(bar.remainingMm)) mm\(bar.reusable ? " · yeniden kullanılabilir" : "")").font(.caption)
            if let selected,bar.pieces.indices.contains(selected) {
                let piece=bar.pieces[selected],job=jobs.first {$0.id==piece.workOrderId}
                Text("\(quantity(piece.lengthMm)) mm · \(job?.title ?? "İş emri")")
                if let job {Button("İş emrini aç") {open(job.id)}.frame(minHeight:48).buttonStyle(.bordered)}
            }
        }
    }
}
