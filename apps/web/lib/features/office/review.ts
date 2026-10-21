export type ManagerReview = {
  status: 'checking' | 'approved' | 'changes_requested' | 'needs_human';
  score: number | null;
  note: string;
  issues: string[];
  /** Small improvements the manager noted without sending the work back. */
  suggestions?: string[];
  revision: number;
  checkedAt: string;
};
