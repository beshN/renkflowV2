'use client';

import { PageHeader, SkeletonRows } from '@/components/kit';
import { CsvImportWizard } from '@/components/shared/imports/CsvImportWizard';
import { SUPPLIER_IMPORT_TEMPLATE } from '@/lib/features/suppliers/import';
import { useAuth } from '@/lib/context/AuthContext';

export default function SupplierImportPage() {
  const { user, isLoading } = useAuth();
  const allowed = Boolean(
    user && ['owner', 'admin', 'office'].includes(user.role),
  );
  return (
    <div className="rf-page space-y-5">
      <PageHeader
        eyebrow="Tedarikçiler"
        title="Tedarikçi listesini içe aktar"
        hint="Tedarikçi kartlarını önizleyerek ekleyin; kayıtlı bilgileri koruyun."
      />
      {isLoading ? (
        <SkeletonRows />
      ) : allowed ? (
        <CsvImportWizard
          key={`${user?.tenantId}:${user?.id}`}
          endpoint="/api/v1/procurement/suppliers/import"
          template={SUPPLIER_IMPORT_TEMPLATE}
          templateName="tedarikci-listesi-sablon.csv"
          noun="Tedarikçi"
          listHref="/suppliers"
          allowNameDuplicates={false}
          fieldLabels={{
            fullName: 'Yetkili',
            companyName: 'Tedarikçi',
            name: 'Tedarikçi',
          }}
          description="Firmanın tedarikçi listesini CSV olarak yükleyin. Vergi numarası, e-posta ve telefon birlikte kontrol edilir; aynı adlı tedarikçiler otomatik çoğaltılmaz. Kayıtlı kartların yalnız boş alanlarını tamamlayabilirsiniz."
        />
      ) : (
        <p className="rf-panel p-4 text-sm">Tedarikçi ekleme yetkiniz yok.</p>
      )}
    </div>
  );
}
