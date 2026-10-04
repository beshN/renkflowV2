/** @jest-environment node */
import { normalizeExtraction, intakeReviewFields, DocumentExtractionModelSchema } from '@/lib/ai/extraction';
import { zodTextFormat } from 'openai/helpers/zod';
const base={customerName:'Firma',email:null,phone:null,deliveryDate:null,notes:null,items:[],warnings:[]};
const evidence={field:'customerName',value:'Firma',confidence:0.95,sourcePage:1,sourceText:'Firma',needsReview:false};
it('keeps legacy drafts readable and makes absent or low evidence reviewable',()=>{
 expect(normalizeExtraction(base).fieldEvidence).toEqual([]);
 const data=normalizeExtraction({...base,fieldEvidence:[{...evidence,confidence:0.5}]});
 expect(intakeReviewFields(data)).toEqual(['customerName']);
 expect(normalizeExtraction({...base,fieldEvidence:[{...evidence,sourceText:null}]}).fieldEvidence![0].needsReview).toBe(true);
});
it('validates confidence, page, quantities and parameter keys before persistence',()=>{
 for(const change of [{confidence:2},{sourcePage:0},{value:Infinity}])expect(()=>normalizeExtraction({...base,fieldEvidence:[{...evidence,...change}]})).toThrow();
});
it('exposes a strict structured model contract without open-ended parameter objects',()=>{
 const format=zodTextFormat(DocumentExtractionModelSchema,'extraction');
 expect(format.strict).toBe(true);
 expect(format.schema.required).toContain('fieldEvidence');
});
