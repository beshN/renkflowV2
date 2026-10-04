import { z } from 'zod';
import { DocumentExtractionSchema, DocumentExtractionModelSchema } from './extraction';
export const AssistantActionSchema=z.object({
 kind:z.enum(['navigate','orderNote','orderDraft']), title:z.string().max(120), href:z.string().nullable(), orderId:z.string().nullable(), note:z.string().nullable(), draft:DocumentExtractionSchema.nullable(),
});
export const AssistantReplySchema=z.object({answer:z.string(),suggestions:z.array(z.string()),actions:z.array(AssistantActionSchema)});
export const AssistantReplyModelSchema=AssistantReplySchema.extend({actions:z.array(AssistantActionSchema.extend({draft:DocumentExtractionModelSchema.nullable()}))});
export type AssistantAction=z.infer<typeof AssistantActionSchema>;
export function safeAssistantHref(value:string|null) {
 if(!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return null;
 const u=new URL(value,'https://internal.invalid');
 if(!/^\/(dashboard|orders|new-order|quotations|production|factory|work-orders|kanban|warehouse|inventory|scrap|purchases|receipts|suppliers|shipments|finance|accounting|crm|reports|team|settings|notifications|search)(\/|$)/.test(u.pathname))return null;
 return u.pathname+u.search;
}
