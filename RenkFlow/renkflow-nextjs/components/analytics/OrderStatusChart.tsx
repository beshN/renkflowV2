'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Order } from '@/lib/types';

interface OrderStatusChartProps {
  orders: Order[];
}

const COLORS = {
  pending: '#fbbf24', // amber-400
  in_production: '#0ea5e9', // sky-500
  completed: '#10b981', // emerald-500
  delivered: '#10b981', // emerald-500 (group with completed)
  cancelled: '#ef4444', // red-500
};

const LABELS = {
  pending: 'Beklemede',
  in_production: 'Üretimde',
  completed: 'Tamamlandı',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal',
};

export function OrderStatusChart({ orders }: OrderStatusChartProps) {
  const data = useMemo(() => {
    const statusCounts = orders.reduce((acc, order) => {
      const status = order.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts)
      .map(([status, value]) => ({
        name: LABELS[status as keyof typeof LABELS] || status,
        value,
        status,
      }))
      .filter((item) => item.value > 0);
  }, [orders]);

  return (
    <Card className="p-6 h-[400px]">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Sipariş Durumu</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.status as keyof typeof COLORS] || '#94a3b8'} 
                  strokeWidth={0}
                />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value) => <span className="text-slate-600 dark:text-slate-300 ml-1">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
