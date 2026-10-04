/** @jest-environment node */
import { sweepAbandonedUploads } from "@/lib/storage/orphan-cleanup";
import { sql } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { list } from "@vercel/blob";
jest.mock("server-only",()=>({}));
jest.mock("@/lib/db",()=>({sql:{begin:jest.fn()}}));
jest.mock("@/lib/storage",()=>({deleteFile:jest.fn()}));
jest.mock("@vercel/blob",()=>({list:jest.fn()}));
it("preserves referenced and recent files while sweeping expired, unreferenced uploads",async()=>{
 const old=process.env.STORAGE_BACKEND;process.env.STORAGE_BACKEND="vercel-blob";
 const tx=jest.fn().mockResolvedValueOnce([{cursor:"cursor-before"}]).mockResolvedValueOnce([{present:true}]).mockResolvedValueOnce([{present:false}]).mockResolvedValueOnce([]);
 (sql.begin as jest.Mock).mockImplementation(fn=>fn(tx));
 (list as jest.Mock).mockResolvedValue({blobs:[{pathname:"uploads/referenced",uploadedAt:new Date(0)},{pathname:"uploads/recent",uploadedAt:new Date()},{pathname:"uploads/abandoned",uploadedAt:new Date(0)}],hasMore:true,cursor:"cursor-after"});
 try {
  expect(await sweepAbandonedUploads()).toEqual({deleted:1});
  expect(deleteFile).toHaveBeenCalledTimes(1);expect(deleteFile).toHaveBeenCalledWith("uploads/abandoned");
  expect(list).toHaveBeenCalledWith({prefix:"uploads/",limit:20,cursor:"cursor-before"});
  expect(tx.mock.calls.at(-1)?.[1]).toBe("cursor-after");
 } finally {process.env.STORAGE_BACKEND=old;}
});
