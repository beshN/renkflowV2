/** Shared by the search page, the command palette and the server (folded length). */
export const SEARCH_MIN_LENGTH = 2;

export type SearchHit = { id: string; title: string; subtitle: string; meta: string; href: string; status?: string };
export type WorkspaceSearchResult = {
  query: string;
  /** null = this role cannot open that screen, so the section is not searched at all. */
  orders: SearchHit[] | null;
  customers: SearchHit[] | null;
  quotations: SearchHit[] | null;
  stock: SearchHit[] | null;
  /** Roles without commercial access only search orders of work assigned to them, by number and product. */
  ordersLimitedToAssigned: boolean;
};
