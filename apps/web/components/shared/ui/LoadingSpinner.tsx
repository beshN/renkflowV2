import { CutLoader } from '@/components/brand/CutLoader';

export function LoadingSpinner() {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <CutLoader variant="page" className="bg-transparent" />
    </div>
  );
}
