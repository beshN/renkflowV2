/** @jest-environment node */
import { prepareBrowserFile } from '@/lib/storage/client';
import { upload } from '@vercel/blob/client';
jest.mock('@vercel/blob/client',()=>({upload:jest.fn().mockResolvedValue({pathname:'uploads/tenant/user/uuid'})}));
it('retains the real MIME type on multipart uploads with extensionless UUID keys',async()=>{
 const fetchMock=jest.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({directUpload:true,scope:'tenant/user'}));
 try {
  const file=new File(['%PDF-'+ 'x'.repeat(6*1024*1024)],'technical.pdf',{type:'application/pdf'});
  const result=await prepareBrowserFile(file);
  expect(upload).toHaveBeenCalledWith(expect.stringContaining('uploads/tenant/user/'),file,expect.objectContaining({access:'private',contentType:'application/pdf',multipart:true}));
  expect(result).toEqual({name:'technical.pdf',mime:'application/pdf',blobPath:'uploads/tenant/user/uuid'});
 } finally {fetchMock.mockRestore();}
});
