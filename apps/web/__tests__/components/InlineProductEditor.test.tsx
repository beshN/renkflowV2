import { fireEvent, render, screen } from '@testing-library/react';
import { InlineProductEditor } from '@/components/features/product-3d/InlineProductEditor';
import { defaultVisualization } from '@/lib/features/product-3d/catalog';
jest.mock('@/components/features/product-3d/ProductConfigurator', () => ({ ProductConfigurator: ({ kind, readOnly }: { kind: string; readOnly?: boolean }) => <div role="img" aria-label={`${kind} canlı 3D`} data-readonly={readOnly} /> }));
jest.mock('@/components/features/awning/AwningConfigurator', () => ({ AwningConfigurator: () => <div role="img" aria-label="makaslı canlı 3D" /> }));

test('selecting a product mounts its 3D view directly, without a dialog or a separate open button', () => {
  const select = jest.fn();
  const { rerender } = render(<InlineProductEditor productName="" onSelect={select} />);
  fireEvent.change(screen.getByLabelText('Ürün'), { target: { value: 'giyotin' } });
  expect(select).toHaveBeenCalledWith('giyotin');
  rerender(<InlineProductEditor productName="Motorlu Giyotin Cam" visualization={{ configuration: defaultVisualization('giyotin') }} onSelect={select} />);
  expect(screen.getByRole('img', { name: 'giyotin canlı 3D' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /3D yapılandır/ })).not.toBeInTheDocument();
});

test('saved and legacy awning selections are visible automatically; readonly mode removes product switching', () => {
  const { rerender } = render(<InlineProductEditor productName="WINMAX Makaslı Tente" />);
  expect(screen.getByRole('img', { name: 'makaslı canlı 3D' })).toBeInTheDocument();
  rerender(<InlineProductEditor productName="Motorlu Giyotin Cam" visualization={{ configuration: defaultVisualization('giyotin') }} readOnly />);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute('data-readonly', 'true');
});
