'use client';

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
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
  Zap,
  Briefcase,
  CheckCircle2
} from 'lucide-react';

interface DashboardPreviewProps {
  isDark: boolean;
}

const weeklyData = [
  { name: 'Mon', value: 2400 },
  { name: 'Tue', value: 1398 },
  { name: 'Wed', value: 9800 },
  { name: 'Thu', value: 3908 },
  { name: 'Fri', value: 4800 },
  { name: 'Sat', value: 3800 },
  { name: 'Sun', value: 4300 },
];

const monthlyData = [
    { name: 'W1', value: 4000 },
    { name: 'W2', value: 3000 },
    { name: 'W3', value: 2000 },
    { name: 'W4', value: 2780 },
    { name: 'W5', value: 1890 },
    { name: 'W6', value: 2390 },
    { name: 'W7', value: 3490 },
];

const barData = [
    { name: 'A', value: 80 },
    { name: 'B', value: 45 },
    { name: 'C', value: 60 },
    { name: 'D', value: 90 },
    { name: 'E', value: 55 },
];

export const DashboardPreview: React.FC<DashboardPreviewProps> = ({ isDark }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dataMode, setDataMode] = useState<'weekly' | 'monthly'>('weekly');
  const [notification, setNotification] = useState<{title: string, amount: string} | null>(null);
  const [income, setIncome] = useState(124500);

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
        const randomBonus = Math.floor(Math.random() * 500);
        setNotification({
            title: 'Sipariş Tamamlandı',
            amount: `₺${randomBonus}`
        });
        setIncome(prev => prev + randomBonus);

        setTimeout(() => setNotification(null), 3000);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative group perspective-[2000px]">
      
      {/* Decorative Blur Backdrops - Added pointer-events-none to prevent click blocking */}
      <div className="absolute -inset-1 bg-gradient-to-r from-primary to-indigo-600 rounded-[2rem] blur opacity-20 dark:opacity-40 group-hover:opacity-30 transition duration-1000 group-hover:duration-200 pointer-events-none"></div>
      
      {/* Main Container - Rotated 3D Effect */}
      <div className="relative bg-background rounded-[1.5rem] shadow-2xl ring-1 ring-border overflow-hidden transform rotate-y-[-10deg] rotate-x-[5deg] group-hover:rotate-0 transition-all duration-700 ease-out h-[600px] flex preserve-3d">
        
        {/* Sidebar */}
        <div className="w-16 border-r border-border flex flex-col items-center py-6 gap-6 bg-secondary/50 backdrop-blur-sm z-30 relative">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">R</div>
            
            <div className="flex flex-col gap-4 mt-4 w-full px-2">
                {[
                    { id: 'dashboard', icon: LayoutDashboard },
                    { id: 'package', icon: Package },
                    { id: 'users', icon: Users },
                    { id: 'reports', icon: PieChart },
                    { id: 'calendar', icon: Calendar },
                ].map((item) => (
                    <div 
                        key={item.id}
                        onClick={(e) => { e.stopPropagation(); setActiveTab(item.id); }}
                        className={`p-2 rounded-lg transition-all cursor-pointer relative z-40 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105' : 'text-muted-foreground hover:bg-secondary hover:scale-105'}`}
                    >
                        <item.icon size={20} />
                        {activeTab === item.id && (
                            <motion.div layoutId="activeTabIndicator" className="absolute -right-[10px] top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-l-full" />
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-auto p-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors hover:rotate-90 duration-500 z-40">
                <Settings size={20} />
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-3xl relative z-10">
            
            {/* Header */}
            <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/50">
                <h2 className="font-semibold text-foreground">Genel Bakış</h2>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 text-muted-foreground text-xs border border-border w-48 shadow-sm">
                        <Search size={14} />
                        <span>Ara...</span>
                    </div>
                    <div className="relative group/bell cursor-pointer">
                        <Bell size={18} className="text-muted-foreground group-hover/bell:text-blue-600 transition-colors" />
                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-background animate-pulse"></span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-orange-400 border-2 border-white shadow-md cursor-pointer hover:scale-105 transition-transform"></div>
                </div>
            </div>

            {/* Dashboard Content Grid */}
            <div className="p-6 overflow-hidden flex flex-col gap-6 h-full">
                
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4">
                    {/* Stat Card 1 */}
                    <motion.div 
                        whileHover={{ y: -2 }}
                        className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-border shadow-sm"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-muted-foreground font-medium">Toplam Gelir</span>
                            <span className="text-xs font-semibold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <TrendingUp size={10} /> +12%
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            ₺{income.toLocaleString()}
                        </h3>
                    </motion.div>

                     {/* Stat Card 2 */}
                     <motion.div 
                        whileHover={{ y: -2 }}
                        className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-border shadow-sm"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-muted-foreground font-medium">Aktif Sipariş</span>
                             <div className="p-1 bg-blue-500/10 rounded text-blue-600 animate-pulse-slow">
                                <Package size={12} />
                             </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">48</h3>
                    </motion.div>

                     {/* Stat Card 3 */}
                     <motion.div 
                        whileHover={{ y: -2 }}
                        className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-border shadow-sm"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-muted-foreground font-medium">Verimlilik</span>
                            <div className="p-1 bg-purple-500/10 rounded text-purple-600">
                                <Zap size={12} />
                             </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">%94.2</h3>
                    </motion.div>
                </div>

                {/* Main Chart Section */}
                <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
                    <div className="col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-border shadow-sm flex flex-col relative overflow-hidden">
                        <div className="flex justify-between items-center mb-4 relative z-10">
                            <div>
                                <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Haftalık Üretim Analizi</h4>
                                <p className="text-[10px] text-muted-foreground">Son 7 günlük performans</p>
                            </div>
                            <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5">
                                <button onClick={() => setDataMode('weekly')} className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${dataMode === 'weekly' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 font-medium' : 'text-slate-500'}`}>Haftalık</button>
                                <button onClick={() => setDataMode('monthly')} className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${dataMode === 'monthly' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 font-medium' : 'text-slate-500'}`}>Aylık</button>
                            </div>
                        </div>
                        <div className="flex-1 min-h-[150px] relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dataMode === 'weekly' ? weeklyData : monthlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#E5E7EB'} opacity={0.5} />
                                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelStyle={{ color: '#374151', fontWeight: 600, fontSize: '12px' }}
                                        itemStyle={{ fontSize: '12px', color: '#2563EB' }}
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

                    <div className="col-span-1 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-border shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                             <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Verimlilik</h4>
                             <motion.div 
                               animate={{ rotate: 360 }}
                               transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                               className="p-1 rounded bg-blue-50 text-blue-600"
                             >
                                <Briefcase size={12} />
                             </motion.div>
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

      {/* Live Notification Popup (Floating) - Moved to bottom for Z-Index Stacking */}
      <AnimatePresence>
        {notification && (
            <motion.div 
                initial={{ opacity: 0, y: 20, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, x: 20, scale: 0.8 }}
                className="absolute top-[-30px] right-[-20px] z-[100] bg-white dark:bg-slate-800 p-4 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center gap-3 border border-green-100 dark:border-green-900 transform translate-z-50"
                style={{ transform: 'translateZ(100px)' }}
            >
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-sm">
                    <CheckCircle2 size={20} />
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{notification.title}</p>
                    <p className="text-sm text-green-600 font-bold">+{notification.amount}</p>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
