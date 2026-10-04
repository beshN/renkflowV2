/** Optional private pilot restriction; unset for normal multi-user deployments. */
export function privateAccessEmail() { return process.env.PRIVATE_ACCESS_EMAIL?.trim().toLowerCase() || ''; }
export function isPrivateAccessAllowed(email: unknown) {
 const allowed=privateAccessEmail();
 return !allowed || (typeof email==='string' && email.trim().toLowerCase()===allowed);
}
