import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {AssistantSettings} from '@/components/settings/AssistantSettings';
import {requestJson} from '@/lib/shared/network';
jest.mock('@/lib/shared/network',()=>({requestJson:jest.fn()}));
const request=jest.mocked(requestJson);
const settings={mode:'rules',kvkkAckAt:'2026-10-01T12:00:00Z',dailyBudgetUsd:null,userDailyCalls:60,modelKeyConfigured:true,detectors:[],features:{},profitFloorPercent:15};
beforeEach(()=>{jest.clearAllMocks();request.mockResolvedValue({ok:true,data:settings} as never);});
it('selecting the model with existing consent actually saves and notifies chat',async()=>{
 const changed=jest.fn();window.addEventListener('assistant-settings-changed',changed);
 try {render(<AssistantSettings/>);fireEvent.click(await screen.findByRole('radio',{name:/Kural motoru \+ model/}));await waitFor(()=>expect(request).toHaveBeenCalledTimes(2));expect(JSON.parse((request.mock.calls[1][1] as RequestInit).body as string)).toEqual({mode:'assist'});await waitFor(()=>expect(changed).toHaveBeenCalled());} finally {window.removeEventListener('assistant-settings-changed',changed);}
});
it('no consent is silently created when none exists',async()=>{request.mockResolvedValue({ok:true,data:{...settings,kvkkAckAt:null}} as never);render(<AssistantSettings/>);expect(await screen.findByRole('radio',{name:/Kural motoru \+ model/})).toBeDisabled();expect(screen.getByRole('button',{name:'Modeli aç'})).toBeDisabled();expect(request).toHaveBeenCalledTimes(1);});
it('existing consent does not require a second checkbox acknowledgement',async()=>{render(<AssistantSettings/>);expect(await screen.findByRole('button',{name:'Modeli aç'})).toBeEnabled();});
