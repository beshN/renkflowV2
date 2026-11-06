import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { OrderPromisePanel } from '@/components/features/orders/OrderPromisePanel';
import { requestJson } from '@/lib/shared/network';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';
import { effectiveAccess, PRESETS, type Access } from '@/lib/security/access-matrix';

jest.mock('@/lib/shared/network', () => ({ requestJson: jest.fn() }));
jest.mock('@/lib/hooks/useMemberAccess', () => ({ useMemberAccess: jest.fn() }));
const request = requestJson as jest.Mock;
const access = useMemberAccess as jest.Mock;
const suggestion = {
  earliestFinish: '2026-11-09T10:00:00Z', bindingConstraint: { kind: 'workCenter', workCenterCode: 'CUT' },
  ignoredLoad: [], optimistic: false, explanation: 'Mevcut yük dikkate alındı.', missing: [], requiresHumanApproval: true,
  material: [{ readyDate: '2026-11-08', fulfilled: [{ color: 'RAL 7016' }], missing: [], undefinedLeadTime: [] }],
};
const ok = (data: unknown = suggestion) => ({ ok: true, status: 200, data: { data } });
const calculate = () => fireEvent.click(screen.getByRole('button', { name: 'Termini hesapla' }));
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => {
  request.mockReset().mockResolvedValue(ok());
  access.mockReturnValue(effectiveAccess('office', null));
});

test('düğmeden önce istek yok; salt okunur tarih, renk ve kapasite gösterir', async () => {
  render(<OrderPromisePanel orderId="order-1" />);
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByText('Öneridir; termini siz onaylarsınız')).toBeInTheDocument();
  calculate();
  await screen.findByText('Önerilen tarih: 09.11.2026');
  expect(screen.getByText('Belirleyici kısıt: Kapasite (CUT)')).toBeInTheDocument();
  expect(screen.getByText(/RAL 7016/).parentElement).toHaveTextContent('08.11.2026');
  expect(screen.getByText(suggestion.explanation)).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith('/api/v1/orders/order-1/promise', { cache: 'no-store', signal: expect.any(AbortSignal) }, expect.any(Object));
  expect(screen.queryByRole('button', { name: /uygula/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('malzeme belirleyici kısıtını gösterir', async () => {
  request.mockResolvedValue(ok({ ...suggestion, bindingConstraint: { kind: 'material' } }));
  render(<OrderPromisePanel orderId="a" />); calculate();
  await screen.findByText('Belirleyici kısıt: Malzeme');
});

test('missing doluyken önerilen ve malzeme tarihlerini gizler, eksikleri ve açıklamayı gösterir', async () => {
  request.mockResolvedValue(ok({ ...suggestion, missing: [{ reason: 'Reçete gerekli' }, { reason: 'Vardiya gerekli' }] }));
  render(<OrderPromisePanel orderId="a" />); calculate();
  await screen.findByText('Reçete gerekli');
  expect(screen.getByText('Vardiya gerekli').tagName).toBe('LI');
  expect(screen.getByText(suggestion.explanation)).toBeInTheDocument();
  expect(screen.queryByText(/09.11.2026|08.11.2026|Belirleyici kısıt/)).not.toBeInTheDocument();
});

test('null malzeme tarihi için eksik tedarik süresi veya birim mesajı gösterir', async () => {
  request.mockResolvedValue(ok({ ...suggestion, earliestFinish: null, bindingConstraint: null,
    material: [{ readyDate: null, fulfilled: [], missing: [], undefinedLeadTime: [{ color: 'Beyaz' }] }] }));
  render(<OrderPromisePanel orderId="a" />); calculate();
  await screen.findByText(/Tedarik süresi veya birim eksik/);
  expect(screen.getByText('Beyaz:')).toBeInTheDocument();
});

test('yükleniyor, hata ve tekrar dene ayrıdır', async () => {
  const pending = deferred(); request.mockReturnValueOnce(pending.promise);
  render(<OrderPromisePanel orderId="a" />); calculate();
  expect(screen.getByRole('status')).toHaveTextContent('Yükleniyor');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await act(async () => pending.resolve({ ok: false, status: 500, error: 'Hesaplanamadı' }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Hesaplanamadı');
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
  await screen.findByText(/Önerilen tarih/);
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('404 bölümü gizler', async () => {
  request.mockResolvedValue({ ok: false, status: 404 });
  const { container } = render(<OrderPromisePanel orderId="a" />); calculate();
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});

test.each(PRESETS.map(p => [p.key, p.base, p] as const))('%s rol matrisi', (key, base, preset) => {
  access.mockReturnValue(effectiveAccess(base, preset));
  render(<OrderPromisePanel orderId="a" />);
  expect(Boolean(screen.queryByRole('region'))).toBe(['owner', 'admin', 'office', 'sales', 'planning', 'warehouse'].includes(key));
  expect(request).not.toHaveBeenCalled();
});

test.each(['orders', 'production', 'inventory'])('%s görüntüleme izni yoksa gizli', module => {
  const member = effectiveAccess('office', null);
  access.mockReturnValue({ ...member, permissions: { ...member.permissions, [module]: [] } });
  const { container } = render(<OrderPromisePanel orderId="a" />);
  expect(container).toBeEmptyDOMElement();
});

test.each([null, { ...effectiveAccess('owner', null), base: 'worker' }])('bilinmeyen erişim ve tüm izinleri olan worker gizli', member => {
  access.mockReturnValue(member);
  const { container } = render(<OrderPromisePanel orderId="a" />);
  expect(container).toBeEmptyDOMElement();
});

test('yeni istek önceki isteği iptal eder; geç yanıt gösterilmez', async () => {
  const pending = deferred(); request.mockReturnValueOnce(pending.promise);
  render(<OrderPromisePanel orderId="a" />); calculate(); calculate();
  await screen.findByText(/Önerilen tarih/);
  expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => pending.resolve(ok({ ...suggestion, explanation: 'Eski yanıt' })));
  expect(screen.queryByText('Eski yanıt')).not.toBeInTheDocument();
});

test.each(['unmount', 'order', 'access'])('%s değişimi isteği iptal eder ve geç yanıtı yoksayar', async change => {
  const pending = deferred(); request.mockReturnValueOnce(pending.promise);
  const view = render(<OrderPromisePanel orderId="a" />); calculate();
  if (change === 'unmount') view.unmount();
  else {
    if (change === 'access') access.mockReturnValue(effectiveAccess('worker', null) as Access);
    view.rerender(<OrderPromisePanel orderId={change === 'order' ? 'b' : 'a'} />);
  }
  expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => pending.resolve(ok()));
  expect(screen.queryByText(/Önerilen tarih/)).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
});


test('birim uyuşmazlığındaki renk ve boş grubun etiketi korunur', async () => {
  request.mockResolvedValue(ok({ ...suggestion, material: [
    { readyDate: null, fulfilled: [], missing: [], undefinedLeadTime: [], unitMismatch: [{ color: 'Siyah' }] },
    { readyDate: '2026-11-10', fulfilled: [], missing: [], undefinedLeadTime: [] },
  ] }));
  render(<OrderPromisePanel orderId="a" />); calculate();
  await screen.findByText('Siyah:');
  expect(screen.getByText('Grup 2:').parentElement).toHaveTextContent('10.11.2026');
});

test('insan onayı şartını sağlamayan yanıtı öneri olarak göstermez', async () => {
  request.mockResolvedValue(ok({ ...suggestion, requiresHumanApproval: false }));
  render(<OrderPromisePanel orderId="a" />); calculate();
  await screen.findByRole('alert');
  expect(screen.queryByText(/Önerilen tarih/)).not.toBeInTheDocument();
});

const ignoredLoad = [
  { operationId: '11111111-1111-4111-8111-111111111111', workOrderId: '22222222-2222-4222-8222-222222222222', reason: 'Kalite onayı bekleniyor' },
  { operationId: '33333333-3333-4333-8333-333333333333', workOrderId: '44444444-4444-4444-8444-444444444444', reason: 'Malzeme hazırlığı bekleniyor' },
];
test.each([true, false])('optimistic %s ise uyarı görünürlüğü ve iş sayısı doğrudur', async optimistic => {
  request.mockResolvedValue(ok({ ...suggestion, optimistic, ignoredLoad }));
  const { container } = render(<OrderPromisePanel orderId="a" />); calculate();
  await screen.findByText(/Önerilen tarih/);
  if (optimistic) {
    const warning = screen.getByRole('alert');
    expect(warning).toHaveTextContent('İyimser tahmin: 2 bekleyen iş hesaba katılmadı');
    expect(warning.nextElementSibling).toHaveTextContent('Önerilen tarih');
    const details = warning.querySelector('details')!;
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(within(warning).getByText('Hesaba katılmayan işlerin nedenleri'));
    expect(details).toHaveAttribute('open');
    for (const item of ignoredLoad) expect(within(details).getByText(item.reason)).toBeInTheDocument();
  } else {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(ignoredLoad[0].reason)).not.toBeInTheDocument();
  }
  for (const item of ignoredLoad) {
    expect(container).not.toHaveTextContent(item.operationId);
    expect(container).not.toHaveTextContent(item.workOrderId);
  }
});

test('eksikler varken iyimser uyarı, nedenleri ve tarihler gösterilmez', async () => {
  request.mockResolvedValue(ok({ ...suggestion, optimistic: true, ignoredLoad,
    missing: [{ operationId: 'op', reason: 'Vardiya gerekli' }, { reason: 'Reçete gerekli' }] }));
  render(<OrderPromisePanel orderId="a" />); calculate();
  await screen.findByText('Vardiya gerekli');
  expect(screen.getByText('Reçete gerekli')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/Önerilen tarih|09.11.2026|08.11.2026|İyimser tahmin/)).not.toBeInTheDocument();
  expect(screen.queryByText(ignoredLoad[0].reason)).not.toBeInTheDocument();
});

test('stok ve rezervasyon nedenleri yalnız ait oldukları grupta, UUID ve toplam olmadan gösterilir', async () => {
  const ids = {
    lotId: '55555555-5555-4555-8555-555555555555',
    itemId: '66666666-6666-4666-8666-666666666666',
    warehouseId: '77777777-7777-4777-8777-777777777777',
  };
  request.mockResolvedValue(ok({ ...suggestion, material: [
    { ...suggestion.material[0], stockProblems: [{ ...ids, reason: 'Profil uzunluğu eksik' }],
      reservationWarnings: [{ ...ids, reason: 'Rezerve profil dışlandı' }] },
    { ...suggestion.material[0], fulfilled: [{ color: 'Beyaz' }],
      stockProblems: [{ ...ids, reason: 'Fiziksel profil belirsiz' }], reservationWarnings: [] },
    { ...suggestion.material[0], fulfilled: [{ color: 'Siyah' }] },
  ] }));
  const { container } = render(<OrderPromisePanel orderId="a" />); calculate();
  await screen.findByText('Stok sorunu: Profil uzunluğu eksik');
  const first = screen.getByText('RAL 7016:').closest('li')!;
  const second = screen.getByText('Beyaz:').closest('li')!;
  const third = screen.getByText('Siyah:').closest('li')!;
  expect(first).toHaveTextContent('Stok sorunu: Profil uzunluğu eksik');
  expect(first).toHaveTextContent('Rezervasyon uyarısı: Rezerve profil dışlandı');
  expect(first).not.toHaveTextContent('Fiziksel profil belirsiz');
  expect(second).toHaveTextContent('Stok sorunu: Fiziksel profil belirsiz');
  expect(second).not.toHaveTextContent('Rezervasyon uyarısı');
  expect(third).not.toHaveTextContent(/Stok sorunu|Rezervasyon uyarısı/);
  for (const id of Object.values(ids)) expect(container).not.toHaveTextContent(id);
  expect(container).not.toHaveTextContent(/toplam/i);
});
