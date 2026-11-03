import type { Sql, TransactionSql } from "postgres";
import { pilotColumns, type PilotRows, type Row } from "./pilot-readiness";

/** Fixed assessment fields shared by the CLI and tenant-scoped server report.
 * Caller must supply a READ ONLY transaction. Only the CLI omits tenantId.
 */
export async function readPilotRows(
  transaction: TransactionSql,
  tenantId?: string,
): Promise<PilotRows> {
  // postgres.js TransactionSql uses Omit<Sql>, which drops its callable overloads.
  // Runtime transaction tags support the same query/identifier calls as Sql.
  const tx = transaction as unknown as Sql;
  const tables = await tx<
    { table_name: string }[]
  >`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
  const columns = await tx<
    { table_name: string; column_name: string }[]
  >`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'`;
  const read = async (table: string): Promise<Row[]> => {
    if (
      !tables.some((r) => r.table_name === table) ||
      !pilotColumns[table].every((c) =>
        columns.some((r) => r.table_name === table && r.column_name === c),
      )
    )
      return [];
    // Read only the fixed assessment fields, never unrelated row payloads.
    const names = [
      ...new Set([
        ...pilotColumns[table],
        ...(table === "inventory_items"
          ? ["weight_per_meter_kg", "standard_length_m", "profile_section"]
          : []),
      ]),
    ];
    if (
      table === "tenant_members" &&
      columns.some(
        (r) => r.table_name === table && r.column_name === "deactivated_at",
      )
    )
      names.push("deactivated_at");
    const available = names.filter((c) =>
      columns.some((r) => r.table_name === table && r.column_name === c),
    );
    return tenantId === undefined
      ? await tx<Row[]>`SELECT ${tx(available)} FROM public.${tx(table)}`
      : await tx<
          Row[]
        >`SELECT ${tx(available)} FROM public.${tx(table)} WHERE tenant_id = ${tenantId}`;
  };
  const input: PilotRows = {
    tables,
    columns,
    families: await read("product_family_recipes"),
    recipes: await read("production_recipes"),
    items: await read("inventory_items"),
    centers: await read("work_centers"),
    members: await read("tenant_members"),
    resources: await read("production_resources"),
    lots: await read("stock_lots"),
    balances: await read("stock_balances"),
  };
  return input;
}
