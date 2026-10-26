import 'server-only';

import { Zip, ZipDeflate, strToU8 } from 'fflate';
import {
  csvLine, exportReadme, fileReferenceSpecs, planTenantExport, quoteIdent, tenantRowColumns,
  type CatalogColumn, type ExportPlan,
} from './export-plan';

/**
 * Full firm export as a streamed ZIP: one CSV per firm table (rows WHERE tenant_id = the firm),
 * the firm row, its members' non-secret profile fields, a list of stored files and a README.
 * Everything is read in one read-only REPEATABLE READ transaction so the CSVs agree with each other,
 * and rows are read with a cursor so a large firm never sits in memory at once.
 */

// postgres.js client or transaction; typed loosely like the rest of the data layer.
type Db = any;

const BATCH = 500;

export async function loadCatalog(db: Db): Promise<CatalogColumn[]> {
  const rows = await db`
    SELECT c.table_name AS table_name, c.column_name AS column_name, c.data_type AS data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name, c.ordinal_position`;
  return (rows as Array<{ table_name: string; column_name: string; data_type: string }>).map((r) => ({ table: r.table_name, column: r.column_name, dataType: r.data_type }));
}

export type ExportSummary = { plan: ExportPlan; rowCounts: Record<string, number>; fileCount: number };

class ExportCancelled extends Error {}

export function tenantExportStream(db: Db, tenantId: string, options: { now?: Date; onDone?: (summary: ExportSummary | null, error?: unknown) => void } = {}): ReadableStream<Uint8Array> {
  const pipe = new TransformStream<Uint8Array, Uint8Array>();
  const writer = pipe.writable.getWriter();
  let cancelled = false;
  writer.closed.catch(() => { cancelled = true; });

  const zip = new Zip((error, chunk, final) => {
    if (error) { cancelled = true; void writer.abort(error).catch(() => {}); return; }
    if (chunk.length) void writer.write(chunk).catch(() => { cancelled = true; });
    if (final) void writer.close().catch(() => {});
  });

  const file = (name: string) => {
    const entry = new ZipDeflate(name, { level: 6 });
    zip.add(entry);
    return {
      push: (text: string) => entry.push(strToU8(text), false),
      end: () => entry.push(new Uint8Array(0), true),
    };
  };
  // Lets the reader catch up after each batch; stops the work once the download is gone.
  const drain = async () => {
    if (cancelled) throw new ExportCancelled('cancelled');
    await writer.ready;
    if (cancelled) throw new ExportCancelled('cancelled');
  };

  const run = async (tx: Db): Promise<ExportSummary> => {
    const catalog = await loadCatalog(tx);
    const plan = planTenantExport(catalog);
    const rowCounts: Record<string, number> = {};

    const [tenant] = await tx`SELECT name FROM tenants WHERE id = ${tenantId}`;
    if (!tenant) throw new Error('Firma bulunamadı');

    const tenantCols = tenantRowColumns(catalog);
    const tenantRows = await tx.unsafe(`SELECT ${tenantCols.map(quoteIdent).join(', ')} FROM tenants WHERE id = $1`, [tenantId]);
    const tenantFile = file('tenant.csv');
    tenantFile.push(csvLine(tenantCols));
    for (const r of tenantRows as Array<Record<string, unknown>>) tenantFile.push(csvLine(tenantCols.map((c) => r[c])));
    tenantFile.end();

    // users is shared by every firm: only this firm's members, only profile fields (no password, tokens).
    const members = await tx`
      SELECT u.id AS user_id, u.name, u.email, u.email_verified, u.image, u.created_at AS user_created_at,
        m.role, to_jsonb(m)->>'access_role' AS access_role, m.created_at AS joined_at, to_jsonb(m)->>'deactivated_at' AS deactivated_at
      FROM tenant_members m JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ${tenantId}
      ORDER BY m.created_at`;
    const memberCols = ['user_id', 'name', 'email', 'email_verified', 'image', 'user_created_at', 'role', 'access_role', 'joined_at', 'deactivated_at'];
    const membersFile = file('members.csv');
    membersFile.push(csvLine(memberCols));
    for (const r of members as Array<Record<string, unknown>>) membersFile.push(csvLine(memberCols.map((c) => r[c])));
    membersFile.end();

    for (const t of plan.tables) {
      await drain();
      const out = file(`tables/${t.table}.csv`);
      out.push(csvLine(t.columns));
      let count = 0;
      if (t.columns.length) {
        // Table and column names come from information_schema and are quoted; the firm is a bound parameter.
        const text = `/* tenant-checked: firm export, every row WHERE tenant_id = $1 */ SELECT ${t.columns.map(quoteIdent).join(', ')} FROM public.${quoteIdent(t.table)} WHERE tenant_id = $1`;
        await tx.unsafe(text, [tenantId]).cursor(BATCH, async (rows: Array<Record<string, unknown>>) => {
          let chunk = '';
          for (const r of rows) chunk += csvLine(t.columns.map((c) => r[c]));
          out.push(chunk);
          count += rows.length;
          await drain();
        });
      }
      out.end();
      rowCounts[t.table] = count;
    }

    const filesOut = file('files.csv');
    filesOut.push(csvLine(['table', 'id', 'name', 'storage_reference', 'size_bytes']));
    let fileCount = 0;
    for (const spec of fileReferenceSpecs(plan)) {
      await drain();
      const text = `/* tenant-checked: firm export file list WHERE tenant_id = $1 */ SELECT to_jsonb(x)->>'id' AS id, ${spec.nameColumn ? `x.${quoteIdent(spec.nameColumn)}` : 'NULL'} AS name, x.${quoteIdent(spec.refColumn)} AS ref, ${spec.sizeColumn ? `x.${quoteIdent(spec.sizeColumn)}` : 'NULL'} AS size FROM public.${quoteIdent(spec.table)} x WHERE x.tenant_id = $1 AND x.${quoteIdent(spec.refColumn)} IS NOT NULL`;
      await tx.unsafe(text, [tenantId]).cursor(BATCH, async (rows: Array<Record<string, unknown>>) => {
        let chunk = '';
        for (const r of rows) chunk += csvLine([spec.table, r.id, r.name, r.ref, r.size]);
        filesOut.push(chunk);
        fileCount += rows.length;
      });
    }
    filesOut.end();

    const readme = file('README.txt');
    readme.push(exportReadme({ tenantName: String(tenant.name ?? ''), generatedAt: options.now ?? new Date(), plan, rowCounts, fileCount }));
    readme.end();
    return { plan, rowCounts, fileCount };
  };

  void (async () => {
    try {
      const summary: ExportSummary = await db.begin('isolation level repeatable read read only', run);
      zip.end();
      options.onDone?.(summary);
    } catch (error) {
      zip.terminate();
      if (!(error instanceof ExportCancelled)) console.error('[tenant-export]', error instanceof Error ? error.message : 'failed');
      options.onDone?.(null, error);
      await writer.abort(error).catch(() => {});
    }
  })();

  return pipe.readable;
}
