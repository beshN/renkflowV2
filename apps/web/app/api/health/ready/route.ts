import { checkDatabaseHealth } from "@/lib/db";
import { inspectDeploymentEnvironment } from "@/lib/config/deployment-env";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET() {
 const config = inspectDeploymentEnvironment(process.env);
 const healthy = config.errors.length===0 && await checkDatabaseHealth();
 return Response.json({status:healthy ? "ready" : "unavailable"},{status:healthy ? 200 : 503,headers:{"Cache-Control":"no-store"}});
}
