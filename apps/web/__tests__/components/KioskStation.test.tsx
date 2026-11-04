import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KioskStation } from '@/components/features/kiosk/KioskStation';
import { requestJson } from '@/lib/shared/network';
jest.mock('@/lib/shared/network', () => ({ requestJson: jest.fn() }));
it('selects assigned work and sends JSON to the guarded existing-operation adapter', async () => {
  Object.defineProperty(global.crypto,'randomUUID',{value:()=> '00000000-0000-4000-8000-000000000001',configurable:true});
  const job = {id:'op',title:'Montaj',name:'Birleştirme',order_number:'QA',status:'paused',version:2,planned_qty:'4',completed_qty:'1',unit:'kg',quality_checks:[]};
  jest.mocked(requestJson).mockResolvedValue({ok:true,status:200,data:{jobs:[job]},error:null});
  render(<KioskStation />);
  fireEvent.click(await screen.findByRole('button',{name:/QA.*kg/}));
  fireEvent.click(screen.getByRole('button',{name:'Devam'}));
  await waitFor(()=>expect(requestJson).toHaveBeenCalledWith('/api/v1/production/kiosk',expect.objectContaining({method:'POST',headers:{'Content-Type':'application/json'}})));
  const post = jest.mocked(requestJson).mock.calls.find(c=>c[1]?.method==='POST')!;
  expect(JSON.parse(post[1]!.body as string)).toEqual(expect.objectContaining({operationId:'op',version:2,action:'start'}));
});
it.each([
  ['running', '4', '1', true],
  ['running', '4', '1.5', false],
  ['blocked', '4', '1', false],
])('shows only supported actions for %s with %s planned and %s complete', async (status, planned_qty, completed_qty, finish) => {
  jest.mocked(requestJson).mockResolvedValue({ok:true,status:200,data:{jobs:[{id:'op',title:'Montaj',name:'Birleştirme',order_number:'QA',status,version:2,planned_qty,completed_qty,unit:'adet',quality_checks:[]}]},error:null});
  render(<KioskStation />);
  fireEvent.click(await screen.findByRole('button',{name:/QA.*adet/}));
  expect(!!screen.queryByRole('button',{name:'Bitir · 3 adet'})).toBe(finish);
  if (status === 'blocked') expect(screen.queryByRole('button',{name:'Başla'})).not.toBeInTheDocument();
});
