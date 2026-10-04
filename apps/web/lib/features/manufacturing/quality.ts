import { z } from 'zod';
export const QualityCheckSchema = z.object({
  id:z.string().trim().min(1).max(80),name:z.string().trim().min(2).max(180),
  kind:z.enum(['pass_fail','measurement','photo']),unit:z.string().trim().max(24).default(''),
  minimum:z.number().finite().optional(),maximum:z.number().finite().optional(),
}).superRefine((d,ctx)=>{
  if(d.kind==='measurement' && (d.minimum===undefined || d.maximum===undefined || d.minimum>d.maximum || !d.unit)) ctx.addIssue({code:'custom',message:'Ölçüm için birim ve geçerli alt/üst sınırlar gerekli'});
});
export const QualityChecksSchema=z.array(QualityCheckSchema).max(30).default([]).refine(checks=>new Set(checks.map(c=>c.id)).size===checks.length,'Kontrol kodları benzersiz olmalı');
export const QualityResultsSchema=z.array(z.object({checkId:z.string().max(80),passed:z.boolean().optional(),value:z.number().finite().optional()})).max(30).default([]);
export type QualityCheck=z.infer<typeof QualityCheckSchema>;
export type QualityResult=z.infer<typeof QualityResultsSchema>[number];
/** Never delegate tolerances or the pass decision to a model or the browser. */
export function evaluateQuality(checks:QualityCheck[],results:QualityResult[],photoCount:number) {
  if(results.length!==checks.length || new Set(results.map(r=>r.checkId)).size!==results.length || results.some(r=>!checks.some(c=>c.id===r.checkId))) throw new Error('Tüm kalite kontrol noktalarını doldurun');
  return checks.map(check=>{
    const result=results.find(r=>r.checkId===check.id)!;
    if(check.kind==='measurement' && result.value===undefined) throw new Error(check.name+': ölçüm değeri gerekli');
    if(check.kind==='pass_fail' && result.passed===undefined) throw new Error(check.name+': geçti / kaldı seçin');
    if(check.kind==='photo' && photoCount<1) throw new Error(check.name+': yeni fotoğraf ekleyin');
    const passed=check.kind==='measurement' ? result.value!>=check.minimum! && result.value!<=check.maximum! : check.kind==='photo' ? photoCount>0 : result.passed===true;
    return {...check,value:result.value,passed};
  });
}
