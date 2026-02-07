'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { AreaChart, Area, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie } from 'recharts';
import { SafeResponsiveContainer } from '@/components/charts/SafeResponsiveContainer';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown,
  Package, 
  Users, 
  Search, 
  Bell, 
  LayoutDashboard,
  Settings,
  Calendar,
  Zap,
  Briefcase,
  CheckCircle2,
  Box,
  Truck,
  Wallet,
  Receipt,
  FileText,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useTheme } from 'next-themes';

interface FeaturesDashboardPreviewProps {
  
}

const weeklyData = [
  { name: 'Mon', value: 24000 },
  { name: 'Tue', value: 13980 },
  { name: 'Wed', value: 98000 },
  { name: 'Thu', value: 39080 },
  { name: 'Fri', value: 48000 },
  { name: 'Sat', value: 38000 },
  { name: 'Sun', value: 43000 },
];

const financeData = [
    { name: 'Pzt', income: 45000, expense: 32000 },
    { name: 'Sal', income: 52000, expense: 28000 },
    { name: 'Çar', income: 48000, expense: 41000 },
    { name: 'Per', income: 61000, expense: 35000 },
    { name: 'Cum', income: 55000, expense: 25000 },
    { name: 'Cmt', income: 67000, expense: 45000 },
    { name: 'Paz', income: 72000, expense: 30000 },
];

const barData = [
    { name: 'A', value: 80 },
    { name: 'B', value: 45 },
    { name: 'C', value: 60 },
    { name: 'D', value: 90 },
    { name: 'E', value: 55 },
];

export const FeaturesDashboardPreview: React.FC<FeaturesDashboardPreviewProps> = () => {
  const [activeTab, setActiveTab] = useState('finance'); // Default to finance to show new feature
  const [dataMode, setDataMode] = useState<'weekly' | 'monthly'>('weekly');
  const [notification, setNotification] = useState<{title: string, amount: string} | null>(null);
  const [balance, setBalance] = useState(1250450);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const triggerNotification = useCallback((title = 'Ödeme Alındı') => {
    const randomBonus = Math.floor(Math.random() * 5000) + 1000;
    setNotification({
      title,
      amount: `₺${randomBonus}`
    });
    setBalance(prev => prev + randomBonus);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
        triggerNotification('Fatura Ödendi');
    }, 8000); 

    return () => clearInterval(interval);
  }, [triggerNotification]);

  const renderContent = () => {
      switch(activeTab) {
          case 'finance':
              return (
                <div className="p-6 overflow-hidden flex flex-col gap-6 h-full animate-in fade-in duration-500">
                    {/* Finance Stats Row */}
                    <div className="grid grid-cols-3 gap-4">
                        <motion.div 
                            whileHover={{ y: -2 }}
                            className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Toplam Kasa</span>
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <TrendingUp size={10} /> +24%
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                ₺{balance.toLocaleString()}
                            </h3>
                        </motion.div>

                         <motion.div 
                            whileHover={{ y: -2 }}
                            className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bekleyen Tahsilat</span>
                                 <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded text-amber-600">
                                    <Receipt size={12} />
                                 </div>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">₺342,800</h3>
                        </motion.div>

                         <motion.div 
                            whileHover={{ y: -2 }}
                            className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Giderler (Ay)</span>
                                <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded text-red-600">
                                    <TrendingDown size={12} />
                                 </div>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">₺128,400</h3>
                        </motion.div>
                    </div>

                    {/* Finance Chart & List */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
                        
                        {/* Cash Flow Chart */}
                        <div className="col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col relative overflow-hidden">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Nakit Akışı</h4>
                                    <p className="text-[10px] text-slate-500">Gelir vs Gider Analizi</p>
                                </div>
                            </div>
                            <div className="flex-1 min-h-[150px]">
                                <SafeResponsiveContainer width="100%" height="100%" minHeight={150}>
                                    <AreaChart data={financeData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#E5E7EB'} opacity={0.5} />
                                        <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            labelStyle={{ color: '#374151', fontWeight: 600, fontSize: '12px' }}
                                            itemStyle={{ fontSize: '12px' }}
                                        />
                                        <Area type="monotone" dataKey="income" name="Gelir" stroke="#10B981" strokeWidth={2} fill="url(#colorIncome)" />
                                        <Area type="monotone" dataKey="expense" name="Gider" stroke="#EF4444" strokeWidth={2} fill="url(#colorExpense)" />
                                    </AreaChart>
                                </SafeResponsiveContainer>
                            </div>
                        </div>

                        {/* Recent Transactions */}
                        <div className="col-span-1 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
                            <h4 className="font-semibold text-slate-900 dark:text-white text-xs mb-4">Son İşlemler</h4>
                            <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar">
                                {[
                                    { name: 'Tekstil A.Ş.', desc: 'Fatura #9012', amount: '+₺42,500', type: 'in', time: '10dk' },
                                    { name: 'AWS Services', desc: 'Sunucu Gideri', amount: '-₺850', type: 'out', time: '1s' },
                                    { name: 'Yılmaz Lojistik', desc: 'Kargo Ödemesi', amount: '-₺1,200', type: 'out', time: '2s' },
                                    { name: 'Kumaş Tedarik', desc: 'Hammadde', amount: '-₺15,000', type: 'out', time: '3s' },
                                    { name: 'Moda Butik', desc: 'Tahsilat #8899', amount: '+₺12,500', type: 'in', time: '4s' },
                                ].map((tx, i) => (
                                    <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-2 rounded-lg transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'in' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                {tx.type === 'in' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-slate-900 dark:text-white">{tx.name}</p>
                                                <p className="text-[9px] text-slate-500">{tx.desc}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-[11px] font-bold ${tx.type === 'in' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>{tx.amount}</p>
                                            <p className="text-[9px] text-slate-400">{tx.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
              );

          case 'dashboard':
              return (
                <div className="p-6 overflow-hidden flex flex-col gap-6 h-full animate-in fade-in duration-500">
                    <div className="grid grid-cols-3 gap-4">
                        <motion.div whileHover={{ y: -2 }} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Toplam Gelir</span>
                                <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1"><TrendingUp size={10} /> +12%</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">₺854,950</h3>
                        </motion.div>
                         <motion.div whileHover={{ y: -2 }} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Aktif Sipariş</span>
                                <div className="p-1 bg-blue-500/10 rounded text-blue-600"><Package size={12} /></div>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">148</h3>
                        </motion.div>
                         <motion.div whileHover={{ y: -2 }} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Verimlilik</span>
                                <div className="p-1 bg-purple-500/10 rounded text-purple-600"><Zap size={12} /></div>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">%94.2</h3>
                        </motion.div>
                    </div>
                    <div className="flex-1 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-4">Haftalık Üretim</h4>
                        <div className="flex-1 w-full">
                            <SafeResponsiveContainer width="100%" height="100%" minHeight={150}>
                                <AreaChart data={weeklyData}>
                                    <defs>
                                        <linearGradient id="colorProdMain" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#E5E7EB'} opacity={0.5} />
                                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                    <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                    <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} fill="url(#colorProdMain)" />
                                </AreaChart>
                            </SafeResponsiveContainer>
                        </div>
                    </div>
                </div>
              );
              
          case 'package':
              return (
                  <div className="p-8 h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
                      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 text-blue-600">
                          <Package size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Stok Yönetimi</h3>
                      <p className="text-slate-500 text-sm max-w-xs">Tüm ürünleriniz, hammaddeleriniz ve envanteriniz tek bir yerde.</p>
                  </div>
              );

          default:
              return (
                <div className="p-8 h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-500">
                        <Settings size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Sistem Ayarları</h3>
                    <p className="text-slate-500 text-sm max-w-xs">Gelişmiş yapılandırma seçenekleri.</p>
                </div>
            );
      }
  }

  return (
    <div className="relative group perspective-[2000px]">
      {/* Decorative Blur Backdrops */}
      <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 rounded-[2rem] blur-xl opacity-20 dark:opacity-30 group-hover:opacity-40 transition-all duration-700 pointer-events-none"></div>
      
      {/* Main Container - Rotated 3D Effect */}
      <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[1.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] dark:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] ring-1 ring-slate-200/50 dark:ring-white/10 overflow-hidden transform rotate-y-[-6deg] rotate-x-[3deg] group-hover:rotate-0 group-hover:scale-[1.02] transition-all duration-500 ease-out h-[600px] flex preserve-3d">
         
         {/* Glass Shine Effect */}
         <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-50" />
        
        {/* Sidebar */}
        <div className="w-16 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-6 gap-6 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm z-[60] relative pointer-events-auto">
            <div className="w-8 h-8 relative">
                 <Image src="/renkflow-logo-new.png" alt="Logo" fill className="object-contain" />
            </div>
            
            <div className="flex flex-col gap-4 mt-6 w-full px-2">
                {[
                    { id: 'finance', icon: Wallet, label: 'Muhasebe' },
                    { id: 'dashboard', icon: LayoutDashboard, label: 'Panel' },
                    { id: 'package', icon: Package, label: 'Stok' },
                    { id: 'reports', icon: FileText, label: 'Rapor' },
                    { id: 'calendar', icon: Calendar, label: 'Takvim' },
                ].map((item) => (
                    <div 
                        key={item.id}
                        onClick={(e: React.MouseEvent<HTMLElement>) => { e.stopPropagation(); setActiveTab(item.id); }}
                        className={`p-2.5 rounded-lg transition-all cursor-pointer relative z-40 group/item ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                        title={item.label}
                    >
                        <item.icon size={20} />
                        {activeTab === item.id && (
                            <motion.div layoutId="featureActiveTab" className="absolute -right-[10px] top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-l-full" />
                        )}
                    </div>
                ))}
            </div>

            <button className="mt-auto p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                <Settings size={20} />
            </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-slate-50/30 dark:bg-slate-950/30 backdrop-blur-xl relative z-10">
            
            {/* Header */}
            <div className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 bg-white/50 dark:bg-slate-900/50">
                <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    {activeTab === 'finance' && <><Wallet size={18} className="text-emerald-500" /> Finans & Muhasebe</>}
                    {activeTab === 'dashboard' && 'Genel Bakış'}
                    {activeTab === 'package' && 'Stok Yönetimi'}
                    {activeTab === 'reports' && 'Raporlar'}
                    {activeTab === 'calendar' && 'Takvim'}
                </h2>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 text-slate-500 text-xs border border-slate-200 dark:border-slate-700 w-48 shadow-sm">
                        <Search size={14} />
                        <span>Ara...</span>
                    </div>
                    <button className="relative">
                        <Bell size={18} className="text-slate-500 hover:text-blue-600 transition-colors" />
                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse"></span>
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 shadow-md"></div>
                </div>
            </div>

            {/* Dashboard Content Grid */}
            {renderContent()}
        </div>
      </div>

      {/* Live Notification Popup */}
      <AnimatePresence>
        {notification && (
            <motion.div 
                initial={{ opacity: 0, y: 20, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, x: 20, scale: 0.8 }}
                className="absolute top-[-20px] right-[-20px] z-[9999] bg-white dark:bg-slate-800 p-4 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-3 border border-emerald-100 dark:border-emerald-900/30 transform-gpu pointer-events-none"
                style={{ transform: 'translate3d(0,0,200px)' }}
            >
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shadow-sm">
                    <CheckCircle2 size={20} />
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{notification.title}</p>
                    <p className="text-sm text-emerald-600 font-bold">+{notification.amount}</p>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
