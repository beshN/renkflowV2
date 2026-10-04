import dotenv from "dotenv";
import { inspectDeploymentEnvironment } from "../lib/config/deployment-env";
// Never load development secrets into a Vercel build. NEXT_PUBLIC values are inlined at build time.
if (!process.env.VERCEL) dotenv.config({path:".env.local",quiet:true});
if (process.argv.includes("--deployment") && !process.env.VERCEL) {
 console.error("Vercel build requires a linked deployment environment. Use npm run build for local builds.");
 process.exit(1);
}
const result=inspectDeploymentEnvironment(process.env);
for (const message of result.errors) console.error(`[env] ${message}`);
for (const message of result.warnings) console.warn(`[env] ${message}`);
console.log(`[env] ${result.target}: ${result.errors.length} errors, ${result.warnings.length} warnings (values hidden)`);
if (result.errors.length) process.exitCode=1;
