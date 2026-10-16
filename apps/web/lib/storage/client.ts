"use client";
export type BrowserFileInput = {name:string;mime:string;base64:string;workOrderId?:string};
/** Local development uses the existing JSON flow; deployed uploads bypass the 4.5 MB function limit. */
export async function prepareFileUpload(input: BrowserFileInput) {
 const response = await fetch("/api/storage/upload",{cache:"no-store",signal:AbortSignal.timeout(15000)});
 const config = await response.json();
 if (!response.ok) throw new Error(config.error || "Yükleme yetkisi alınamadı");
 if (!config.directUpload) {
  if (input.base64.length > 4_000_000 && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") throw new Error("Büyük dosyalar için doğrudan Blob yüklemesi etkinleştirilmeli");
  return input;
 }
 const bytes = Uint8Array.from(atob(input.base64), c=>c.charCodeAt(0));
 const pathname = `uploads/${config.scope}/${crypto.randomUUID()}`;
 const file = new File([bytes],input.name,{type:input.mime});
 const {upload} = await import("@vercel/blob/client");
 const result = await upload(pathname,file,{access:"private",contentType:input.mime,handleUploadUrl:"/api/storage/upload",clientPayload:JSON.stringify({mime:input.mime,workOrderId:input.workOrderId}),multipart:file.size>4*1024*1024});
 return {name:input.name,mime:input.mime,workOrderId:input.workOrderId,blobPath:result.pathname};
}

export type UploadedFileReference = {name:string;mime:string;blobPath:string};
export async function prepareBrowserFile(file:File, purpose:"order"|"finance"|"qr"|"knowledge"="order", qrToken?:string):Promise<File|UploadedFileReference> {
 const response=await fetch("/api/storage/upload",{cache:"no-store",signal:AbortSignal.timeout(15000)});
 const config=await response.json();
 if(!response.ok) throw new Error(config.error || "Yükleme yetkisi alınamadı");
 if(!config.directUpload) return file;
 const {upload} = await import("@vercel/blob/client");
 const result=await upload(`uploads/${config.scope}/${crypto.randomUUID()}`,file,{access:"private",contentType:file.type,handleUploadUrl:"/api/storage/upload",clientPayload:JSON.stringify({mime:file.type,purpose,qrToken}),multipart:file.size>4*1024*1024});
 return {name:file.name,mime:file.type,blobPath:result.pathname};
}
