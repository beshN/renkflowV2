/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import KanbanPage from '@/app/(dashboard)/kanban/page';
import { listKanbanWorkOrders, updateWorkOrder } from '@/lib/features/work-orders/client';
import { cardPlacement, optimisticCardMove } from '@/lib/features/work-orders/kanban';

jest.mock('client-only', () => ({}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('@/components/layout/Navbar', () => ({ Navbar: () => null }));
jest.mock('@/lib/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner', role: 'owner' }, isLoading: false }) }));
jest.mock('@/lib/context/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('@/components/work-orders/KanbanCardDialog', () => ({ KanbanCardDialog: () => null }));
jest.mock('@/components/shared/views/RFKanbanView', () => ({
  RFKanbanView: ({ columns, onDragEnd, renderCard }: any) => <div>{columns.map((column: any) => <section key={column.id} aria-label={column.title}>{column.items.map((item: any) => <div key={item.id}>{renderCard(item)}{onDragEnd && <><button onClick={() => onDragEnd(item.id, column.id, 'in_progress', 0)}>Başlat {item.id}</button><button onClick={() => onDragEnd(item.id, column.id, 'blocked', 0)}>Bloke {item.id}</button></>}</div>)}</section>)}</div>,
}));
jest.mock('@/lib/features/work-orders/client', () => ({ listKanbanWorkOrders: jest.fn(), listTenantMembers: jest.fn().mockResolvedValue([]), updateWorkOrder: jest.fn() }));

const capabilities = { create: true, edit: true, assign: true, transition: true, close: true, comment: true, checklist: true };
const row = (id: string, status = 'open') => ({ id, title: 'Profil kesimi ' + id, description: '', category: 'Kesim', status, priority: 'medium', boardPosition: 1024, revision: 1, updatedAt: '2026-10-13T08:00:00.000Z', checklistTotal: 0, checklistCompleted: 0, commentTotal: 0, dueAt: null, assignedTo: null, assigneeName: null });
beforeEach(() => {
  jest.clearAllMocks();
  (listKanbanWorkOrders as jest.Mock).mockResolvedValue({ data: [row('a')], capabilities });
});

it('sends a real status/order mutation, then keeps the saved state after a server refresh', async () => {
  let saved = false;
  (listKanbanWorkOrders as jest.Mock).mockImplementation(async () => ({ data: [row('a', saved ? 'in_progress' : 'open')], capabilities }));
  (updateWorkOrder as jest.Mock).mockImplementation(async () => { saved = true; return row('a','in_progress'); });
  render(<KanbanPage />);
  fireEvent.click(await screen.findByText('Başlat a'));
  await waitFor(() => expect(updateWorkOrder).toHaveBeenCalledWith('a', { status: 'in_progress', boardPlacement: { beforeId: null, afterId: null }, expectedUpdatedAt: '2026-10-13T08:00:00.000Z', expectedRevision: 1 }));
  await waitFor(() => expect(screen.getByRole('region', { name: 'Devam ediyor' }).textContent).toContain('Profil kesimi a'));
});

it('restores the original column when the server rejects a move', async () => {
  (updateWorkOrder as jest.Mock).mockRejectedValue(new Error('Kaydedilemedi'));
  render(<KanbanPage />);
  fireEvent.click(await screen.findByText('Başlat a'));
  await screen.findByRole('alert');
  expect(screen.getByRole('region', { name: 'Planlandı' }).textContent).toContain('Profil kesimi a');
  expect(screen.getByRole('region', { name: 'Devam ediyor' }).textContent).not.toContain('Profil kesimi a');
});

it('asks for a block reason before mutating, and submits that reason with the move', async () => {
  (updateWorkOrder as jest.Mock).mockResolvedValue(row('a','blocked'));
  render(<KanbanPage />);
  fireEvent.click(await screen.findByText('Bloke a'));
  expect(updateWorkOrder).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Açıklama' }), { target: { value: 'Motor tedariki bekleniyor' } });
  fireEvent.click(screen.getByRole('button', { name: 'Nedeni kaydet ve taşı' }));
  await waitFor(() => expect(updateWorkOrder).toHaveBeenCalledWith('a', expect.objectContaining({ status: 'blocked', blockedReasonCategory: 'material', blockedReasonDetail: 'Motor tedariki bekleniyor' })));
});

it('makes failed loading visible instead of displaying a successful empty board', async () => {
  (listKanbanWorkOrders as jest.Mock).mockRejectedValue(new Error('Bağlantı kesildi'));
  render(<KanbanPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Bağlantı kesildi');
  expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeVisible();
});

it('does not offer moves for a read-only member', async () => {
  (listKanbanWorkOrders as jest.Mock).mockResolvedValue({ data: [row('a')], capabilities: { ...capabilities, transition: false, create: false, edit: false } });
  render(<KanbanPage />);
  await screen.findByText('Profil kesimi a');
  expect(screen.queryByText('Başlat a')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Yeni kart' })).not.toBeInTheDocument();
});

it('keeps cancelled jobs separate from completed work', async () => {
  (listKanbanWorkOrders as jest.Mock).mockResolvedValue({ data: [row('a','cancelled')], capabilities });
  render(<KanbanPage />);
  await waitFor(() => expect(screen.getByText('1 kart · 0 gösteriliyor')).toBeVisible());
  fireEvent.click(screen.getByRole('checkbox', { name: 'İptal edilenler' }));
  expect(screen.getByRole('region', { name: 'İptal edildi' }).textContent).toContain('Profil kesimi a');
  expect(screen.getByRole('region', { name: 'Tamamlandı' }).textContent).not.toContain('Profil kesimi a');
});

it('places a card at the selected location, preserving other columns and filtered neighbours', () => {
  const rows = [row('a'), row('b'), row('c'), row('d','in_progress')] as any;
  const placement = cardPlacement(rows.slice(0,3), 'a', 1);
  expect(placement).toEqual({ beforeId: 'b', afterId: 'c' });
  expect(optimisticCardMove(rows,'a','open',placement).map(item => item.id)).toEqual(['b','a','c','d']);
  expect(cardPlacement([], 'a', 0)).toEqual({ beforeId: null, afterId: null });
});
