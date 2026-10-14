'use client';
import { useEffect,useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import type { ModelUnavailableReason } from '@/lib/ai/policy';
import type { AssistantInsight } from '@/lib/ai/workspace';
export function useAssistantInsights() {
 const {user}=useAuth(),pathname=usePathname(),scope=user?[user.tenantId,user.id,user.role].join(':'):'';
 const [result,setResult]=useState<{scope:string;path:string;model?:{provider:string;id:string;label:string;verifiedResponse:boolean};insights:AssistantInsight[];brief:string;modelEnabled?:boolean;modelUnavailableReason?:ModelUnavailableReason}>({scope:'',path:'',insights:[],brief:''});
 useEffect(()=>{
  if(!scope)return;
  let active=true,controller:AbortController|null=null,fetching=false;
  async function refresh() {
   if(fetching || !navigator.onLine || document.visibilityState==='hidden')return;
   fetching=true;controller=new AbortController();
   try {
    const res=await fetch('/api/ai/insights?path='+encodeURIComponent(pathname),{signal:controller.signal,cache:'no-store'});
    if(!res.ok)return;
    const data=await res.json();if(!active)return;
    setResult({scope,path:pathname,model:data.model,insights:data.insights || [],brief:'',modelEnabled:Boolean(data.modelEnabled),modelUnavailableReason:data.modelUnavailableReason??undefined});
    // Model review runs automatically, once per scope per three minutes; alerts stay available without it.
    const key='rf.assistant.brief:'+scope;
    let saved:any=null;try{saved=JSON.parse(sessionStorage.getItem(key)||'null');}catch{/* Storage is optional. */}
    if(saved && Date.now()-saved.at<180000){if(saved.fingerprint===data.fingerprint)setResult(r=>r.scope===scope?{...r,brief:saved.text}:r);return;}
    try{sessionStorage.setItem(key,JSON.stringify({at:Date.now(),fingerprint:data.fingerprint,text:''}));}catch{/* Avoid blocking the workspace. */}
    if(!data.insights?.length || !data.modelEnabled)return;
    const summary=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Bu ekranın güncel verilerini incele. En önemli sonraki adımı 2 kısa cümleyle kendiliğinden öner. Kayıt değiştirme önerisi üretme.',context:{currentPath:pathname},history:[],mode:'proactive'}),signal:controller.signal});
    if(!summary.ok || !active)return;const body=await summary.json();
    if(body.response){setResult(r=>r.scope===scope&&r.path===pathname?{...r,brief:body.response}:r);try{sessionStorage.setItem(key,JSON.stringify({at:Date.now(),fingerprint:data.fingerprint,text:body.response}));}catch{/* Optional cache. */}}
   }catch{/* Non-blocking help; do not add a toast on every navigation. */}finally{fetching=false;}
  }
  void refresh();const timer=setInterval(()=>void refresh(),90000);
  const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};
  document.addEventListener('visibilitychange',onVisible);window.addEventListener('online',onVisible);window.addEventListener('assistant-settings-changed',onVisible);
  return()=>{active=false;controller?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('online',onVisible);window.removeEventListener('assistant-settings-changed',onVisible);};
 },[scope,pathname]);
 return result.scope===scope&&result.path===pathname?result:{scope,path:pathname,insights:[],brief:'',modelEnabled:result.scope===scope?result.modelEnabled:undefined,modelUnavailableReason:result.scope===scope?result.modelUnavailableReason:undefined};
}
