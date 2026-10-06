/** @jest-environment node */
import { runCron } from "@/lib/features/manufacturing/cron";
import { drainNotifications } from "@/lib/features/manufacturing/notification.service";
import { drainInbound } from "@/lib/features/manufacturing/inbound.service";
import { drainStorageCleanup } from "@/lib/features/orders/deletion.service";
jest.mock("@/lib/security/rate-limit",()=>({pruneRateLimitBuckets:jest.fn().mockResolvedValue(0)}));
jest.mock("@/lib/storage/orphan-cleanup",()=>({sweepAbandonedUploads:jest.fn().mockResolvedValue({deleted:0})}));
jest.mock("server-only",()=>({}));
jest.mock("@/lib/features/manufacturing/notification.service",()=>({drainNotifications:jest.fn().mockResolvedValue(0)}));
jest.mock("@/lib/features/manufacturing/inbound.service",()=>({drainInbound:jest.fn().mockResolvedValue(0)}));
jest.mock("@/lib/features/orders/deletion.service",()=>({drainStorageCleanup:jest.fn().mockResolvedValue({done:0})}));
describe("Vercel production queues",()=>{
 const old=process.env;
 const request=(secret="a".repeat(48))=>new Request("https://renkflow.example/api/cron/inbound",{headers:{Authorization:`Bearer ${secret}`}});
 beforeEach(()=>{process.env={...old,VERCEL_ENV:"production",CRON_SECRET:"a".repeat(48)};});
 afterEach(()=>{process.env=old;});
 it("rejects unauthenticated requests without claiming jobs",async()=>{expect((await runCron(request("wrong"),"inbound")).status).toBe(401);expect(drainInbound).not.toHaveBeenCalled();});
 it("rejects requests when the secret is missing",async()=>{delete process.env.CRON_SECRET;expect((await runCron(request(),"inbound")).status).toBe(401);});
 it("never delivers from previews even with the correct cron secret",async()=>{process.env.VERCEL_ENV="preview";expect((await runCron(request(),"notifications")).status).toBe(403);expect(drainNotifications).not.toHaveBeenCalled();});
 it("limits inbox work to one message per invocation",async()=>{expect((await runCron(request(),"inbound")).status).toBe(200);expect(drainInbound).toHaveBeenCalledWith(1);});
 it("bounds notifications and storage cleanup separately",async()=>{await runCron(request(),"notifications");await runCron(request(),"storage-cleanup");expect(drainNotifications).toHaveBeenCalledWith(5);expect(drainStorageCleanup).toHaveBeenCalledWith(undefined,20);});
 it("reports failure for scheduler monitoring without provider details",async()=>{jest.spyOn(console,"error").mockImplementation(()=>{});(drainInbound as jest.Mock).mockRejectedValueOnce(new Error("secret-value"));const response=await runCron(request(),"inbound");expect(response.status).toBe(500);expect(await response.text()).not.toContain("secret-value");jest.restoreAllMocks();});
});
