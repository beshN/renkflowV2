import { Button } from './Button';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-4">
        <span className="material-symbols-outlined text-6xl text-subtle-light dark:text-subtle-dark">
          {icon}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-2">
        {title}
      </h3>
      <p className="text-sm text-subtle-light dark:text-subtle-dark mb-6 max-w-md">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick} size="md">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {action.label}
        </Button>
      )}
    </div>
  );
}
