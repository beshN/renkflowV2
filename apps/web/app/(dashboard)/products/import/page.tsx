'use client';
import { PageHeader, SkeletonRows } from '@/components/kit';
import { CsvImportWizard } from '@/components/shared/imports/CsvImportWizard';
import { MATERIAL_IMPORT_TEMPLATE, MATERIAL_IMPORT_LABELS, MATERIAL_IMPORT_MAX_ROWS } from '@/lib/features/products/material-import';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';
import { can } from '@/lib/security/access-matrix';
import { useAuth } from '@/lib/context/AuthContext';
export default function ProductImportPage() {
  const { user, isLoading } = useAuth();
  const access = useMemberAccess();
  const allowed = user && ['owner', 'admin'].includes(user.role) && (!access?.narrowed || can(access, 'inventory', 'create'));
  return <div className="rf-page space-y-5">
    <PageHeader eyebrow="Ürünler · stok kartları" title="Ürün kartlarını içe aktar" hint="Mamul, hammadde ve sarf kartlarını önizleyerek ekleyin." />
    {isLoading ? <SkeletonRows /> : allowed && user ? <CsvImportWizard
      key={`${user.tenantId}:${user.id}`} endpoint="/api/v1/products/import"
      template={MATERIAL_IMPORT_TEMPLATE} templateName="urun-karti-sablonu.csv"
      listHref="/products" noun="Ürün" canFill={false} allowNameDuplicates={false}
      maxRows={MATERIAL_IMPORT_MAX_ROWS} fieldLabels={MATERIAL_IMPORT_LABELS}
      description="Bu aktarım ürün kartı açar. Stok miktarları sayım veya mal kabul akışından girilir. Kayıtlı kartlar değiştirilmez; farklı bilgiler ve profil kimliği çakışmaları inceleme için durur. Boy ve gramaj mm ve kg/m cinsindendir."
    /> : <p className="rf-panel p-4 text-sm">Ürün kartı aktarımı için yönetici yetkisi gerekli.</p>}
  </div>;
}
