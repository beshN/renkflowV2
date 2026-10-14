import 'server-only';

import { importContacts } from '@/lib/features/imports/contacts.server';
import { requireProcurementWrite } from '@/lib/features/manufacturing/purchasing.service';
import { type WorkOrderActor } from '@/lib/features/work-orders/security';
import { parseSupplierImport } from './import';

export async function importSuppliers(
  db: any,
  actor: WorkOrderActor,
  input: unknown,
) {
  requireProcurementWrite(actor);
  return importContacts(db, actor, input, {
    table: 'suppliers',
    entityType: 'supplier',
    label: 'Tedarikçi',
    allowNameDuplicates: false,
    parse: parseSupplierImport,
    displayName: (data) => data.companyName || data.fullName,
    columns: {
      fullName: 'contact_name',
      companyName: 'name',
      phone: 'phone',
      email: 'email',
      taxNumber: 'tax_number',
      taxOffice: 'tax_office',
      address: 'address',
      notes: 'notes',
    },
    fillable: [
      'fullName',
      'phone',
      'email',
      'taxNumber',
      'taxOffice',
      'address',
      'notes',
    ],
  });
}
