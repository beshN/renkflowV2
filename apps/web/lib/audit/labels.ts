/** Turkish names for the audit trail's actions and record types (unknown ones show as they are). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  access_denied: 'Yetkisiz deneme', member_role_changed: 'Rol değişti', member_deactivated: 'Üye pasifleştirildi', member_reactivated: 'Üye etkinleştirildi',
  member_invited: 'Davet gönderildi', invite_revoked: 'Davet iptal edildi', role_created: 'Rol oluşturuldu', role_updated: 'Rol güncellendi', role_deleted: 'Rol silindi',
  session_revoked: 'Oturum kapatıldı', sessions_revoked_all: 'Tüm oturumlar kapatıldı', created: 'Oluşturuldu', updated: 'Güncellendi', deleted: 'Silindi',
  status_changed: 'Durum değişti', settings_updated: 'Ayar değişti', comment_added: 'Yorum eklendi',
  login_succeeded: 'Giriş yapıldı', login_failed: 'Başarısız giriş', period_status_changed: 'Dönem durumu değişti',
  mfa_enabled: 'İki adımlı doğrulama açıldı', mfa_disabled: 'İki adımlı doğrulama kapatıldı', mfa_recovery_code_used: 'Kurtarma kodu kullanıldı',
};
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  security: 'Güvenlik', member: 'Üye', access_role: 'Rol', tenant: 'Firma', order: 'Sipariş', quotation: 'Teklif', customer: 'Müşteri',
  work_order: 'Üretim emri', purchase_order: 'Satın alma', inventory_item: 'Stok kalemi', supplier: 'Tedarikçi', settings: 'Ayarlar',
  user: 'Kullanıcı', accounting_period: 'Muhasebe dönemi',
};
export const auditActionLabel = (a: string) => AUDIT_ACTION_LABELS[a] ?? a;
export const auditEntityLabel = (e: string) => AUDIT_ENTITY_LABELS[e] ?? e;
