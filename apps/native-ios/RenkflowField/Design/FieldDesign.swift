import SwiftUI

enum FieldColor {
    // Matches apps/web/styles/theme.css while retaining native system typography.
    static let ink = color(0x111113)
    static let onInk = Color.white
    static let accent = adaptive(0x2F55F4, 0x6B8FF0)
    static let onAccent = adaptive(0xFFFFFF, 0x111113)
    static let error = adaptive(0xDC2626, 0xF87171)
    static let success = adaptive(0x15803D, 0x4ADE80)
    static let background = adaptive(0xFBFBFB, 0x0B0B0C)
    static let card = adaptive(0xFFFFFF, 0x121214)
    static let border = adaptive(0xE4E4E7, 0x26262A)
    static let text = adaptive(0x111113, 0xECECEE)
    static let muted = adaptive(0x6B6B73, 0x9A9AA3)
    private static func uiColor(_ hex: Int) -> UIColor {
        UIColor(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
    }
    private static func color(_ hex: Int) -> Color { Color(uiColor: uiColor(hex)) }
    private static func adaptive(_ light: Int, _ dark: Int) -> Color {
        Color(uiColor: UIColor { traits in uiColor(traits.userInterfaceStyle == .dark ? dark : light) })
    }
}
struct BrandGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: 7, y: 19)); path.addLine(to: CGPoint(x: 7, y: 5))
        path.addLine(to: CGPoint(x: 12.5, y: 5))
        path.addCurve(to: CGPoint(x: 16.75, y: 9.25), control1: CGPoint(x: 14.847, y: 5), control2: CGPoint(x: 16.75, y: 6.903))
        path.addCurve(to: CGPoint(x: 12.5, y: 13.5), control1: CGPoint(x: 16.75, y: 11.597), control2: CGPoint(x: 14.847, y: 13.5))
        path.addLine(to: CGPoint(x: 7, y: 13.5))
        path.move(to: CGPoint(x: 12.5, y: 13.5)); path.addLine(to: CGPoint(x: 17, y: 19))
        return path.applying(CGAffineTransform(scaleX: rect.width / 24, y: rect.height / 24))
    }
}
struct Brand: View {
    var body: some View {
        HStack(spacing: 12) {
            BrandGlyph().stroke(FieldColor.ink, style: StrokeStyle(lineWidth: 2.8, lineCap: .round, lineJoin: .round)).frame(width: 28, height: 28).padding(10).background(FieldColor.onInk, in: RoundedRectangle(cornerRadius: 8)).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) { Text("RenkFlow").font(.system(size: 27, weight: .semibold)).foregroundStyle(.white); Text("SAHA UYGULAMASI").font(.caption2.weight(.semibold)).tracking(1.5).foregroundStyle(.white.opacity(0.65)) }
        }
    }
}
struct StatusPill: View {
    let status: String
    var body: some View {
        let color = status == "blocked" ? FieldColor.error : (status == "done" ? FieldColor.success : (["running", "in_progress"].contains(status) ? FieldColor.accent : FieldColor.muted))
        Text(statusLabel(status)).font(.caption.weight(.semibold)).foregroundStyle(color).padding(.horizontal, 10).padding(.vertical, 7).background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
    }
}
struct SectionTitle: View {
    let title: String; let caption: String
    var body: some View { VStack(alignment: .leading, spacing: 5) { Text(title).font(.title3.bold()); Text(caption).font(.subheadline).foregroundStyle(.secondary) }.frame(maxWidth: .infinity, alignment: .leading) }
}
struct EmptyState: View {
    let title: String; let subtitle: String; var icon = "tray"
    var body: some View { ContentUnavailableView(title, systemImage: icon, description: Text(subtitle)).frame(minHeight: 170) }
}
struct FieldButton: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    var bright = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.headline).frame(maxWidth: .infinity).padding(.vertical, 17)
            .foregroundStyle(bright ? FieldColor.ink : FieldColor.onAccent)
            .background(bright ? FieldColor.onInk : FieldColor.accent, in: RoundedRectangle(cornerRadius: 8))
            .opacity(enabled ? (configuration.isPressed ? 0.75 : 1) : 0.35)
    }
}
struct JobCard: View {
    let job: WorkOrder; let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 13) {
                HStack { StatusPill(status: job.status); Spacer(); Text(priorityLabel(job.priority)).font(.caption.weight(.semibold)).foregroundStyle(["critical", "high"].contains(job.priority) ? FieldColor.error : .secondary) }
                Text(job.title).font(.headline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                if let location = job.location { Label(location, systemImage: "mappin.and.ellipse").font(.subheadline).foregroundStyle(.secondary) }
                if job.checklistTotal > 0 { ProgressView(value: Double(job.checklistCompleted), total: Double(job.checklistTotal)); Text("\(job.checklistCompleted)/\(job.checklistTotal) kontrol tamamlandı").font(.caption).foregroundStyle(.secondary) }
                if let date = job.dueAt { Text("Termin \(displayDate(date))").font(.caption).foregroundStyle(.secondary) }
            }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(FieldColor.border, lineWidth: 1))
        }.buttonStyle(.plain)
    }
}
struct OperationCard: View {
    let operation: ProductionOperation; var jobTitle: String? = nil; let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                HStack { Text(String(format: "%02d / %@", operation.position + 1, operation.workCenterCode.uppercased())).font(.caption.weight(.semibold)).foregroundStyle(.secondary); Spacer(); StatusPill(status: operation.status) }
                Text(operation.name).font(.title3.bold()).foregroundStyle(.primary)
                if let jobTitle { Text(jobTitle).font(.subheadline).foregroundStyle(.secondary) }
                ProgressView(value: min(operation.completedQty, operation.plannedQty), total: max(1, operation.plannedQty))
                HStack { Text("\(quantity(operation.completedQty)) / \(quantity(operation.plannedQty)) adet"); Spacer(); Text("\(Int(operation.activeSeconds / 60)) dk") }.font(.caption.weight(.medium)).foregroundStyle(.secondary)
            }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(FieldColor.border, lineWidth: 1))
        }.buttonStyle(.plain)
    }
}
extension View {
    func fieldCanvas() -> some View { self.frame(maxWidth: 960).frame(maxWidth: .infinity).background(FieldColor.background) }
    func fieldInput() -> some View { self.padding(16).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 8)).overlay(RoundedRectangle(cornerRadius: 8).stroke(FieldColor.border, lineWidth: 1)) }
}
