import { fireEvent, render, screen } from '@testing-library/react';
import { Input } from '@/components/shared/ui/Input';

it('keeps labels and error descriptions distinct across multiple fields', () => {
  render(<><Input label="Müşteri" errorMessage="Müşteri gerekli" /><Input label="Ürün" errorMessage="Ürün gerekli" /></>);
  const customer = screen.getByLabelText('Müşteri');
  const product = screen.getByLabelText('Ürün');
  expect(customer.id).not.toBe(product.id);
  expect(customer).toHaveAccessibleDescription('Müşteri gerekli');
  expect(product).toHaveAccessibleDescription('Ürün gerekli');
  expect(customer).toHaveAttribute('aria-invalid', 'true');
});

it('preserves hooks when an explicit ID is added and exposes the password visibility control', () => {
  const { rerender } = render(<Input label="Şifre" type="password" hint="Hesap şifreniz" />);
  rerender(<Input id="login-password" label="Şifre" type="password" hint="Hesap şifreniz" />);
  const field = screen.getByLabelText('Şifre');
  expect(field).toHaveAttribute('id', 'login-password');
  expect(field).toHaveAccessibleDescription('Hesap şifreniz');
  fireEvent.click(screen.getByRole('button', { name: 'Şifreyi göster' }));
  expect(field).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: 'Şifreyi gizle' })).toHaveAttribute('aria-pressed', 'true');
});
