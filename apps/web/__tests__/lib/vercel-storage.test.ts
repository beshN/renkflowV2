/** @jest-environment node */
import { uploadFile, readFile, getFileUrl, deleteFile, validateStorageKey, generateFilePath } from "@/lib/storage";
import { put, get, del } from "@vercel/blob";
jest.mock("server-only",()=>({}));
jest.mock("@vercel/blob",()=>({put:jest.fn(),get:jest.fn(),del:jest.fn()}));
describe("private Vercel Blob storage",()=>{
 const before=process.env;
 beforeEach(()=>{process.env={...before,STORAGE_BACKEND:"vercel-blob",BLOB_READ_WRITE_TOKEN:"private-token"};});
 afterEach(()=>{process.env=before;});
 it.each(["../private","https://evil.example/file","/orders/id/file","orders/id/../secret","orders//file","orders/file?token=x"])("rejects unsafe path %s",key=>expect(()=>validateStorageKey(key)).toThrow());
 it("keeps content private and returns a protected application URL",async()=>{const url=await uploadFile("orders/job/file.pdf",Buffer.from("pdf"),"application/pdf");expect(put).toHaveBeenCalledWith("orders/job/file.pdf",expect.any(Buffer),expect.objectContaining({access:"private",allowOverwrite:false,addRandomSuffix:false}));expect(url).toBe("/api/storage/content?key=orders%2Fjob%2Ffile.pdf");});
 it("streams private files and never fetches a public URL",async()=>{const stream=new ReadableStream();(get as jest.Mock).mockResolvedValue({statusCode:200,stream,blob:{size:7,contentType:"application/pdf"}});expect(await readFile("orders/job/file.pdf")).toMatchObject({body:stream,size:7,contentType:"application/pdf"});expect(get).toHaveBeenCalledWith("orders/job/file.pdf",{access:"private",useCache:false});});
 it("preserves authorization URLs without secret query parameters",async()=>expect(await getFileUrl("orders/id/file")).not.toContain("private-token"));
 it("deletes using the stable key",async()=>{await deleteFile("orders/id/file");expect(del).toHaveBeenCalledWith("orders/id/file");});
 it("creates collision-resistant keys for same-name uploads",()=>expect(generateFilePath("id","çizim.pdf")).not.toEqual(generateFilePath("id","çizim.pdf")));
 it("fails rather than falling back to public storage",async()=>{delete process.env.BLOB_READ_WRITE_TOKEN;delete process.env.BLOB_STORE_ID;await expect(uploadFile("orders/id/file",Buffer.from("pdf"),"application/pdf")).rejects.toThrow("yapılandırılmamış");});
});
