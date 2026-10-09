import SwiftUI
struct FamilyThumbnail:View {
    let family:String?
    var body:some View {
        if family=="pergola" {
            Canvas {context,size in
                var frame=Path()
                func line(_ x1:Double,_ y1:Double,_ x2:Double,_ y2:Double) {frame.move(to:CGPoint(x:size.width*x1,y:size.height*y1));frame.addLine(to:CGPoint(x:size.width*x2,y:size.height*y2))}
                line(0.12,0.36,0.8,0.36);line(0.8,0.36,0.92,0.16);line(0.92,0.16,0.24,0.16);line(0.24,0.16,0.12,0.36)
                line(0.12,0.36,0.12,0.9);line(0.8,0.36,0.8,0.9);line(0.92,0.16,0.92,0.7)
                context.stroke(frame,with:.color(FieldColor.muted),lineWidth:2)
                var slats=Path();for i in 1...5 {let x=0.12+Double(i)*0.11;slats.move(to:CGPoint(x:size.width*x,y:size.height*0.36));slats.addLine(to:CGPoint(x:size.width*(x+0.12),y:size.height*0.16))};context.stroke(slats,with:.color(FieldColor.accent),lineWidth:1)
            }.frame(width:72,height:48).accessibilityLabel(L("text_pergola_urun_ailesi_cizimi_8dff4"))
        } else {Image(systemName:"gearshape.2").font(.title).foregroundStyle(FieldColor.muted).frame(width:48,height:40).accessibilityLabel(L("text_uretim_isi_b3d75"))}
    }
}
