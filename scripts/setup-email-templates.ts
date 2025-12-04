import { Resend } from 'resend';

// API key'i environment'tan al
const resend = new Resend(process.env.RESEND_API_KEY);

async function createTemplates() {
  console.log('🔧 Creating Resend email templates...\n');

  try {
    // 1. Email Verification Template
    console.log('📧 Creating: Email Verification Template');
    const verifyTemplate = await resend.templates.create({
      name: 'renkflow-email-verification',
      subject: 'Renkflow Hesabınızı Doğrulayın',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 48px 20px; text-align: center;">
              <h1 style="margin: 0; color: #6366f1; font-size: 28px; font-weight: 700;">Renkflow</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 48px 40px;">
              <h2 style="margin: 0 0 16px; color: #1a202c; font-size: 24px; font-weight: 600;">
                Hoş Geldiniz, {{{USER_NAME}}}!
              </h2>
              
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Renkflow hesabınızı oluşturduğunuz için teşekkür ederiz. Hesabınızı aktifleştirmek için aşağıdaki butona tıklayın:
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="{{{VERIFICATION_URL}}}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Hesabımı Doğrula
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Veya bu linki kopyalayarak tarayıcınıza yapıştırın:<br>
                <a href="{{{VERIFICATION_URL}}}" style="color: #6366f1; word-break: break-all;">{{{VERIFICATION_URL}}}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 48px; background-color: #f7fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; text-align: center;">
                Bu e-postayı siz talep etmediyseniz, güvenle silebilirsiniz.
              </p>
              <p style="margin: 8px 0 0; color: #a0aec0; font-size: 12px; text-align: center;">
                © 2024 Renkflow. Tüm hakları saklıdır.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      variables: [
        { key: 'USER_NAME', type: 'string', fallbackValue: 'Kullanıcı' },
        { key: 'VERIFICATION_URL', type: 'string', fallbackValue: '#' },
      ],
    });
    console.log('✅ Created:', verifyTemplate.id, '\n');

    // 2. Password Reset Template
    console.log('📧 Creating: Password Reset Template');
    const resetTemplate = await resend.templates.create({
      name: 'renkflow-password-reset',
      subject: 'Şifre Sıfırlama Talebi',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 48px 20px; text-align: center;">
              <h1 style="margin: 0; color: #6366f1; font-size: 28px; font-weight: 700;">Renkflow</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 0 48px 40px;">
              <h2 style="margin: 0 0 16px; color: #1a202c; font-size: 24px; font-weight: 600;">
                Merhaba {{{USER_NAME}}},
              </h2>
              
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Şifrenizi sıfırlamak için bir talep aldık. Yeni şifre oluşturmak için aşağıdaki butona tıklayın:
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="{{{RESET_URL}}}" style="display: inline-block; padding: 14px 32px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Şifremi Sıfırla
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #e53e3e; font-size: 14px; line-height: 1.6; padding: 16px; background-color: #fff5f5; border-left: 4px solid #e53e3e; border-radius: 4px;">
                ⚠️ Bu link 1 saat içinde geçerliliğini yitirecektir.
              </p>
              
              <p style="margin: 24px 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Bu talebi siz yapmadıysanız, bu e-postayı güvenle silebilirsiniz. Şifreniz değiştirilmeyecektir.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 24px 48px; background-color: #f7fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; text-align: center;">
                © 2024 Renkflow. Tüm hakları saklıdır.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      variables: [
        { key: 'USER_NAME', type: 'string', fallbackValue: 'Kullanıcı' },
        { key: 'RESET_URL', type: 'string', fallbackValue: '#' },
      ],
    });
    console.log('✅ Created:', resetTemplate.id, '\n');

    // 3. Team Invitation Template
    console.log('📧 Creating: Team Invitation Template');
    const inviteTemplate = await resend.templates.create({
      name: 'renkflow-team-invitation',
      subject: '{{{TENANT_NAME}}} - Takım Daveti',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 48px 20px; text-align: center;">
              <h1 style="margin: 0; color: #6366f1; font-size: 28px; font-weight: 700;">Renkflow</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 0 48px 40px;">
              <h2 style="margin: 0 0 16px; color: #1a202c; font-size: 24px; font-weight: 600;">
                🎉 Takıma Davet Edildiniz!
              </h2>
              
              <p style="margin: 0 0 8px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                <strong>{{{INVITER_NAME}}}</strong> sizi <strong>{{{TENANT_NAME}}}</strong> organizasyonuna davet etti.
              </p>
              
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Rolünüz: <strong style="color: #6366f1;">{{{ROLE}}}</strong>
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="{{{INVITE_URL}}}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Daveti Kabul Et
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Renkflow ile ekibinizle birlikte çalışın, siparişleri yönetin ve iş süreçlerinizi optimize edin.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 24px 48px; background-color: #f7fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; text-align: center;">
                Bu daveti beklemiyorsanız, güvenle silebilirsiniz.
              </p>
              <p style="margin: 8px 0 0; color: #a0aec0; font-size: 12px; text-align: center;">
                © 2024 Renkflow. Tüm hakları saklıdır.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      variables: [
        { key: 'INVITER_NAME', type: 'string', fallbackValue: 'Bir kullanıcı' },
        { key: 'TENANT_NAME', type: 'string', fallbackValue: 'Organizasyon' },
        { key: 'ROLE', type: 'string', fallbackValue: 'member' },
        { key: 'INVITE_URL', type: 'string', fallbackValue: '#' },
      ],
    });
    console.log('✅ Created:', inviteTemplate.id, '\n');

    // 4. Order Confirmation Template
    console.log('📧 Creating: Order Confirmation Template');
    const orderTemplate = await resend.templates.create({
      name: 'renkflow-order-confirmation',
      subject: 'Sipariş Onayı - #{{{ORDER_NUMBER}}}',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 48px 20px; text-align: center;">
              <h1 style="margin: 0; color: #6366f1; font-size: 28px; font-weight: 700;">Renkflow</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 0 48px 40px;">
              <div style="text-align: center; padding: 20px; background-color: #f0fdf4; border-radius: 8px; margin-bottom: 24px;">
                <h2 style="margin: 0; color: #059669; font-size: 24px; font-weight: 600;">
                  ✓ Sipariş Alındı!
                </h2>
              </div>
              
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Merhaba <strong>{{{CUSTOMER_NAME}}}</strong>,
              </p>
              
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Siparişiniz başarıyla alındı ve işleme konuldu.
              </p>
              
              <!-- Order Details -->
              <table width="100%" cellpadding="12" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px;">
                <tr style="background-color: #f7fafc;">
                  <td colspan="2" style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #1a202c; font-size: 16px;">Sipariş Detayları</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; color: #718096; border-bottom: 1px solid #e2e8f0;">Sipariş No</td>
                  <td style="padding: 12px; color: #1a202c; font-weight: 600; border-bottom: 1px solid #e2e8f0;" align="right">#{{{ORDER_NUMBER}}}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; color: #718096; border-bottom: 1px solid #e2e8f0;">Tarih</td>
                  <td style="padding: 12px; color: #1a202c; border-bottom: 1px solid #e2e8f0;" align="right">{{{ORDER_DATE}}}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; color: #718096; border-bottom: 1px solid #e2e8f0;">Durum</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;" align="right">
                    <span style="padding: 4px 12px; background-color: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 14px; font-weight: 600;">{{{STATUS}}}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; color: #718096;">Toplam</td>
                  <td style="padding: 12px; color: #059669; font-size: 20px; font-weight: 700;" align="right">{{{TOTAL_PRICE}}} ₺</td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="{{{ORDER_URL}}}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Siparişi Görüntüle
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Siparişinizle ilgili sorularınız için bizimle iletişime geçebilirsiniz.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 24px 48px; background-color: #f7fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; text-align: center;">
                Renkflow ile iş süreçlerinizi yönettiğiniz için teşekkür ederiz.
              </p>
              <p style="margin: 8px 0 0; color: #a0aec0; font-size: 12px; text-align: center;">
                © 2024 Renkflow. Tüm hakları saklıdır.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      variables: [
        { key: 'CUSTOMER_NAME', type: 'string', fallbackValue: 'Müşteri' },
        { key: 'ORDER_NUMBER', type: 'string', fallbackValue: '1001' },
        { key: 'ORDER_DATE', type: 'string', fallbackValue: '01.01.2024' },
        { key: 'STATUS', type: 'string', fallbackValue: 'Pending' },
        { key: 'TOTAL_PRICE', type: 'number', fallbackValue: 0 },
        { key: 'ORDER_URL', type: 'string', fallbackValue: '#' },
      ],
    });
    console.log('✅ Created:', orderTemplate.id, '\n');

    // 5. Welcome Email Template
    console.log('📧 Creating: Welcome Email Template');
    const welcomeTemplate = await resend.templates.create({
      name: 'renkflow-welcome',
      subject: 'Renkflow\'a Hoş Geldiniz!',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 48px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Renkflow'a Hoş Geldiniz!</h1>
              <p style="margin: 12px 0 0; color: #e9d8fd; font-size: 16px;">🎉 İş süreçlerinizi dönüştürmeye hazır mısınız?</p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 48px;">
              <p style="margin: 0 0 16px; color: #1a202c; font-size: 18px; line-height: 1.6;">
                Merhaba <strong>{{{USER_NAME}}}</strong>,
              </p>
              
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Renkflow ailesine katıldığınız için çok mutluyuz! Şimdi siparişlerinizi, müşterilerinizi ve tüm iş süreçlerinizi tek bir platformda yönetebilirsiniz.
              </p>
              
              <!-- Features -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="padding: 16px; background-color: #f7fafc; border-left: 4px solid #6366f1; border-radius: 8px; margin-bottom: 16px;">
                    <h3 style="margin: 0 0 8px; color: #1a202c; font-size: 16px; font-weight: 600;">📋 Sipariş Yönetimi</h3>
                    <p style="margin: 0; color: #718096; font-size: 14px;">Tüm siparişlerinizi tek bir yerden takip edin</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; background-color: #f7fafc; border-left: 4px solid #10b981; border-radius: 8px; margin-bottom: 16px;">
                    <h3 style="margin: 0 0 8px; color: #1a202c; font-size: 16px; font-weight: 600;">👥 Müşteri Takibi</h3>
                    <p style="margin: 0; color: #718096; font-size: 14px;">Müşteri bilgilerinizi organize edin</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; background-color: #f7fafc; border-left: 4px solid #f59e0b; border-radius: 8px;">
                    <h3 style="margin: 0 0 8px; color: #1a202c; font-size: 16px; font-weight: 600;">🚀 Ekip Çalışması</h3>
                    <p style="margin: 0; color: #718096; font-size: 14px;">Ekibinizle gerçek zamanlı işbirliği yapın</p>
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="{{{DASHBOARD_URL}}}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Hemen Başlayın
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #718096; font-size: 14px; line-height: 1.6; padding: 16px; background-color: #fef3c7; border-radius: 8px;">
                💡 <strong>İpucu:</strong> İlk siparişinizi oluşturarak sistemi keşfetmeye başlayın!
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 24px 48px; background-color: #f7fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; text-align: center;">
                Sorularınız mı var? Bize ulaşın: destek@renkflow.com
              </p>
              <p style="margin: 8px 0 0; color: #a0aec0; font-size: 12px; text-align: center;">
                © 2024 Renkflow. Tüm hakları saklıdır.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      variables: [
        { key: 'USER_NAME', type: 'string', fallbackValue: 'Kullanıcı' },
        { key: 'DASHBOARD_URL', type: 'string', fallbackValue: '#' },
      ],
    });
    console.log('✅ Created:', welcomeTemplate.id, '\n');

    console.log('🎉 All templates created successfully!\n');
    console.log('Template IDs:');
    console.log('1. Email Verification:', verifyTemplate.id);
    console.log('2. Password Reset:', resetTemplate.id);
    console.log('3. Team Invitation:', inviteTemplate.id);
    console.log('4. Order Confirmation:', orderTemplate.id);
    console.log('5. Welcome Email:', welcomeTemplate.id);

  } catch (error) {
    console.error('❌ Error creating templates:', error);
    throw error;
  }
}

// Run the script
createTemplates()
  .then(() => {
    console.log('\n✅ Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  });
