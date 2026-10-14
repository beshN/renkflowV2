import type { Metadata } from 'next';
import type { ReactNode } from 'react';
export const metadata: Metadata = { title: { absolute: 'Ürünler | RenkFlow' } };
export default function ProductsLayout({ children }: { children: ReactNode }) { return children; }
