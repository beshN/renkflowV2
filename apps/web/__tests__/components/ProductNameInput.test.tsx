import { fireEvent, render, screen } from '@testing-library/react';
import { ProductNameInput } from '@/components/features/product-3d/ProductNameInput';
import { applyProductSelection, productSuggestions } from '@/lib/features/product-3d/product-search';
import { DEFAULT_AWNING } from '@/lib/features/awning/configuration';
test('ma + Enter selects the awning instead of submitting the surrounding form', () => {
 const select=jest.fn(),submit=jest.fn();render(<form onSubmit={submit}><ProductNameInput value="ma" label="Kalem ürün adı" onChange={()=>{}} onSelect={select} /></form>);
 const input=screen.getByRole('combobox');fireEvent.focus(input);expect(screen.getByRole('option',{name:/Makaslı/})).toBeVisible();fireEvent.keyDown(input,{key:'Enter'});expect(select).toHaveBeenCalledWith('makasli');expect(submit).not.toHaveBeenCalled();expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
test('Turkish and ASCII search, keyboard navigation, Escape and disabled rows', () => {
 expect(productSuggestions('MAKASLI')[0].kind).toBe('makasli');expect(productSuggestions('ruzgar').length).toBe(2);
 const pick=jest.fn();render(<ProductNameInput value="cam" label="Cam ürünü" onChange={()=>{}} onSelect={pick} />);const input=screen.getByRole('combobox');fireEvent.focus(input);const choices=productSuggestions('cam');fireEvent.keyDown(input,{key:'ArrowDown'});fireEvent.keyDown(input,{key:'Enter'});expect(pick).toHaveBeenCalledWith(choices[1].kind);fireEvent.focus(input);fireEvent.keyDown(input,{key:'Escape'});expect(input).toHaveAttribute('aria-expanded','false');
});
test('new product clears stale recipe and initializes 3D while preserving commercial values; same selection keeps measures', () => {
 const entry: { productName: string; quantity: number; unitPrice: number; discountPercent: number; heightMm?: number; productConfiguration?: unknown; awningConfiguration?: typeof DEFAULT_AWNING }={productName:'Old custom product',quantity:3,unitPrice:4500,discountPercent:12,heightMm:3200,productConfiguration:{family:'pergola'}};
 const selected=applyProductSelection(entry,'makasli');expect(selected).toMatchObject({quantity:3,unitPrice:4500,discountPercent:12,productName:'WINMAX Makaslı Tente'});expect(selected.productConfiguration).toBeUndefined();expect(selected.awningConfiguration).toBeDefined();expect(selected.heightMm).toBeUndefined();
 const saved={...selected,awningConfiguration:{...DEFAULT_AWNING,widthMm:7500}};expect(applyProductSelection(saved,'makasli').awningConfiguration?.widthMm).toBe(7500);
});
