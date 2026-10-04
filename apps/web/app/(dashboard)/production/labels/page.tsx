import { redirect } from "next/navigation";
export default async function Labels({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {const q=await searchParams;const params=new URLSearchParams();if(typeof q.kind==="string")params.set("kind",q.kind);if(typeof q.id==="string")params.set("id",q.id);redirect("/warehouse/labels?"+params.toString());}
