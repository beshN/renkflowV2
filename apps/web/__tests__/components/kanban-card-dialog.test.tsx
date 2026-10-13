import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KanbanCardDialog } from '@/components/work-orders/KanbanCardDialog';
import { getWorkOrderDetails, updateWorkOrder, toggleWorkOrderChecklistItem, createWorkOrder } from '@/lib/features/work-orders/client';
jest.mock('client-only',()=>({}));
jest.mock('@/lib/features/work-orders/client',()=>({ getWorkOrderDetails:jest.fn(), updateWorkOrder:jest.fn(), toggleWorkOrderChecklistItem:jest.fn(), createWorkOrder:jest.fn(), addWorkOrderComment:jest.fn() }));
const capabilities={create:true,edit:true,assign:true,transition:true,close:true,comment:true,checklist:true};
const card={id:'card',title:'Profil kesimi',description:'Kesim ölçüleri',category:'Kesim',priority:'medium',status:'open',dueAt:null,assignedTo:null,updatedAt:'2026-10-13T08:00:00Z',revision:3,checklistTotal:1,checklistCompleted:0,checklist:[{id:'check',title:'Ölçüyü doğrula',completed:false,required:true}],comments:[]};
beforeEach(()=>{jest.clearAllMocks();(getWorkOrderDetails as jest.Mock).mockResolvedValue(card);});
it('saves card fields with the version originally opened',async()=>{
 (updateWorkOrder as jest.Mock).mockResolvedValue({...card,title:'Yeni kesim planı',revision:4});
 render(<KanbanCardDialog cardId="card" members={[]} capabilities={capabilities} onClose={jest.fn()} onChanged={jest.fn()}/>);
 const title=await screen.findByRole('textbox',{name:'Başlık'});
 fireEvent.change(title,{target:{value:'Yeni kesim planı'}});
 fireEvent.click(screen.getByRole('button',{name:'Kaydet'}));
 await waitFor(()=>expect(updateWorkOrder).toHaveBeenCalledWith('card',expect.objectContaining({title:'Yeni kesim planı',expectedRevision:3,expectedUpdatedAt:card.updatedAt})));
});
it('keeps unsaved card text while saving a checklist change',async()=>{
 (toggleWorkOrderChecklistItem as jest.Mock).mockResolvedValue({});
 render(<KanbanCardDialog cardId="card" members={[]} capabilities={capabilities} onClose={jest.fn()} onChanged={jest.fn()}/>);
 const title=await screen.findByRole('textbox',{name:'Başlık'});
 fireEvent.change(title,{target:{value:'Henüz kaydedilmemiş başlık'}});
 fireEvent.click(screen.getByRole('checkbox'));
 await waitFor(()=>expect(toggleWorkOrderChecklistItem).toHaveBeenCalledWith('card','check',true));
 await waitFor(()=>expect(getWorkOrderDetails).toHaveBeenCalledTimes(2));
 expect(title).toHaveValue('Henüz kaydedilmemiş başlık');
});
it('creates a card without leaving the board',async()=>{
 const close=jest.fn();(createWorkOrder as jest.Mock).mockResolvedValue(card);
 render(<KanbanCardDialog cardId="new" members={[]} capabilities={capabilities} onClose={close} onChanged={jest.fn()}/>);
 fireEvent.change(screen.getByRole('textbox',{name:'Başlık'}),{target:{value:'Yeni üretim işi'}});
 fireEvent.click(screen.getByRole('button',{name:'Kart oluştur'}));
 await waitFor(()=>expect(createWorkOrder).toHaveBeenCalledWith(expect.objectContaining({title:'Yeni üretim işi',category:'Üretim'})));
 await waitFor(()=>expect(close).toHaveBeenCalled());
});
