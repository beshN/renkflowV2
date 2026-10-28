/**
 * The firm's two-step sign-in policy: when it is on, owners and admins must set up two-step
 * sign-in before they can use the workspace. They are sent to the account page instead of being
 * locked out, so they can always set it up or sign out.
 */
export const MFA_POLICY_ROLES = ['owner', 'admin'] as const;

/** The path the workspace keeps open while set-up is outstanding (account security). */
export const MFA_SETUP_PATH = '/account';
export const MFA_SETUP_URL = `${MFA_SETUP_PATH}?mfa=required`;
/** Window event the account page fires after two-step sign-in is turned on or off. */
export const MFA_CHANGED_EVENT = 'rf:mfa-changed';

export const MFA_POLICY_ENABLE_NEEDS_OWN_MFA =
  'Bu kuralı açmadan önce kendi hesabınızda iki adımlı doğrulamayı açın (Hesabım → Güvenlik). Böylece firma hesabına erişiminiz kesilmez.';
export const MFA_POLICY_OWNER_ONLY = 'Bu ayarı yalnız firma sahibi değiştirebilir.';
export const MFA_POLICY_UNAVAILABLE = 'Bu ayar henüz etkin değil.';

export function policyCoversRole(role: string | null | undefined): boolean {
  return (MFA_POLICY_ROLES as readonly string[]).includes(String(role || ''));
}

/** Whether this member must set up two-step sign-in before using the workspace. */
export function mfaSetupRequired(input: { policyOn: boolean; role: string | null | undefined; mfaAvailable: boolean; mfaEnabled: boolean }): boolean {
  return input.policyOn && input.mfaAvailable && policyCoversRole(input.role) && !input.mfaEnabled;
}

/** Null when the change may go ahead, otherwise the Turkish reason it may not. */
export function policyChangeProblem(input: { actorRole: string | null | undefined; enabling: boolean; actorMfaEnabled: boolean; available: boolean }): string | null {
  if (!input.available) return MFA_POLICY_UNAVAILABLE;
  if (input.actorRole !== 'owner') return MFA_POLICY_OWNER_ONLY;
  if (input.enabling && !input.actorMfaEnabled) return MFA_POLICY_ENABLE_NEEDS_OWN_MFA;
  return null;
}

/** Pages a member who still has to set it up may open: account security (and below it). */
export function pathAllowedDuringMfaSetup(pathname: string | null | undefined): boolean {
  const path = String(pathname || '');
  return path === MFA_SETUP_PATH || path.startsWith(`${MFA_SETUP_PATH}/`);
}

/** Error code an API answers with while set-up is outstanding (HTTP 403). */
export const MFA_SETUP_REQUIRED_CODE = 'mfa_setup_required';
export const MFA_SETUP_REQUIRED_MESSAGE =
  'Firmanız, sahip ve yönetici hesapları için iki adımlı doğrulamayı zorunlu tutuyor. Hesabım → Güvenlik bölümünden kurulumu tamamlayın.';
/** Why no API or phone token is issued to such an account. */
export const MFA_SETUP_REQUIRED_LOGIN_MESSAGE =
  'Firmanız, sahip ve yönetici hesapları için iki adımlı doğrulamayı zorunlu tutuyor. Önce web üzerinden giriş yapıp Hesabım → Güvenlik bölümünden iki adımlı doğrulamayı kurun.';

/**
 * Endpoints a member who still has to set it up may call: signing in and out (Auth.js), their own
 * account (gate, two-step set-up, legal consent, sessions, notification choices, access), who they
 * are, and closing a phone session. Every other API answers 403 mfa_setup_required.
 */
const MFA_SETUP_API_PREFIXES = ['/api/auth/', '/api/v1/me/'];
const MFA_SETUP_API_EXACT = new Set(['/api/v1/auth/me', '/api/mobile/v1/auth/me', '/api/mobile/v1/auth/logout']);

/** Whether a path stays open while set-up is outstanding (pages: the account page; APIs: the list above). */
export function mfaSetupAllowsPath(pathname: string | null | undefined): boolean {
  const path = String(pathname || '');
  if (!path.startsWith('/api/')) return pathAllowedDuringMfaSetup(path);
  return MFA_SETUP_API_EXACT.has(path) || MFA_SETUP_API_PREFIXES.some((p) => path.startsWith(p));
}
