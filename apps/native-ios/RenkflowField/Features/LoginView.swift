import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var store: FieldStore
    // Most firms use renkflow.com; a self-hosted address stays behind the server disclosure and is remembered.
    @AppStorage("field.server") private var server = "https://renkflow.com"
    @State private var serverOpen = false
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focus: Int?
    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 30) {
                    Brand()
                    Text(L("text_sahadaki_isiniz_tek_bir_yerde_1f831")).font(.system(.largeTitle, design: .default, weight: .semibold)).foregroundStyle(.white)
                    Text(L("text_is_emirleri_uretim_adimlari_ve_etiketler_renkflo_b3d7b")).foregroundStyle(.white.opacity(0.72))
                }.padding(28).padding(.vertical, 24).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.ink)
                VStack(alignment: .leading, spacing: 18) {
                    Text(L("text_hos_geldiniz_0534d")).font(.title.bold())
                    VStack(alignment: .leading, spacing: 8) { Text("E-posta").font(.subheadline.weight(.medium)); TextField("E-posta", text: $email).keyboardType(.emailAddress).textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled().fieldInput().focused($focus, equals: 1) }
                    VStack(alignment: .leading, spacing: 8) { Text(L("text_sifre_e1ac9")).font(.subheadline.weight(.medium)); SecureField(L("text_sifreniz_afc50"), text: $password).textContentType(.password).fieldInput().focused($focus, equals: 2).submitLabel(.go).onSubmit(signIn) }
                    DisclosureGroup(isExpanded: $serverOpen) {
                        TextField("https://renkflow.com", text: $server).keyboardType(.URL).textContentType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled().fieldInput().focused($focus, equals: 0).padding(.top, 8)
                    } label: {
                        HStack { Text(L("text_sunucu_7c1e2")).font(.subheadline.weight(.medium)); Spacer(); Text(URL(string: server)?.host ?? server).font(.subheadline).foregroundStyle(.secondary).lineLimit(1) }
                    }.tint(.secondary).accessibilityHint(L("text_renkflow_adresiniz_4553a"))
                    if let error = store.error { Text(error).font(.subheadline).foregroundStyle(FieldColor.error) }
                    Button(action: signIn) { HStack { Text(store.busy ? L("text_giris_yapiliyor_378cf") : L("text_giris_yap_b872b")); Image(systemName: "arrow.right") } }.buttonStyle(FieldButton()).disabled(store.busy || email.isEmpty || password.isEmpty)
                    Text(L("text_firmanizin_mevcut_renkflow_hesabini_kullanin_32cc2")).font(.subheadline).foregroundStyle(.secondary)
                }.padding(24).frame(maxWidth: 480).disabled(store.busy)
            }
        }.background(FieldColor.background).scrollDismissesKeyboard(.interactively)
            .toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Bitti") { focus = nil } } }
    }
    private func signIn() { focus = nil; Task { await store.login(server: server, email: email, password: password) } }
}
