'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useSession } from 'next-auth/react';
import { requestJson } from '@/lib/shared/network';
/** Tenant/user scoped read model and replay-safe online commands. */
export function useCommandWorkspace<T>(url:string){
  const {data:session}=useSession(),scope=(session?.user?.tenantId || '')+':'+(session?.user?.id || '');
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const active=useRef(scope),controller=useRef<AbortController|null>(null),sequence=useRef(0),lock=useRef(false),pending=useRef<{hash:string;id:string}|null>(null);
  active.current=scope;
  const reload=useCallback(async()=>{
    controller.current?.abort();const ac=new AbortController();controller.current=ac;const seq=++sequence.current;setLoading(true);
    const result=await requestJson<{data:T}>(url,{signal:ac.signal,cache:'no-store'},{timeoutMs:20000});
    if(ac.signal.aborted || seq!==sequence.current || active.current!==scope)return;
    if(result.ok && result.data){setData(result.data.data);setError('');}else{setError(result.error || 'Kayıtlar alınamadı');if([401,403].includes(result.status))setData(null);}setLoading(false);
  },[url,scope]);
  useEffect(()=>{setData(null);pending.current=null;void reload();return()=>controller.current?.abort();},[reload]);
  const command=async(action:string,input:Record<string,unknown>)=>{
    if(lock.current)return null;lock.current=true;setBusy(true);setError('');
    const hash=JSON.stringify({action,data:input});if(pending.current?.hash!==hash)pending.current={hash,id:crypto.randomUUID()};
    const result=await requestJson<{data:unknown}>('/api/v1/production',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({commandId:pending.current.id,action,data:input})},{timeoutMs:30000});
    lock.current=false;setBusy(false);if(active.current!==scope)return null;
    if(!result.ok){setError(result.error || 'İşlem kaydedilemedi');return null;}
    pending.current=null;await reload();return result.data?.data;
  };
  return {data,error,loading,busy,reload,command};
}
