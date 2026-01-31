export interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

export interface StatCardProps {
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
}

export interface ProductionLineProps {
  name: string;
  percentage: number;
  colorClass: string;
}
