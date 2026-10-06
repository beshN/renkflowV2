# Supabase OAuth & Email Template Setup Guide

## 🔐 OAuth Provider Configuration

### Google OAuth Setup

1. **Google Cloud Console'da Proje Oluşturma**
   - [Google Cloud Console](https://console.cloud.google.com/) → Yeni Proje
   - Proje adı: "Renkflow" (veya istediğiniz ad)

2. **OAuth Consent Screen Yapılandırma**
   - APIs & Services → OAuth consent screen
   - User Type: External
   - App name: "Renkflow"
   - User support email: Sizin e-postanız
   - Developer contact: Sizin e-postanız
   - Scopes: `email`, `profile` (varsayılan)

3. **OAuth 2.0 Credentials Oluşturma**
   - APIs & Services → Credentials
   - Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs:
     ```
     https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
     ```
   - **Client ID** ve **Client Secret**'ı kopyalayın

4. **Supabase'de Yapılandırma**
   - Supabase Dashboard → Authentication → Providers
   - Google'ı etkinleştirin
   - Client ID'yi yapıştırın
   - Client Secret'ı yapıştırın
   - Save

---

### Microsoft (Azure) OAuth Setup

1. **Azure Portal'da App Registration**
   - [Azure Portal](https://portal.azure.com/) → Azure Active Directory
   - App registrations → New registration
   - Name: "Renkflow"
   - Redirect URI:
     ```
     https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
     ```

2. **Client Secret Oluşturma**
   - Certificates & secrets → New client secret
   - Description: "Supabase Auth"
   - Expiry: 24 months
   - **Secret Value**'yu kopyalayın (bir daha gösterilmeyecek!)

3. **API Permissions**
   - API permissions → Add a permission
   - Microsoft Graph → Delegated permissions
   - `email`, `openid`, `profile` seçin
   - Grant admin consent

4. **Supabase'de Yapılandırma**
   - Supabase Dashboard → Authentication → Providers
   - Azure'u etkinleştirin
   - Application (client) ID'yi yapıştırın
   - Client Secret'ı yapıştırın
   - Azure AD Tenant URL: `https://login.microsoftonline.com/common`
   - Save

---

## 📧 Email Template Customization

### Supabase Dashboard'da

1. **Email Templates Sayfası**
   - Supabase Dashboard → Authentication → Email Templates

### Confirm signup (Hesap Doğrulama)

```html
<h2>Hoş geldiniz {{ .Data.user_metadata.full_name }}!</h2>

<p>Renkflow hesabınızı aktifleştirmek için aşağıdaki butona tıklayın:</p>

<a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
  Hesabımı Doğrula
</a>

<p>Veya bu linki tarayıcınıza kopyalayın:</p>
<p style="color: #666; font-size: 14px;">{{ .ConfirmationURL }}</p>

<hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">

<p style="color: #666; font-size: 12px;">
  Bu e-postayı siz talep etmediyseniz, güvenle silebilirsiniz.
</p>
```

### Reset password (Şifre Sıfırlama)

```html
<h2>Şifre Sıfırlama Talebi</h2>

<p>Renkflow hesabınız için şifre sıfırlama talebi aldık.</p>

<p>Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>

<a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
  Şifremi Sıfırla
</a>

<p>Veya bu linki tarayıcınıza kopyalayın:</p>
<p style="color: #666; font-size: 14px;">{{ .ConfirmationURL }}</p>

<p><strong>Bu link 1 saat içinde geçerliliğini yitirecektir.</strong></p>

<hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">

<p style="color: #666; font-size: 12px;">
  Bu talebi siz yapmadıysanız, hesabınızın güvenliğini kontrol etmenizi öneririz.
</p>
```

### Change Email (E-posta Değişikliği) - Opsiyonel

```html
<h2>E-posta Adresi Değişikliği</h2>

<p>Hesabınız için yeni e-posta adresi doğrulama talebi aldık.</p>

<p>Değişikliği onaylamak için aşağıdaki butona tıklayın:</p>

<a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
  E-postamı Onayla
</a>
```

---

## ⚡ Hızlı Test

OAuth yapılandırması tamamlandıktan sonra:

1. `http://localhost:3000/auth/login` → Google/Microsoft butonuna tıklayın
2. Sosyal medya hesabınızla giriş yapın
3. İlk seferinde izin ekranı görünecek → "Allow" tıklayın
4. Otomatik olarak panele yönlendirilmelisiniz

---

## ❗ Önemli Notlar

- **Redirect URL'i mutlaka doğru yazın** - hata alırsanız ilk kontrol edilecek yer
- **Google OAuth:** İlk testler için consent screen "Testing" modunda kalabilir
- **Microsoft:** Tenant URL'de `/common` ile başlayın (multi-tenant için)
- **Email Templates:** HTML kullanabilirsiniz, inline CSS önerilir
- **Template Variables:**
  - `{{ .ConfirmationURL }}` - Doğrulama linki
  - `{{ .Token }}` - Token (genellikle URL'de)
  - `{{ .TokenHash }}` - Hash'lenmiş token
  - `{{ .SiteURL }}` - Site URL'iniz
  - `{{ .Data.user_metadata.full_name }}` - Kullanıcı adı

