import { fireEvent, render, screen } from '@testing-library/react';
import { RFListView } from '@/components/shared/views/RFListView';

const rows = [
  { id: '1', name: 'Alüminyum profil' },
  { id: '2', name: 'Pencere sistemi' },
  { id: '3', name: 'Sürme doğrama' },
];
const columns = [{ key: 'name', label: 'Ürün' }];

describe('RFListView', () => {
  it('paginates local rows and searches across all pages', () => {
    render(<RFListView title="Siparişler" columns={columns} data={rows} pageSize={2} />);
    expect(screen.queryByText('Sürme doğrama')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Sonraki sayfa'));
    expect(screen.getByText('Sürme doğrama')).toBeInTheDocument();
    expect(screen.queryByText('Alüminyum profil')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Siparişler içinde ara'), { target: { value: 'ALÜMİNYUM' } });
    expect(screen.getByText('Alüminyum profil')).toBeInTheDocument();
    expect(screen.queryByText('Sürme doğrama')).not.toBeInTheDocument();
  });

  it('selects only the displayed page', () => {
    const onRowSelect = jest.fn();
    render(<RFListView title="Siparişler" columns={columns} data={rows} pageSize={2} onRowSelect={onRowSelect} />);
    fireEvent.click(screen.getByLabelText('Bu sayfadaki tüm kayıtları seç'));
    expect(onRowSelect).toHaveBeenLastCalledWith(rows.slice(0, 2));
  });

  it('shows refresh without requiring a row selection', () => {
    const refresh = jest.fn();
    render(<RFListView title="Siparişler" columns={columns} data={rows} secondaryActions={[
      { label: 'Yenile', requiresSelection: false, onClick: refresh },
      { label: 'Sil', onClick: jest.fn() },
    ]} />);
    expect(screen.queryByRole('button', { name: 'Sil' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yenile' }));
    expect(refresh).toHaveBeenCalledWith([]);
  });

  it('sorts numeric columns and updates the accessible sort state', () => {
    render(<RFListView title="Stok" columns={[{ key: 'quantity', label: 'Adet', sortable: true }]} data={[{ id: 'a', quantity: 20 }, { id: 'b', quantity: 3 }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adet' }));
    expect(screen.getByRole('columnheader', { name: 'Adet' })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['3', '20']);
    fireEvent.click(screen.getByRole('button', { name: 'Adet' }));
    expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['20', '3']);
  });

  it('honors controlled selection without including records outside the current data', () => {
    const onRowSelect = jest.fn();
    const exportRows = jest.fn();
    render(<RFListView title="Siparişler" columns={columns} data={rows.slice(0, 2)} selectedRows={[rows[0], rows[2]]} onRowSelect={onRowSelect} secondaryActions={[{ label: 'Dışa aktar', onClick: exportRows }]} />);
    expect(screen.getAllByLabelText('Kaydı seç')[0]).toBeChecked();
    expect(screen.getAllByLabelText('Kaydı seç')[1]).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Dışa aktar/ }));
    expect(exportRows).toHaveBeenCalledWith([rows[0]]);
    fireEvent.click(screen.getByLabelText('Bu sayfadaki tüm kayıtları seç'));
    expect(onRowSelect).toHaveBeenLastCalledWith(rows.slice(0, 2));
  });

  it('opens a row by keyboard without opening it when interacting with the selection checkbox', () => {
    const open = jest.fn();
    render(<RFListView title="Siparişler" columns={columns} data={rows} onRowClick={open} onRowSelect={jest.fn()} />);
    const row = screen.getByText('Alüminyum profil').closest('tr')!;
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(open).toHaveBeenCalledWith(rows[0]);
    open.mockClear();
    fireEvent.click(screen.getAllByLabelText('Kaydı seç')[0]);
    expect(open).not.toHaveBeenCalled();
  });

  it('distinguishes a loading failure from an empty result and offers retry', () => {
    const retry = jest.fn();
    render(<RFListView title="Siparişler" columns={columns} data={[]} error="Sunucuya ulaşılamadı" onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Sunucuya ulaşılamadı');
    expect(screen.getByText('Kayıtlar yüklenemedi')).toBeInTheDocument();
    expect(screen.queryByText('Kayıt bulunamadı')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
