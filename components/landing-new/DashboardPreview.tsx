'use client';

import React from 'react';
import { AreaChart, Area, ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { 
  TrendingUp, 
  Package, 
  Users, 
  MoreHorizontal, 
  Search, 
  Bell, 
  LayoutDashboard,
  Settings,
  PieChart,
  Calendar,
  Zap
} from 'lucide-react';

interface DashboardPreviewProps {
  isDark: boolean;
}

const areaData = [
  { name: 'Mon', value: 2400 },
  { name: 'Tue', value: 1398 },
  { name: 'Wed', value: 5800 },
  { name: 'Thu', value: 3908 },
  { name: 'Fri', value: 4800 },
  { name: 'Sat', value: 3800 },
  { name: 'Sun', value: 4300 },
];

const barData = [
    { name: 'A', value: 80 },
    { name: 'B', value: 45 },
    { name: 'C', value: 60 },
    { name: 'D', value: 90 },
    { name: 'E', value: 55 },
];

export const DashboardPreview: React.FC<DashboardPreviewProps> = ({ isDark }) => {
  return (
    <div className="relative group perspective-[2000px]">
      
      {/* Decorative Blur Backdrops */}
      <div className="absolute -inset-1 bg-gradient-to-r from-primary to-indigo-600 rounded-[2rem] blur opacity-20 dark:opacity-40 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
      
      {/* Main Container - Rotated 3D Effect */}
      <div className="relative bg-background rounded-[1.5rem] shadow-2xl ring-1 ring-border overflow-hidden transform rotate-y-[-10deg] rotate-x-[5deg] group-hover:rotate-0 transition-all duration-700 ease-out h-[600px] flex">
        
        {/* Sidebar */}
        <div className="w-16 border-r border-border flex flex-col items-center py-6 gap-6 bg-secondary/50 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold">R</div>
            <div className="flex flex-col gap-4 mt-4 w-full px-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <LayoutDashboard size={20} />
                </div>
                <div className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                    <Package size={20} />
                </div>
                <div className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                    <Users size={20} />
                </div>
                <div className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                    <PieChart size={20} />
                </div>
                 <div className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                    <Calendar size={20} />
                </div>
            </div>
            <div className="mt-auto p-2 text-muted-foreground">
                <Settings size={20} />
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-background/80">
            
            {/* Header */}
            <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background">
                <h2 className="font-semibold text-foreground">Genel Bakış</h2>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-muted-foreground text-xs border border-border w-48">
                        <Search size={14} />
                        <span>Ara...</span>
                    </div>
                    <div className="relative">
                        <Bell size={18} className="text-muted-foreground" />
                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-background"></span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 border-2 border-background shadow-sm"></div>
                </div>
            </div>

            {/* Dashboard Content Grid */}
            <div className="p-6 overflow-hidden flex flex-col gap-6">
                
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4">
                    {/* Stat Card 1 */}
                    <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-muted-foreground font-medium">Toplam Gelir</span>
                            <span className="text-xs font-semibold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <TrendingUp size={10} /> +12%
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-foreground">₺124,500</h3>
                    </div>
                     {/* Stat Card 2 */}
                    <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-muted-foreground font-medium">Aktif Sipariş</span>
                             <div className="p-1 bg-blue-500/10 rounded text-primary">
                                <Package size={12} />
                             </div>
                        </div>
                        <h3 className="text-xl font-bold text-foreground">48</h3>
                    </div>
                     {/* Stat Card 3 */}
                    <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-muted-foreground font-medium">Verimlilik</span>
                            <div className="p-1 bg-purple-500/10 rounded text-purple-600">
                                <Zap size={12} />
                             </div>
                        </div>
                        <h3 className="text-xl font-bold text-foreground">%94.2</h3>
                    </div>
                </div>

                {/* Main Chart Section */}
                <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
                    <div className="col-span-2 p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h4 className="font-semibold text-foreground text-sm">Haftalık Üretim Analizi</h4>
                                <p className="text-[10px] text-muted-foreground">Son 7 günlük performans</p>
                            </div>
                            <MoreHorizontal size={16} className="text-muted-foreground cursor-pointer hover:text-foreground" />
                        </div>
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={areaData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#6B7280'}} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis tick={{fontSize: 10, fill: '#6B7280'}} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelStyle={{ color: '#374151', fontWeight: 600, fontSize: '12px' }}
                                        itemStyle={{ fontSize: '12px' }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke="#2563EB" 
                                        strokeWidth={3} 
                                        fill="url(#colorProd)" 
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="col-span-1 p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                             <h4 className="font-semibold text-foreground text-sm">Verimlilik</h4>
                             <div className="p-1 rounded bg-secondary text-xs font-mono text-muted-foreground">%</div>
                        </div>
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                    <Bar dataKey="value" radius={[4, 4, 4, 4]} animationDuration={1500}>
                                        {barData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={index === 3 ? '#2563EB' : '#E2E8F0'} 
                                            />
                                        ))}
                                    </Bar>
                                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};
