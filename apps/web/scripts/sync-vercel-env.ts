import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import { inspectDeploymentEnvironment } from "../lib/config/deployment-env";
const args=process.argv.slice(2), target=args[0], file=args[1];
if (!["preview","production"].includes(target) || !file || !file.endsWith(".local")) {
 console.error("Usage: npm run vercel:env:sync -- preview|production .env.vercel.<environment>.local");process.exit(1);
}
const values=dotenv.parse(readFileSync(file));
const template=dotenv.parse(readFileSync(`.env.vercel.${target}.example`));
const optional=dotenv.parse(readFileSync(".env.example"));
const result=inspectDeploymentEnvironment({...values,VERCEL:"1",VERCEL_ENV:target});
if(result.errors.length) {result.errors.forEach(e=>console.error(`[env] ${e}`));process.exit(1);}
const aliasNames=["APP_URL","AUTH_URL","NEXTAUTH_URL","NEXT_PUBLIC_APP_URL"];
if(target==="preview" && aliasNames.some(k=>values[k])) {console.error("Preview URL aliases must be unset");process.exit(1);}
const run=(parts:string[],input?:string)=>spawnSync("npx",["--yes","vercel@62.2.0",...parts],{input,encoding:"utf8",stdio:["pipe","pipe","pipe"]});
const who=run(["whoami"]);
if(who.status!==0){console.error("Vercel CLI authentication required; run npx vercel@62.2.0 login");process.exit(1);}
const listed=run(["env","ls",target,"--format","json"]);
if(listed.status!==0){console.error("Cannot read linked Vercel environment metadata");process.exit(1);}
let existing:string[];
try {const parsed=JSON.parse(listed.stdout);existing=(parsed.envs||parsed).map((e:{key:string})=>e.key);}catch{console.error("Unexpected env metadata format; no changes made");process.exit(1);}
for(const [key,value] of Object.entries(values)) {
 if(!(key in template) && !(key in optional)) continue;
 if(!value.trim()) continue;
 if(["NODE_ENV","NEXT_PHASE","ALLOW_LEGACY_DATABASE_HOSTS","NEXT_PUBLIC_SOCKET_URL","NEXT_PUBLIC_WS_URL"].includes(key)) continue;
 const sensitive=/SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|ENCRYPTION_KEY|DATABASE_URL/.test(key);
 const cmd=["env",existing.includes(key)?"update":"add",key,target,"--yes",...(sensitive?["--sensitive"]:[])];
 const outcome=run(cmd,value.trim());
 if(outcome.status!==0){console.error(`[env] ${key} failed; provider output withheld to protect values`);process.exit(1);}
 console.log(`[env] ${target}: ${key} saved${sensitive ? " (sensitive)" : ""}`);
}
// Preview aliases inherited from old deployments can redirect sessions into production.
if(target==="preview") for(const key of aliasNames.filter(k=>existing.includes(k))) {
 const removed=run(["env","rm",key,target,"--yes"]);
 if(removed.status!==0){console.error(`[env] Cannot remove Preview alias ${key}`);process.exit(1);}
}
console.log("Environment saved. A new deployment is required for changes to take effect.");
