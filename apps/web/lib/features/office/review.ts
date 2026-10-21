export type ManagerReview = {
  status: 'checking' | 'approved' | 'changes_requested' | 'needs_human';
  score: number | null;
  note: string;
  issues: string[];
  revision: number;
  checkedAt: string;
};
