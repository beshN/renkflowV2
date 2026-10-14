import {safeAssistantHref} from '@/lib/ai/assistant-contract';
it('allows internal workspace actions and refuses external, escaped or auth links',()=>{
 expect(safeAssistantHref('/warehouse/scan?mode=transfer')).toBe('/warehouse/scan?mode=transfer');
 for(const href of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/auth/login','/api/ai/actions','/orders/../../auth/login'])expect(safeAssistantHref(href)).toBeNull();
});

test('settings links preserve the requested tab',()=>{expect(safeAssistantHref('/settings#personel')).toBe('/settings#personel');});
