import { fireEvent, render, screen } from '@testing-library/react';
import { CutDemo } from '@/components/site/CutDemo';

const bars = () => screen.getAllByRole('img').filter((el) => /kesilir/.test(el.getAttribute('aria-label') ?? ''));

describe('landing cutting demo', () => {
  it('plans the starting pieces with the real engine and uses the stored remnants', () => {
    render(<CutDemo />);
    expect(screen.getByText('parça').parentElement).toHaveTextContent(/^8 parça/);
    expect(screen.getByText('artık kullanıldı')).toBeInTheDocument();
    expect(bars().length).toBe(4);
  });

  it('plans again when a length changes, and stops using remnants when none are in stock', () => {
    render(<CutDemo />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Depoda artık var/ }));
    expect(screen.queryByText('artık kullanıldı')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('3. parça adedi'), { target: { value: '6' } });
    expect(screen.getByText('parça').parentElement).toHaveTextContent(/^12 parça/);
  });

  it('skips unusable rows and says so, and asks for a piece when the list is empty', () => {
    render(<CutDemo />);
    fireEvent.change(screen.getByLabelText('1. parça boyu (mm)'), { target: { value: '9000' } });
    expect(screen.getByText(/1 satır geçersiz/)).toBeInTheDocument();
    for (const n of [3, 2, 1]) fireEvent.click(screen.getByRole('button', { name: `${n}. satırı sil` }));
    expect(screen.getByText(/en az bir parça yazın/)).toBeInTheDocument();
  });
});
