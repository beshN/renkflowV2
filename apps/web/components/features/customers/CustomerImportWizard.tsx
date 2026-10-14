'use client';

import { CsvImportWizard } from '@/components/shared/imports/CsvImportWizard';
import { CUSTOMER_IMPORT_TEMPLATE } from '@/lib/features/customers/import';

export function CustomerImportWizard({
  canFill = true,
}: {
  canFill?: boolean;
}) {
  return (
    <CsvImportWizard
      endpoint="/api/v1/customers/import"
      template={CUSTOMER_IMPORT_TEMPLATE}
      templateName="musteri-listesi-sablon.csv"
      noun="Müşteri"
      listHref="/crm"
      cardHref={(id) => `/crm/${id}`}
      canFill={canFill}
      description="Excel veya başka bir programdaki müşteri listenizi CSV olarak yükleyin. Sütunlar otomatik eşleşir; vergi numarası, e-posta ve telefon birlikte kontrol edilir. Önizlemeyi onaylamadan hiçbir kayıt değişmez."
    />
  );
}
