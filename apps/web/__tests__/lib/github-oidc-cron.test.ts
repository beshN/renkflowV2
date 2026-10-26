/** @jest-environment node */
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { cronAuthorized, runCron } from "@/lib/features/manufacturing/cron";
import { resetGitHubJwksCache, verifyGitHubCronToken } from "@/lib/security/github-oidc";
import { drainNotifications } from "@/lib/features/manufacturing/notification.service";
jest.mock("server-only",()=>({}));
jest.mock("@/lib/security/rate-limit",()=>({pruneRateLimitBuckets:jest.fn().mockResolvedValue(0)}));
jest.mock("@/lib/storage/orphan-cleanup",()=>({sweepAbandonedUploads:jest.fn().mockResolvedValue({deleted:0})}));
jest.mock("@/lib/features/manufacturing/notification.service",()=>({drainNotifications:jest.fn().mockResolvedValue(0)}));
jest.mock("@/lib/features/manufacturing/inbound.service",()=>({drainInbound:jest.fn().mockResolvedValue(0)}));
jest.mock("@/lib/features/orders/deletion.service",()=>({drainStorageCleanup:jest.fn().mockResolvedValue({done:0})}));
jest.mock("@/lib/features/fleet/retention.server",()=>({pruneVehiclePositions:jest.fn().mockResolvedValue(0)}));

const keyA = generateKeyPairSync("rsa",{modulusLength:2048});
const keyB = generateKeyPairSync("rsa",{modulusLength:2048});
const jwk = (publicKey: KeyObject, kid: string) => ({...publicKey.export({format:"jwk"}),kid,use:"sig",alg:"RS256"});
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = () => Math.floor(Date.now()/1000);
const goodClaims = () => ({
 iss:"https://token.actions.githubusercontent.com",
 aud:"renkflow-cron",
 iat:now()-5, nbf:now()-5, exp:now()+300,
 repository:"beshN/renkflowV2",
 ref:"refs/heads/main",
 workflow_ref:"beshN/renkflowV2/.github/workflows/cron.yml@refs/heads/main",
 job_workflow_ref:"beshN/renkflowV2/.github/workflows/cron.yml@refs/heads/main",
 event_name:"schedule",
});
function token(claims: Record<string, unknown> = goodClaims(), {kid="key-a",privateKey=keyA.privateKey,alg="RS256"}: {kid?: string; privateKey?: KeyObject; alg?: string} = {}) {
 const input = `${b64({alg,kid,typ:"JWT"})}.${b64(claims)}`;
 return `${input}.${sign("RSA-SHA256",Buffer.from(input),privateKey).toString("base64url")}`;
}
const request = (auth: string) => new Request("https://renkflow.example/api/cron/notifications",{headers:{Authorization:auth}});

describe("GitHub OIDC cron authorization",()=>{
 const old = process.env;
 let jwks: {keys: unknown[]};
 let fetchMock: jest.Mock;
 beforeEach(()=>{
  process.env = {...old,VERCEL_ENV:"production",CRON_SECRET:"a".repeat(48)};
  delete process.env.CRON_OIDC_REPOSITORY;
  resetGitHubJwksCache();
  jwks = {keys:[jwk(keyA.publicKey,"key-a")]};
  fetchMock = jest.fn(async()=>new Response(JSON.stringify(jwks),{status:200,headers:{"Content-Type":"application/json"}}));
  global.fetch = fetchMock as unknown as typeof fetch;
 });
 afterEach(()=>{process.env = old;jest.restoreAllMocks();});

 it("accepts a valid token and caches the key set",async()=>{
  expect(await verifyGitHubCronToken(token())).toBe(true);
  expect(await verifyGitHubCronToken(token({...goodClaims(),event_name:"workflow_dispatch"}))).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("https://token.actions.githubusercontent.com/.well-known/jwks");
 });

 it.each([
  ["audience",{aud:"sts.amazonaws.com"}],
  ["issuer",{iss:"https://evil.example"}],
  ["repository",{repository:"someone/renkflowV2"}],
  ["ref",{ref:"refs/heads/feature"}],
  ["workflow",{workflow_ref:"beshN/renkflowV2/.github/workflows/other.yml@refs/heads/main"}],
  ["workflow branch",{workflow_ref:"beshN/renkflowV2/.github/workflows/cron.yml@refs/heads/main-evil"}],
  ["job workflow",{job_workflow_ref:"evil/repo/.github/workflows/cron.yml@refs/heads/main"}],
  ["event",{event_name:"pull_request"}],
  ["expiry",{exp:now()-120}],
  ["future iat",{iat:now()+600}],
  ["not yet valid",{nbf:now()+600}],
 ])("rejects a wrong %s",async(_name,override)=>{
  expect(await verifyGitHubCronToken(token({...goodClaims(),...override}))).toBe(false);
 });

 it("honours CRON_OIDC_REPOSITORY",async()=>{
  process.env.CRON_OIDC_REPOSITORY = "acme/fork";
  expect(await verifyGitHubCronToken(token())).toBe(false);
  expect(await verifyGitHubCronToken(token({...goodClaims(),repository:"acme/fork",workflow_ref:"acme/fork/.github/workflows/cron.yml@refs/heads/main",job_workflow_ref:"acme/fork/.github/workflows/cron.yml@refs/heads/main"}))).toBe(true);
 });

 it("rejects a bad signature, a tampered payload and other algorithms",async()=>{
  expect(await verifyGitHubCronToken(token(goodClaims(),{privateKey:keyB.privateKey}))).toBe(false);
  const [h,,s] = token().split(".");
  expect(await verifyGitHubCronToken(`${h}.${b64({...goodClaims(),repository:"beshN/renkflowV2",event_name:"workflow_dispatch"})}.${s}`)).toBe(false);
  const none = `${b64({alg:"none",kid:"key-a"})}.${b64(goodClaims())}.x`;
  expect(await verifyGitHubCronToken(none)).toBe(false);
  expect(await verifyGitHubCronToken(token(goodClaims(),{alg:"HS256"}))).toBe(false);
 });

 it("refetches the key set once for an unknown kid (rotation)",async()=>{
  expect(await verifyGitHubCronToken(token())).toBe(true);
  jwks = {keys:[jwk(keyA.publicKey,"key-a"),jwk(keyB.publicKey,"key-b")]};
  const later = Date.now()+5*60_000;
  jest.spyOn(Date,"now").mockReturnValue(later);
  expect(await verifyGitHubCronToken(token(goodClaims(),{kid:"key-b",privateKey:keyB.privateKey}))).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  // A forged kid right after a refetch does not trigger another one.
  expect(await verifyGitHubCronToken(token(goodClaims(),{kid:"forged"}))).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(2);
 });

 it("fails closed when the key set cannot be fetched",async()=>{
  jest.spyOn(console,"warn").mockImplementation(()=>{});
  fetchMock.mockResolvedValueOnce(new Response("down",{status:503}));
  expect(await verifyGitHubCronToken(token())).toBe(false);
 });

 it("keeps accepting the CRON_SECRET bearer and rejects garbage",async()=>{
  expect(await cronAuthorized(request(`Bearer ${"a".repeat(48)}`))).toBe(true);
  expect(await cronAuthorized(request(`Bearer ${"a".repeat(48)}`),{allowGitHubOidc:true})).toBe(true);
  for (const garbage of ["","Bearer","Bearer abc","Bearer a.b.c","Basic Zm9vOmJhcg==",`Bearer ${"x".repeat(9000)}.a.b`]) expect(await cronAuthorized(request(garbage),{allowGitHubOidc:true})).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
 });

 it("accepts OIDC only for the GitHub-drained queues and only in production",async()=>{
  delete process.env.CRON_SECRET;
  const auth = `Bearer ${token()}`;
  expect(await cronAuthorized(request(auth))).toBe(false);
  expect((await runCron(request(auth),"notifications")).status).toBe(200);
  expect(drainNotifications).toHaveBeenCalledWith(5);
  expect((await runCron(request(auth),"storage-cleanup")).status).toBe(401);
  expect((await runCron(request(auth),"fx")).status).toBe(401);
  process.env.VERCEL_ENV = "preview";
  expect((await runCron(request(auth),"inbound")).status).toBe(403);
 });
});
