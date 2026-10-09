import SwiftUI
struct NotificationsView:View {
    @EnvironmentObject private var store:FieldStore
    @State private var result:String?
    var body:some View {
        VStack(alignment:.leading,spacing:12) {
            Text("Bildirimler").font(.title3.bold())
            Text("APNs · Bağlanmadı").foregroundStyle(.secondary)
            if let prefs=store.preferences {
                Toggle("İş ataması",isOn:Binding(get:{prefs.assignment},set:{value in Task {await store.notificationPreference("assignment",value:value)}})).frame(minHeight:48).disabled(store.stale || store.preferencesBusy || store.updateRequired)
                Toggle("Bahsetme",isOn:Binding(get:{prefs.mention},set:{value in Task {await store.notificationPreference("mention",value:value)}})).frame(minHeight:48).disabled(store.stale || store.preferencesBusy || store.updateRequired)
                Toggle("Gecikme",isOn:Binding(get:{prefs.delay},set:{value in Task {await store.notificationPreference("delay",value:value)}})).frame(minHeight:48).disabled(store.stale || store.preferencesBusy || store.updateRequired)
            }
            Button("Yerel bildirim testi") {Task {do {result=try await showLocalNotification() ? "Yerel bildirim planlandı." : "Bildirim izni verilmedi."} catch {result="Yerel bildirim oluşturulamadı."}}}.frame(minHeight:48).buttonStyle(.bordered)
            if let result {Text(result).font(.subheadline)}
            ForEach(Array(store.notifications.prefix(10))) {item in Text(item.kind=="work_order:assigned" ? "İş ataması" : item.kind=="mention" ? "Bahsetme" : "Gecikme uyarısı").font(.subheadline)}
        }
    }
}
