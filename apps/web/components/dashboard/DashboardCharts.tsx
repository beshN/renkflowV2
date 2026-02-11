"use client";

import { useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Sector } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Inbox } from 'lucide-react';

interface MonthlyTrendChartProps {
  data: { month: string; value: number }[];
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  if (data.length === 0 || data.every(d => d.value === 0)) {
     return (
        <Card className="h-80 flex flex-col items-center justify-center text-neutral-400">
           <Inbox className="w-10 h-10 mb-2 opacity-50" />
           <p className="text-sm">Henüz veri yok</p>
        </Card>
     )
  }

  return (
    <Card className="p-6 h-96 flex flex-col">
       <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Aylık Sipariş Trendi</h3>
          <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30">
            Gerçek Zamanlı
          </span>
       </div>
       <div className="flex-1 w-full min-h-0">
         <ResponsiveContainer width="100%" height="100%">
           <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
             <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12 }} 
                dy={10}
             />
             <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12 }} 
             />
             <Tooltip 
                cursor={{ fill: 'transparent' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-neutral-900 text-white text-xs px-2 py-1 rounded shadow-xl">
                        {payload[0].value} Sipariş
                      </div>
                    );
                  }
                  return null;
                }}
             />
             <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={1000}>
               {data.map((entry, index) => (
                 <Cell key={`cell-${index}`} fill={index === data.length - 1 ? '#b87444' : '#cbd5e1'} className="dark:fill-neutral-700 dark:hover:fill-blue-500 hover:fill-blue-500 transition-colors duration-300" />
               ))}
             </Bar>
           </BarChart>
         </ResponsiveContainer>
       </div>
    </Card>
  );
}

interface StatusDistributionChartProps {
  data: { label: string; count: number; percentage: number; color: string }[];
  totalOrders: number;
}

export function StatusDistributionChart({ data, totalOrders }: StatusDistributionChartProps) {
  const chartData = useMemo(() => {
    return data.map(item => ({
       name: item.label,
       value: item.count,
       color: item.color.includes('blue') ? '#b87444' : 
              item.color.includes('green') ? '#10b981' : 
              item.color.includes('yellow') ? '#f59e0b' : '#94a3b8'
    }));
  }, [data]);

   if (totalOrders === 0) {
     return (
        <Card className="h-80 flex flex-col items-center justify-center text-neutral-400">
           <Inbox className="w-10 h-10 mb-2 opacity-50" />
           <p className="text-sm">Henüz sipariş yok</p>
        </Card>
     )
  }

  return (
    <Card className="p-6 h-96 flex flex-col">
       <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Durum Dağılımı</h3>
       </div>
       
       <div className="flex-1 flex flex-col md:flex-row items-center gap-6">
          {/* Chart */}
          <div className="relative w-48 h-48 flex-shrink-0">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                   <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                   >
                      {chartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                      ))}
                   </Pie>
                   <Tooltip 
                     content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                           return (
                              <div className="bg-white dark:bg-neutral-800 p-2 rounded-lg shadow-xl border border-neutral-100 dark:border-neutral-700 text-xs">
                                 <span className="font-semibold" style={{ color: payload[0].payload.fill }}>{payload[0].name}</span>
                                 <div className="text-neutral-500">{payload[0].value} Sipariş</div>
                              </div>
                           )
                        }
                        return null;
                     }}
                   />
                </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-3xl font-bold text-neutral-900 dark:text-white">{totalOrders}</span>
                 <span className="text-xs text-neutral-500 uppercase tracking-wide">Toplam</span>
             </div>
          </div>

          {/* Legend */}
          <div className="flex-1 w-full space-y-3">
             {data.map((item, index) => (
                <div key={item.label} className="w-full">
                   <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                         <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartData[index].color }} />
                         {item.label}
                      </span>
                      <span className="font-medium text-neutral-900 dark:text-neutral-200">{item.count}</span>
                   </div>
                   <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full" 
                        style={{ width: `${item.percentage}%`, backgroundColor: chartData[index].color }} 
                      />
                   </div>
                </div>
             ))}
          </div>
       </div>
    </Card>
  );
}
