import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NewOrderForm } from '@/components/shared/forms/NewOrderForm';
import { prepareBrowserFile } from '@/lib/storage/client';
jest.mock('@/lib/storage/client',()=>({prepareBrowserFile:jest.fn()}));

it('submits each product’s technical dimensions and calculates quantity and price from all lines', async () => {
  const submit = jest.fn().mockResolvedValue(undefined);
  render(<NewOrderForm onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText('Müşteri / firma adı *'), { target: { value: 'Renk Test' } });
  fireEvent.change(screen.getByLabelText('Ürün / sistem *'), { target: { value: 'Profil çerçeve' } });
  fireEvent.change(screen.getByLabelText('Genişlik (mm)'), { target: { value: '2400' } });
  fireEvent.change(screen.getByLabelText('Adet *'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Birim fiyat (TRY)'), { target: { value: '125' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kalem ekle' }));
  fireEvent.change(screen.getAllByLabelText('Ürün / sistem *')[1], { target: { value: 'Pencere' } });
  fireEvent.change(screen.getAllByLabelText('Birim fiyat (TRY)')[1], { target: { value: '50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Siparişi kaydet' }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  const data: FormData = submit.mock.calls[0][0];
  expect(data.get('quantity')).toBe('3');
  expect(data.get('totalAmount')).toBe('300');
  expect(JSON.parse(String(data.get('items')))[0]).toMatchObject({ widthMm: 2400, quantity: 2, totalPrice: 250 });
});

it('reports invalid dimensions without submitting and preserves the form after a server error', () => {
  const submit = jest.fn();
  render(<NewOrderForm onSubmit={submit} submitError="Sunucuya ulaşılamadı." />);
  fireEvent.change(screen.getByLabelText('Müşteri / firma adı *'), { target: { value: 'Renk Test' } });
  fireEvent.change(screen.getByLabelText('Ürün / sistem *'), { target: { value: 'Profil çerçeve' } });
  fireEvent.change(screen.getByLabelText('Genişlik (mm)'), { target: { value: '-5' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Siparişi kaydet' }).closest('form')!);
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByText('Ölçü, sıfırdan büyük olmalı.')).toBeInTheDocument();
  expect(screen.getByLabelText('Müşteri / firma adı *')).toHaveValue('Renk Test');
  expect(screen.getByText(/Girdiğiniz bilgiler korunuyor/)).toHaveTextContent('Sunucuya ulaşılamadı.');
});

it('immediately reports rejected attachments instead of silently discarding them', () => {
  render(<NewOrderForm onSubmit={jest.fn()} />);
  const file = new File(['x'], 'teknik.exe', { type: 'application/octet-stream' });
  fireEvent.change(screen.getByLabelText('Teknik belge seç'), { target: { files: [file] } });
  expect(screen.getByRole('alert')).toHaveTextContent('teknik.exe: Dosya tipi desteklenmiyor.');
});

it('shows an upload failure, preserves entered data and allows retry', async () => {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {configurable:true,value:()=> '11111111-1111-4111-8111-111111111111'});
  jest.mocked(prepareBrowserFile).mockRejectedValueOnce(new Error('Yükleme bağlantısı kesildi.'));
  const submit = jest.fn();
  render(<NewOrderForm onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText('Müşteri / firma adı *'), {target:{value:'Renk Test'}});
  fireEvent.change(screen.getByLabelText('Ürün / sistem *'), {target:{value:'Profil'}});
  fireEvent.change(screen.getByLabelText('Teknik belge seç'), {target:{files:[new File(['%PDF-content'],'technical.pdf',{type:'application/pdf'})]}});
  fireEvent.click(screen.getByRole('button',{name:'Siparişi kaydet'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Yükleme bağlantısı kesildi.'));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Müşteri / firma adı *')).toHaveValue('Renk Test');
  expect(screen.getByRole('button',{name:'Siparişi kaydet'})).toBeEnabled();
});

it('links the order to a chosen saved customer and releases the link when the name is retyped', async () => {
  const fetchMock = jest.fn(async (_url: string) => ({ ok: true, json: async () => ({ customers: [{ id: '33333333-3333-4333-8333-333333333333', full_name: 'Örnek Yapı A.Ş.', phone: '0532 000 00 00', email: 'info@ornek.invalid' }] }) }));
  const previousFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  try {
    const submit = jest.fn().mockResolvedValue(undefined);
    render(<NewOrderForm onSubmit={submit} />);
    fireEvent.change(screen.getByLabelText('Müşteri / firma adı *'), { target: { value: 'Örnek' } });
    fireEvent.click(await screen.findByRole('button', { name: /Örnek Yapı A\.Ş\./ }));
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/customers?suggest=1&search=%C3%96rnek');
    expect(screen.getByText('Kayıtlı müşteri kartına bağlanacak.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ürün / sistem *'), { target: { value: 'Pergola' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siparişi kaydet' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const data: FormData = submit.mock.calls[0][0];
    expect(data.get('customerId')).toBe('33333333-3333-4333-8333-333333333333');
    expect(data.get('customerName')).toBe('Örnek Yapı A.Ş.');
    expect(data.get('phone')).toBe('0532 000 00 00');

    fireEvent.change(screen.getByLabelText('Müşteri / firma adı *'), { target: { value: 'Başka Firma' } });
    expect(screen.queryByText('Kayıtlı müşteri kartına bağlanacak.')).not.toBeInTheDocument();
  } finally {
    global.fetch = previousFetch;
  }
});
