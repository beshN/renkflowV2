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
});
