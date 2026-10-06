'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { SafeResponsiveContainer } from '@/components/charts/SafeResponsiveContainer';
import { format, subDays, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Card } from '@/components/ui/Card';
import { Order } from '@/lib/types';

interface OrderVolumeChartProps {
  orders: Order[];
  days?: number;
}

export function OrderVolumeChart({ orders, days = 7 }: OrderVolumeChartProps) {
  const data = useMemo(() => {
    const today = new Date();
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(today, i);
      const dayOrders = orders.filter((o) => 
        isSameDay(new Date(o.createdAt), date)
      );

      result.push({
        date: format(date, 'd MMM', { locale: tr }),
        count: dayOrders.length,
        fullDate: format(date, 'd MMMM yyyy', { locale: tr }),
      });
    }

    return result;
  }, [orders, days]);

  return (
    <Card className="p-6 h-[400px]">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Sipariş Hacmi</h3>
      <div className="h-[300px] w-full">
        <SafeResponsiveContainer width="100%" height="100%" minHeight={300}>
          <BarChart data={data}>
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
              allowDecimals={false}
              dx={-10}
            />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-lg">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{payload[0].payload.fullDate}</p>
                      <p className="text-lg font-bold text-primary">
                        {payload[0].value} Sipariş
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey="count" 
              fill="#6366f1" 
              radius={[4, 4, 0, 0]}
              barSize={32}
            />
          </BarChart>
        </SafeResponsiveContainer>
      </div>
    </Card>
  );
}
