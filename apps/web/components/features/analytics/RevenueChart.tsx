'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { SafeResponsiveContainer } from '@/components/charts/SafeResponsiveContainer';
import { format, subDays, isSameDay, startOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Card } from '@/components/ui/Card';
import { Order } from '@/lib/types';

interface RevenueChartProps {
  orders: Order[];
  days?: number;
}

export function RevenueChart({ orders, days = 7 }: RevenueChartProps) {
  const data = useMemo(() => {
    const today = new Date();
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(today, i);
      const dayOrders = orders.filter((o) => 
        isSameDay(new Date(o.createdAt), date)
      );

      const revenue = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);

      result.push({
        date: format(date, 'd MMM', { locale: tr }),
        revenue,
        fullDate: format(date, 'd MMMM yyyy', { locale: tr }),
      });
    }

    return result;
  }, [orders, days]);

  return (
    <Card className="p-6 h-[400px]">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Gelir Trendi</h3>
      <div className="h-[300px] w-full">
        <SafeResponsiveContainer width="100%" height="100%" minHeight={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8c5e40" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8c5e40" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
              tickFormatter={(value) => `₺${value}`}
              dx={-10}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-lg">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{payload[0].payload.fullDate}</p>
                      <p className="text-lg font-bold text-primary">
                        ₺{Number(payload[0].value).toLocaleString('tr-TR')}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#8c5e40"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
          </AreaChart>
        </SafeResponsiveContainer>
      </div>
    </Card>
  );
}
