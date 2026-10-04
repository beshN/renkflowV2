/** @jest-environment node */
import { readFile } from "@/lib/storage";
import { resolveUploadedFile, verifiedFileKey } from "@/lib/storage/upload-reference";
jest.mock("server-only",()=>({}));
jest.mock("@/lib/storage",()=>({readFile:jest.fn(),validateStorageKey:(key:string)=>key}));
const actor={tenantId:"tenant",userId:"user"};
const raw={name:"document.pdf",mime:"application/pdf",blobPath:"uploads/tenant/user/id"};
function content(bytes="%PDF-content",contentType="application/pdf",uploadedAt=new Date()) {
 return {body:new Blob([bytes]).stream(),size:Buffer.byteLength(bytes),contentType,uploadedAt};
}
it("rejects another user's private Blob before reading it",async()=>{await expect(resolveUploadedFile(actor,{...raw,blobPath:"uploads/other/user/id"})).rejects.toThrow("ait değil");expect(readFile).not.toHaveBeenCalled();});
it("marks only server-verified files for reuse without re-uploading",async()=>{(readFile as jest.Mock).mockResolvedValue(content());const file=await resolveUploadedFile(actor,raw);expect(file.name).toBe("document.pdf");expect(verifiedFileKey(file)).toBe(raw.blobPath);expect(verifiedFileKey(new File(["%PDF-data"],"forged.pdf"))).toBeUndefined();});
it("checks actual MIME and content signature",async()=>{(readFile as jest.Mock).mockResolvedValueOnce(content("%PDF-data","image/jpeg")).mockResolvedValueOnce(content("malicious text"));await expect(resolveUploadedFile(actor,raw)).rejects.toThrow("türü uyuşmuyor");await expect(resolveUploadedFile(actor,raw)).rejects.toThrow("biçimiyle uyuşmuyor");});
it("expires abandoned upload finalization before retention cleanup",async()=>{(readFile as jest.Mock).mockResolvedValue(content("%PDF-data","application/pdf",new Date(Date.now()-25*60*60*1000)));await expect(resolveUploadedFile(actor,raw)).rejects.toThrow("süresi dolmuş");});
it("accepts a 6 MB PDF via reference, without putting its bytes in action arguments",async()=>{(readFile as jest.Mock).mockResolvedValue(content("%PDF-"+"a".repeat(6*1024*1024)));const file=await resolveUploadedFile(actor,raw);expect(file.size).toBeGreaterThan(4.5*1024*1024);expect(JSON.stringify(raw).length).toBeLessThan(200);});
