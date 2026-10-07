import SwiftUI

enum FieldColor {
    static let pine = Color(red: 17/255, green: 45/255, blue: 50/255)
    static let lime = Color(red: 198/255, green: 243/255, blue: 106/255)
    static let teal = Color(red: 39/255, green: 104/255, blue: 93/255)
    static let clay = Color(red: 175/255, green: 85/255, blue: 53/255)
    static let background = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
}
struct Brand: View {
    var body: some View {
        HStack(spacing: 12) {
            Text("R").font(.system(size: 30, weight: .black)).foregroundStyle(FieldColor.pine).padding(.horizontal, 16).padding(.vertical, 8).background(FieldColor.lime, in: RoundedRectangle(cornerRadius: 14))
            VStack(alignment: .leading, spacing: 2) { Text("renkflow").font(.system(size: 30, weight: .bold)).foregroundStyle(.white); Text("SAHA UYGULAMASI").font(.caption2.weight(.semibold)).tracking(2).foregroundStyle(FieldColor.lime) }
        }
    }
}
struct StatusPill: View {
    let status: String
    var body: some View {
        let color = status == "blocked" ? FieldColor.clay : FieldColor.teal
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
            .foregroundStyle(bright ? FieldColor.pine : .white)
            .background(bright ? FieldColor.lime : FieldColor.teal, in: RoundedRectangle(cornerRadius: 16))
            .opacity(enabled ? (configuration.isPressed ? 0.75 : 1) : 0.35)
    }
}
struct JobCard: View {
    let job: WorkOrder; let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 13) {
                HStack { StatusPill(status: job.status); Spacer(); Text(priorityLabel(job.priority)).font(.caption.weight(.semibold)).foregroundStyle(["critical", "high"].contains(job.priority) ? FieldColor.clay : .secondary) }
                Text(job.title).font(.headline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                if let location = job.location { Label(location, systemImage: "mappin.and.ellipse").font(.subheadline).foregroundStyle(.secondary) }
                if job.checklistTotal > 0 { ProgressView(value: Double(job.checklistCompleted), total: Double(job.checklistTotal)); Text("\(job.checklistCompleted)/\(job.checklistTotal) kontrol tamamlandı").font(.caption).foregroundStyle(.secondary) }
                if let date = job.dueAt { Text("Termin \(displayDate(date))").font(.caption).foregroundStyle(.secondary) }
            }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 20))
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
            }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 20))
        }.buttonStyle(.plain)
    }
}
extension View {
    func fieldCanvas() -> some View { self.frame(maxWidth: 960).frame(maxWidth: .infinity).background(FieldColor.background) }
    func fieldInput() -> some View { self.padding(16).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.secondary.opacity(0.18))) }
}
