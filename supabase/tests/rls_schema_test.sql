begin;

select plan(8);

select has_table('public', 'organizations', 'organizations exists');
select has_table('public', 'document_analyses', 'document analyses exists');
select has_table('public', 'calculation_runs', 'calculation runs exists');
select has_column('public', 'orders', 'organization_id', 'orders are organization scoped');
select has_column('public', 'documents', 'sha256', 'documents carry content hash');
select policies_are(
  'public', 'orders',
  array['orders_admin_delete','orders_member_select','orders_office_insert','orders_office_update'],
  'orders policies are explicit'
);
select policies_are(
  'storage', 'objects',
  array['order_documents_admin_delete','order_documents_member_read','order_documents_office_insert'],
  'storage access is organization scoped'
);
select function_returns('public', 'create_organization', array['text'], 'uuid', 'organization creation is atomic');

select * from finish();
rollback;
