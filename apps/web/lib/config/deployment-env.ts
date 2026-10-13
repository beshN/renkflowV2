/** Pure validation shared by the deployment gate, readiness probe and env tooling. Never logs values. */
type Environment = Record<string, string | undefined>;
export function inspectDeploymentEnvironment(env: Environment) {
 const errors: string[] = [], warnings: string[] = [];
 const isDeployment = Boolean(env.VERCEL || env.VERCEL_ENV);
 const target = env.VERCEL_ENV || env.DEPLOYMENT_ENVIRONMENT || "development";
 const required = (name:string) => {if (!env[name]?.trim()) errors.push(`${name} is required`);};
 required("DATABASE_URL");
 required("AUTH_SECRET");
 if (env.AUTH_SECRET && env.AUTH_SECRET.trim().length < 32) errors.push("AUTH_SECRET must contain at least 32 characters");
 if (env.NEXTAUTH_SECRET && env.NEXTAUTH_SECRET !== env.AUTH_SECRET) errors.push("NEXTAUTH_SECRET must equal AUTH_SECRET within the same environment");
 if (isDeployment) {
  if (env.DEPLOYMENT_ENVIRONMENT !== target) errors.push("DEPLOYMENT_ENVIRONMENT must match VERCEL_ENV (use environment-specific values)");
  if (env.STORAGE_BACKEND !== "vercel-blob") errors.push("STORAGE_BACKEND must be vercel-blob on Vercel");
  if (!env.BLOB_READ_WRITE_TOKEN) errors.push("BLOB_READ_WRITE_TOKEN is required for direct browser uploads");
  if (env.ALLOW_LOCAL_DATABASE === "1" || env.ALLOW_LOCAL_STORAGE === "1") errors.push("Local test bypasses must be disabled on Vercel");
  if (env.API_CORS_ALLOW_ALL === "true") errors.push("API_CORS_ALLOW_ALL must be false");
  if (env.AUTH_DEBUG === "true") errors.push("AUTH_DEBUG must be false");
  if (env.NATIVE_INVENTORY_ENABLED !== "1") errors.push("NATIVE_INVENTORY_ENABLED must be 1 for the manufacturing platform");
  required("ANTHROPIC_API_KEY");
  if (env.AI_PROVIDER && env.AI_PROVIDER !== "anthropic") errors.push("AI_PROVIDER must be anthropic (or unset)");
  if (env.ANTHROPIC_MODEL && env.ANTHROPIC_MODEL !== "claude-haiku-5-5") errors.push("ANTHROPIC_MODEL must be claude-haiku-5-5 (or unset)");
  if (target === "production") {
   required("APP_URL"); required("CRON_SECRET");
   if (env.CRON_SECRET && env.CRON_SECRET.trim().length < 32) errors.push("CRON_SECRET must contain at least 32 characters");
  }
 }
 if (env.DATABASE_URL) {
  try {
   const url=new URL(env.DATABASE_URL);
   if (!["postgres:","postgresql:"].includes(url.protocol)) errors.push("DATABASE_URL must use PostgreSQL");
   if (isDeployment) {
    if (["localhost","127.0.0.1","[::1]"].includes(url.hostname) || url.searchParams.has("host")) errors.push("DATABASE_URL must use a remote TCP database on Vercel");
    if (!["require","verify-full","verify-ca"].includes(url.searchParams.get("sslmode") || "")) errors.push("DATABASE_URL must require TLS (sslmode=require or stricter)");
   }
  } catch {errors.push("DATABASE_URL is invalid");}
 }
 for (const name of ["APP_URL","AUTH_URL","NEXTAUTH_URL","NEXT_PUBLIC_APP_URL"]) {
  if (!env[name]) continue;
  try {
   const u=new URL(env[name]);
   if (!["https:","http:"].includes(u.protocol) || u.username || u.password || u.pathname!=="/" || u.search || u.hash) errors.push(`${name} must be an HTTP origin`);
   if (isDeployment && (u.protocol!=="https:" || ["localhost","127.0.0.1"].includes(u.hostname))) errors.push(`${name} must be a public HTTPS origin`);
   if (isDeployment && target==="preview") errors.push(`${name} must be unset in Preview; the origin comes from VERCEL_URL`);
  } catch {errors.push(`${name} is invalid`);}
 }
 for (const [name,value] of Object.entries(env)) {
  if (value && name.startsWith("NEXT_PUBLIC_") && /SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|DATABASE_URL/.test(name)) errors.push(`${name} exposes a secret to the browser`);
 }
 if (isDeployment && env.RESEND_API_KEY && !env.EMAIL_FROM) errors.push("EMAIL_FROM is required when RESEND_API_KEY is set");
 if (isDeployment && target==="production" && !env.RESEND_API_KEY) warnings.push("Email/password-reset delivery is not configured (RESEND_API_KEY, EMAIL_FROM)");
 if (isDeployment && target==="production" && !env.DATABASE_URL_UNPOOLED) warnings.push("DATABASE_URL_UNPOOLED must be supplied for the separate migration step");
 return {target,errors,warnings};
}
