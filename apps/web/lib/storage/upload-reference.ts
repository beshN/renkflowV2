import "server-only";
import { z } from "zod";
import { readFile, validateStorageKey } from "@/lib/storage";
import { ORDER_ALLOWED_FILE_TYPES } from "@/lib/features/orders/constants";
export const UploadReferenceSchema=z.object({name:z.string().min(1).max(180),mime:z.enum(ORDER_ALLOWED_FILE_TYPES),blobPath:z.string().max(700)});
const storedKey=Symbol("verified-blob-key");
export function verifiedFileKey(file:File): string | undefined {return (file as File & {[storedKey]?:string})[storedKey];}
export async function resolveUploadedFile(actor:{tenantId:string;userId:string},raw:unknown):Promise<File> {
 const input=UploadReferenceSchema.parse(raw), key=validateStorageKey(input.blobPath);
 if(!key.startsWith(`uploads/${actor.tenantId}/${actor.userId}/`)) throw new Error("Yükleme bu kullanıcıya ait değil");
 const content=await readFile(key);
 if(content.uploadedAt && content.uploadedAt.getTime()<Date.now()-24*60*60*1000){await content.body.cancel();throw new Error("Yüklemenin süresi dolmuş, dosyayı yeniden yükleyin");}
 if(content.size>10*1024*1024 || content.size===0){await content.body.cancel();throw new Error("Geçersiz dosya boyutu");}
 if(content.contentType.split(';')[0]!==input.mime){await content.body.cancel();throw new Error("Dosya türü uyuşmuyor");}
 const reader=content.body.getReader(),chunks:Uint8Array[]=[];
 let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>10*1024*1024){await reader.cancel();throw new Error("Dosya sınırı aşıldı");}chunks.push(value);}
 const bytes=Buffer.concat(chunks);
 const valid=input.mime==='application/pdf'?bytes.subarray(0,4).toString()==='%PDF':input.mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):input.mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216:input.mime==='image/webp'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP':input.mime==='image/gif'?/^GIF8[79]a$/.test(bytes.subarray(0,6).toString()):input.mime.includes('openxmlformats')?bytes.subarray(0,2).toString()==='PK':bytes.subarray(0,4).equals(Buffer.from([208,207,17,224]));
 if(!valid)throw new Error("Dosya içeriği biçimiyle uyuşmuyor");
 const file=new File([new Uint8Array(bytes)],input.name,{type:input.mime});
 Object.defineProperty(file,storedKey,{value:key});
 return file;
}
