import SwiftUI
struct NotificationsView:View {
    @EnvironmentObject private var store:FieldStore
    @State private var result:String?
    var body:some View {
        VStack(alignment:.leading,spacing:12) {
            Text("Bildirimler").font(.title3.bold())
            Text(L("text_apns_baglanmadi_048f5")).foregroundStyle(.secondary)
            if let prefs=store.preferences {
                Toggle(L("text_is_atamasi_1f27c"),isOn:Binding(get:{prefs.assignment},set:{value in Task {await store.notificationPreference("assignment",value:value)}})).frame(minHeight:48).disabled(store.stale || store.preferencesBusy || store.updateRequired)
                Toggle("Bahsetme",isOn:Binding(get:{prefs.mention},set:{value in Task {await store.notificationPreference("mention",value:value)}})).frame(minHeight:48).disabled(store.stale || store.preferencesBusy || store.updateRequired)
                Toggle(L("text_gecikme_99c55"),isOn:Binding(get:{prefs.delay},set:{value in Task {await store.notificationPreference("delay",value:value)}})).frame(minHeight:48).disabled(store.stale || store.preferencesBusy || store.updateRequired)
            }
            Button(L("text_yerel_bildirim_testi_0f5dc")) {Task {do {result=try await showLocalNotification() ? L("text_yerel_bildirim_planlandi_af361") : L("text_bildirim_izni_verilmedi_27fc3")} catch {result=L("text_yerel_bildirim_olusturulamadi_9e766")}}}.frame(minHeight:48).buttonStyle(.bordered)
            if let result {Text(result).font(.subheadline)}
            ForEach(Array(store.notifications.prefix(10))) {item in Text(item.kind=="work_order:assigned" ? L("text_is_atamasi_1f27c") : item.kind=="mention" ? "Bahsetme" : L("text_gecikme_uyarisi_fe3da")).font(.subheadline)}
        }
    }
}
