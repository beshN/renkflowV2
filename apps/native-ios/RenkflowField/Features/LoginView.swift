import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var store: FieldStore
    @State private var server = "https://renkflow.com"
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focus: Int?
    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 30) {
                    Brand()
                    Text("Sahadaki işiniz.\nTek bir yerde.").font(.system(.largeTitle, design: .rounded, weight: .bold)).foregroundStyle(.white)
                    Text("İş emirleri, üretim adımları ve etiketler.\nRenkflow hesabınızla devam edin.").foregroundStyle(.white.opacity(0.72))
                }.padding(28).padding(.vertical, 24).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.pine)
                VStack(alignment: .leading, spacing: 18) {
                    Text("Hoş geldiniz").font(.title.bold())
                    VStack(alignment: .leading, spacing: 8) { Text("Renkflow adresiniz").font(.subheadline.weight(.medium)); TextField("https://renkflow.com", text: $server).keyboardType(.URL).textContentType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled().fieldInput().focused($focus, equals: 0) }
                    VStack(alignment: .leading, spacing: 8) { Text("E-posta").font(.subheadline.weight(.medium)); TextField("E-posta", text: $email).keyboardType(.emailAddress).textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled().fieldInput().focused($focus, equals: 1) }
                    VStack(alignment: .leading, spacing: 8) { Text("Şifre").font(.subheadline.weight(.medium)); SecureField("Şifreniz", text: $password).textContentType(.password).fieldInput().focused($focus, equals: 2).submitLabel(.go).onSubmit(signIn) }
                    if let error = store.error { Text(error).font(.subheadline).foregroundStyle(FieldColor.clay) }
                    Button(action: signIn) { HStack { Text(store.busy ? "Giriş yapılıyor…" : "Giriş yap"); Image(systemName: "arrow.right") } }.buttonStyle(FieldButton()).disabled(store.busy || email.isEmpty || password.isEmpty)
                    Text("Firmanızın mevcut Renkflow hesabını kullanın.").font(.subheadline).foregroundStyle(.secondary)
                }.padding(24).frame(maxWidth: 480).disabled(store.busy)
            }
        }.background(FieldColor.background).scrollDismissesKeyboard(.interactively)
            .toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Bitti") { focus = nil } } }
    }
    private func signIn() { focus = nil; Task { await store.login(server: server, email: email, password: password) } }
}
