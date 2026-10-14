import { z } from 'zod';
import { DocumentExtractionSchema } from './extraction';
export const AssistantActionSchema=z.object({
 kind:z.enum(['navigate','orderNote','orderDraft','warehouseDraft','attendanceDraft']), title:z.string().max(120), href:z.string().nullable(), orderId:z.string().nullable(), note:z.string().nullable(), draft:DocumentExtractionSchema.nullable(),
});
export const AssistantReplySchema=z.object({answer:z.string(),suggestions:z.array(z.string()),actions:z.array(AssistantActionSchema)});
/**
 * What the model returns. The order draft here is lighter than DocumentExtractionModelSchema (no
 * per-field evidence): the full one nested in a reply is too large for structured output. Drafts are
 * checked against DocumentExtractionSchema afterwards (assistantDraft) and dropped if invalid.
 */
const draftText=z.string().nullable(), draftNumber=z.number().nullable();
const AssistantDraftItemModelSchema=z.object({productName:draftText,quantity:draftNumber,widthMm:draftNumber,heightMm:draftNumber,projectionMm:draftNumber,mountingHeightMm:draftNumber,color:draftText,motorType:draftText,ledType:draftText,fabricType:draftText,notes:draftText,unit:draftText,sourcePage:draftNumber,evidence:z.string(),uncertainFields:z.array(z.string())});
const AssistantDraftModelSchema=z.object({customerName:draftText,email:draftText,phone:draftText,deliveryDate:draftText,notes:draftText,items:z.array(AssistantDraftItemModelSchema),warnings:z.array(z.string())});
export const AssistantReplyModelSchema=z.object({answer:z.string(),suggestions:z.array(z.string()),actions:z.array(AssistantActionSchema.extend({draft:AssistantDraftModelSchema.nullable()}))});
/** A model draft in the stored shape, or null when it does not fit (positive whole quantities, sizes). */
export function assistantDraft(draft:z.infer<typeof AssistantDraftModelSchema>|null) {
 if(!draft)return null;
 const parsed=DocumentExtractionSchema.safeParse(draft);
 return parsed.success?parsed.data:null;
}
export type AssistantAction=z.infer<typeof AssistantActionSchema>;
export function safeAssistantHref(value:string|null) {
 if(!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return null;
 const u=new URL(value,'https://internal.invalid');
 if(!/^\/(dashboard|orders|new-order|quotations|production|factory|work-orders|kanban|warehouse|inventory|scrap|purchases|receipts|suppliers|shipments|finance|accounting|crm|reports|team|settings|notifications|search)(\/|$)/.test(u.pathname))return null;
 return u.pathname+u.search+u.hash;
}
