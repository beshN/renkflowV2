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
