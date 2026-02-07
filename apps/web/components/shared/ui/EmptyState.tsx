import { Button } from './Button';
import {
  AlertCircle,
  Box,
  FileText,
  Inbox,
  Plus,
  Search,
  Users,
} from 'lucide-react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const iconMap = {
  inbox: Inbox,
  search: Search,
  people: Users,
  group: Users,
  file: FileText,
  article: FileText,
  error: AlertCircle,
} as const;

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const Icon = iconMap[icon as keyof typeof iconMap] || Box;

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-4">
        <Icon className="h-16 w-16 text-subtle-light dark:text-subtle-dark" />
      </div>
      <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-2">
        {title}
      </h3>
      <p className="text-sm text-subtle-light dark:text-subtle-dark mb-6 max-w-md">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick} size="md">
          <Plus className="h-[18px] w-[18px]" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
