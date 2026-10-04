import { evaluateQuality,QualityChecksSchema } from '@/lib/features/manufacturing/quality';
const checks=QualityChecksSchema.parse([{id:'width',name:'En kontrolü',kind:'measurement',unit:'mm',minimum:2980,maximum:3000},{id:'visual',name:'Görsel kontrol',kind:'pass_fail'}]);
it('requires every point once and rejects missing measurements',()=>{
  expect(()=>evaluateQuality(checks,[{checkId:'visual',passed:true}],0)).toThrow();
  expect(()=>evaluateQuality(checks,[{checkId:'width',value:2990},{checkId:'width',value:2990}],0)).toThrow();
  expect(()=>evaluateQuality(checks,[{checkId:'width'},{checkId:'visual',passed:true}],0)).toThrow();
});
it('calculates acceptance on the server including tolerance boundaries',()=>{
  for(const value of [2980,3000])expect(evaluateQuality(checks,[{checkId:'width',value},{checkId:'visual',passed:true}],0).every(r=>r.passed)).toBe(true);
  expect(evaluateQuality(checks,[{checkId:'width',value:3001},{checkId:'visual',passed:true}],0)[0].passed).toBe(false);
  expect(evaluateQuality(checks,[{checkId:'width',value:2990},{checkId:'visual',passed:false}],0)[1].passed).toBe(false);
});
it('requires a fresh photo and valid engineering bounds',()=>{
  const photo=QualityChecksSchema.parse([{id:'photo',name:'Test fotoğrafı',kind:'photo'}]);
  expect(()=>evaluateQuality(photo,[{checkId:'photo'}],0)).toThrow();
  expect(evaluateQuality(photo,[{checkId:'photo'}],1)[0].passed).toBe(true);
  expect(QualityChecksSchema.safeParse([{id:'x',name:'Kontrol',kind:'measurement',minimum:3,maximum:2,unit:'mm'}]).success).toBe(false);
});
