import 'server-only';

import { columnExists } from '@/lib/db/schema-guard';
import {
  importContacts,
  type ContactImportConfig,
} from '@/lib/features/imports/contacts.server';
import { parseCustomerImport } from './import';
export { ImportInput } from '@/lib/features/imports/contacts.server';
export type {
  ImportOutcome,
  ImportResultRow,
} from '@/lib/features/imports/contacts.server';

const CUSTOMER_CONFIG: ContactImportConfig = {
  table: 'customers',
  entityType: 'customer',
  label: 'Müşteri',
  allowNameDuplicates: true,
  parse: parseCustomerImport,
  displayName: (data) => data.fullName || data.companyName || '',
  columns: {
    fullName: 'full_name',
    companyName: 'company_name',
    phone: 'phone',
    email: 'email',
    taxNumber: 'tax_number',
    taxOffice: 'tax_office',
    address: 'address',
    city: 'city',
    district: 'district',
    notes: 'notes',
  },
  fillable: [
    'companyName',
    'phone',
    'email',
    'taxNumber',
    'taxOffice',
    'address',
    'city',
    'district',
    'notes',
  ],
};

export async function importCustomers(
  db: any,
  actor: { tenantId: string; userId: string },
  input: unknown,
) {
  const config = {
    ...CUSTOMER_CONFIG,
    columns: { ...CUSTOMER_CONFIG.columns },
  };
  if (!(await columnExists('customers', 'city'))) {
    delete config.columns.city;
    delete config.columns.district;
    config.parse = (text) => {
      const parsed = parseCustomerImport(text);
      for (const row of parsed.rows)
        if (row.data.city || row.data.district)
          row.errors.push(
            'İl ve ilçe aktarımı için veritabanı güncellemesi (054) gerekli.',
          );
      return parsed;
    };
  }
  return importContacts(db, actor, input, config);
}
