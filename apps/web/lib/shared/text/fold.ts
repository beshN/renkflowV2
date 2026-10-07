/**
 * Turkish-safe case folding, identical in JS (foldText) and SQL (foldSql) and independent of the database
 * locale (a C-locale lower() leaves Ş, İ, Ö… uppercase): trimmed, single spaces, then the Turkish alphabet
 * mapped explicitly, with İ/I/ı → i so "YAPI", "Yapı" and "yapi" agree.
 */
export const FOLD_FROM = 'ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZı';
export const FOLD_TO = 'abcçdefgğhiijklmnoöpqrsştuüvwxyzi';

export const foldText = (value: string) =>
  [...value.trim().replace(/\s+/g, ' ')].map((char) => { const at = FOLD_FROM.indexOf(char); return at === -1 ? char : FOLD_TO[at]; }).join('');

type SqlTag = (strings: TemplateStringsArray, ...values: any[]) => any;

/** The SQL side of foldText for a column fragment, e.g. foldSql(sql, sql`o.customer_name`). */
export const foldSql = (sql: SqlTag, column: unknown) =>
  sql`translate(regexp_replace(btrim(coalesce(${column}, '')), '\\s+', ' ', 'g'), ${FOLD_FROM}, ${FOLD_TO})`;

/** LIKE pattern for "contains", with the user's %, _ and \ taken literally. */
export const containsPattern = (folded: string) => '%' + folded.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
