'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import Image from 'next/image';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { SafeResponsiveContainer } from '@/components/charts/SafeResponsiveContainer';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  Package, 
  Users, 
  Search, 
  Bell, 
  LayoutDashboard,
  Settings,
  PieChart as PieChartIcon,
  Calendar,
  Zap,
  CheckCircle2,
  Truck,
  Clock,
  RefreshCw,
  ChevronRight,
  Activity,
  CircleDot,
  Timer,
  AlertCircle,
  Box,
  MoreHorizontal,
  Filter,
  Eye,
  Edit2,
} from 'lucide-react';

interface DashboardPreviewEnhancedProps {
  isDark: boolean;
}

// Mock Data
const weeklyData = [
  { name: 'Pzt', value: 24000, orders: 32 },
  { name: 'Sal', value: 18980, orders: 28 },
  { name: 'Çar', value: 42000, orders: 45 },
  { name: 'Per', value: 35080, orders: 38 },
  { name: 'Cum', value: 48000, orders: 52 },
  { name: 'Cmt', value: 28000, orders: 25 },
  { name: 'Paz', value: 15000, orders: 18 },
];

const monthlyData = [
  { name: 'H1', value: 120000, orders: 145 },
  { name: 'H2', value: 95000, orders: 112 },
  { name: 'H3', value: 145000, orders: 168 },
  { name: 'H4', value: 180000, orders: 195 },
];

const statusDistribution = [
  { name: 'Tamamlandı', value: 45, color: '#22C55E' },
  { name: 'Üretimde', value: 30, color: '#3B82F6' },
  { name: 'Bekliyor', value: 15, color: '#F59E0B' },
  { name: 'İptal', value: 10, color: '#EF4444' },
];

const recentOrders = [
  { id: '#RF-4829', customer: 'Ahmet Yılmaz', product: 'Kartvizit 1000 Adet', status: 'completed', amount: '₺2,450', time: '2dk önce', avatar: 'AY' },
  { id: '#RF-4830', customer: 'Mehmet Demir', product: 'Broşür A4 500 Adet', status: 'production', amount: '₺1,890', time: '15dk önce', avatar: 'MD' },
  { id: '#RF-4831', customer: 'Ayşe Kaya', product: 'Afiş 70x100 50 Adet', status: 'pending', amount: '₺3,200', time: '45dk önce', avatar: 'AK' },
  { id: '#RF-4832', customer: 'Fatma Öz', product: 'Katalog 20 Sayfa', status: 'completed', amount: '₺5,600', time: '1 sa. önce', avatar: 'FÖ' },
];

const activityFeed = [
  { type: 'order', message: 'Yeni sipariş oluşturuldu', user: 'Sistem', time: '1dk önce', icon: Package },
  { type: 'status', message: '#RF-4825 üretim tamamlandı', user: 'Ali K.', time: '5dk önce', icon: CheckCircle2 },
  { type: 'delivery', message: '#RF-4820 kargoya verildi', user: 'Mehmet D.', time: '12dk önce', icon: Truck },
  { type: 'alert', message: 'Stok uyarısı: Kuşe Kağıt', user: 'Sistem', time: '30dk önce', icon: AlertCircle },
];

const quickStats = [
  { label: 'Bekleyen', value: 24, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { label: 'Üretimde', value: 18, icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { label: 'Hazır', value: 12, icon: Box, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { label: 'Kargo', value: 8, icon: Truck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
];

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const config = {
    completed: { label: 'Tamamlandı', bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' },
    production: { label: 'Üretimde', bg: 'bg-blue-500/10', text: 'text-blue-600', dot: 'bg-blue-500' },
    pending: { label: 'Bekliyor', bg: 'bg-amber-500/10', text: 'text-amber-600', dot: 'bg-amber-500' },
    cancelled: { label: 'İptal', bg: 'bg-red-500/10', text: 'text-red-600', dot: 'bg-red-500' },
  }[status] || { label: status, bg: 'bg-slate-500/10', text: 'text-slate-600', dot: 'bg-slate-500' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

// Mini Sparkline Component
const MiniSparkline = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  return (
    <div className="flex items-end gap-0.5 h-6">
      {data.map((value, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${((value - min) / range) * 100}%` }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className={`w-1 rounded-full ${color} min-h-[2px]`}
          style={{ opacity: 0.4 + (i / data.length) * 0.6 }}
        />
      ))}
    </div>
  );
};

export const DashboardPreviewEnhanced: React.FC<DashboardPreviewEnhancedProps> = ({ isDark }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dataMode, setDataMode] = useState<'weekly' | 'monthly'>('weekly');
  const [notification, setNotification] = useState<{ title: string; amount: string; type: string } | null>(null);
  const [income, setIncome] = useState(1254950);
  const [ordersCount, setOrdersCount] = useState(148);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredOrder, setHoveredOrder] = useState<string | null>(null);

  const triggerNotification = useCallback((title = 'Sipariş Tamamlandı', type = 'success') => {
    const randomBonus = Math.floor(Math.random() * 2500) + 2500;
    setNotification({ title, amount: `₺${randomBonus.toLocaleString()}`, type });
    setIncome(prev => prev + randomBonus);
    if (type === 'success') setOrdersCount(prev => prev + 1);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      const types = ['success', 'info', 'warning'];
      const messages = ['Sipariş Tamamlandı', 'Yeni Sipariş', 'Stok Güncellendi'];
      const randomIndex = Math.floor(Math.random() * types.length);
      triggerNotification(messages[randomIndex], types[randomIndex]);
    }, 6000);
    return () => clearInterval(interval);
  }, [triggerNotification]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  }, []);

  const chartData = useMemo(() => dataMode === 'weekly' ? weeklyData : monthlyData, [dataMode]);

  // Navigation Items
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'orders', icon: Package, label: 'Siparişler' },
    { id: 'customers', icon: Users, label: 'Müşteriler' },
    { id: 'reports', icon: PieChartIcon, label: 'Raporlar' },
    { id: 'calendar', icon: Calendar, label: 'Takvim' },
  ];

  return (
    <div className="relative group perspective-[2000px]">
      {/* Glow Effect */}
      <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-emerald-500/20 rounded-[2.5rem] blur-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-700" />
      
      {/* Reflection */}
      <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[80%] h-20 bg-gradient-to-t from-transparent via-blue-500/5 to-transparent blur-xl opacity-50" />

      {/* Main Container */}
      <motion.div 
        className="relative bg-white dark:bg-slate-900 rounded-[1.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] ring-1 ring-black/5 dark:ring-white/10 overflow-hidden h-[550px] flex"
        initial={{ rotateY: -8, rotateX: 5 }}
        whileHover={{ rotateY: 0, rotateX: 0, scale: 1.02 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Glass Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-50" />

        {/* Sidebar */}
        <div className="w-[72px] bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700/50 flex flex-col items-center py-5 gap-2">
          {/* Logo */}
          <motion.div 
            whileHover={{ scale: 1.1 }}
            className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-blue-500/20 mb-4 flex-shrink-0"
          >
            <Image
              src="/renkflow-logo-new.png"
              alt="RenkFlow"
              fill
              sizes="(max-width: 768px) 280px, 384px"
              className="object-contain"
              priority
            />
          </motion.div>

          {/* Nav Items */}
          <div className="flex flex-col gap-1 w-full px-2">
            {navItems.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <item.icon size={20} />
                {activeTab === item.id && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-l-full"
                  />
                )}
              </motion.button>
            ))}
          </div>

          {/* Bottom Actions */}
          <div className="mt-auto flex flex-col gap-1 w-full px-2">
            <motion.button
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.5 }}
              onClick={() => setActiveTab('settings')}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
            >
              <Settings size={20} />
            </motion.button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
          {/* Header */}
          <div className="h-14 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between px-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
                {activeTab === 'dashboard' ? 'Genel Bakış' : 
                 activeTab === 'orders' ? 'Siparişler' :
                 activeTab === 'customers' ? 'Müşteriler' :
                 activeTab === 'reports' ? 'Raporlar' : 'Takvim'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-medium flex items-center gap-1">
                <CircleDot size={8} className="animate-pulse" />
                Canlı
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs w-40">
                <Search size={14} />
                <span>Ara...</span>
                <kbd className="ml-auto px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[9px] font-mono">⌘K</kbd>
              </div>

              {/* Refresh */}
              <motion.button
                onClick={handleRefresh}
                animate={{ rotate: isRefreshing ? 360 : 0 }}
                transition={{ duration: 1, ease: 'linear' }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              >
                <RefreshCw size={16} />
              </motion.button>

              {/* Notifications */}
              <button
                onClick={() => triggerNotification('Yeni Bildirim', 'info')}
                className="relative p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              >
                <Bell size={16} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </button>

              {/* Profile */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center text-white text-xs font-bold">
                AK
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="flex-1 p-5 overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full flex flex-col gap-4"
                >
                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-2">
                    {/* Revenue Card */}
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="col-span-1 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-slate-500 font-medium">Gelir</span>
                        <span className="text-[9px] font-semibold text-emerald-500">+12%</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                        ₺{(income / 1000).toFixed(0)}K
                      </h3>
                    </motion.div>

                    {/* Orders Card */}
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="col-span-1 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-slate-500 font-medium">Sipariş</span>
                        <Package size={10} className="text-blue-500" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{ordersCount}</h3>
                    </motion.div>

                    {/* Efficiency Card */}
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="col-span-1 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-slate-500 font-medium">Verimlilik</span>
                        <Zap size={10} className="text-violet-500" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">%94</h3>
                    </motion.div>

                    {/* Delivery Card */}
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="col-span-1 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-slate-500 font-medium">Teslimat</span>
                        <Truck size={10} className="text-amber-500" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">32</h3>
                    </motion.div>
                  </div>

                  {/* Main Content Grid */}
                  <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
                    {/* Chart Section */}
                    <div className="col-span-2 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Üretim Analizi</h4>
                          <p className="text-[10px] text-slate-500">Performans trendi</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                            {['weekly', 'monthly'].map((mode) => (
                              <button
                                key={mode}
                                onClick={() => setDataMode(mode as 'weekly' | 'monthly')}
                                className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${
                                  dataMode === mode
                                    ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400 font-medium'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                              >
                                {mode === 'weekly' ? 'Haftalık' : 'Aylık'}
                              </button>
                            ))}
                          </div>
                          <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-[180px]">
                        <SafeResponsiveContainer width="100%" height="100%" minHeight={180}>
                          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#E2E8F0'} opacity={0.5} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                                padding: '10px 14px',
                              }}
                              labelStyle={{ color: isDark ? '#F1F5F9' : '#1E293B', fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}
                              itemStyle={{ fontSize: '11px', color: '#3B82F6' }}
                              formatter={(value) => [`₺${Number(value).toLocaleString()}`, 'Gelir']}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#3B82F6"
                              strokeWidth={2.5}
                              fill="url(#colorValue)"
                              animationDuration={1500}
                            />
                          </AreaChart>
                        </SafeResponsiveContainer>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="col-span-1 flex flex-col gap-4">
                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 gap-2">
                        {quickStats.map((stat) => (
                          <motion.div
                            key={stat.label}
                            whileHover={{ scale: 1.05 }}
                            className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
                          >
                            <div className={`w-7 h-7 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color} mb-2`}>
                              <stat.icon size={14} />
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">{stat.value}</div>
                            <div className="text-[9px] text-slate-500">{stat.label}</div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Recent Activity */}
                      <div className="flex-1 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-slate-900 dark:text-white text-xs">Son Aktiviteler</h4>
                          <button className="text-[10px] text-blue-600 hover:text-blue-700 font-medium">Tümü</button>
                        </div>
                        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                          {activityFeed.slice(0, 3).map((activity, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                            >
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                activity.type === 'order' ? 'bg-blue-500/10 text-blue-600' :
                                activity.type === 'status' ? 'bg-emerald-500/10 text-emerald-600' :
                                activity.type === 'delivery' ? 'bg-violet-500/10 text-violet-600' :
                                'bg-amber-500/10 text-amber-600'
                              }`}>
                                <activity.icon size={12} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-medium text-slate-700 dark:text-slate-200 truncate">{activity.message}</p>
                                <p className="text-[9px] text-slate-400">{activity.time}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row - Recent Orders */}
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-slate-900 dark:text-white text-xs">Son Siparişler</h4>
                      <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                          <Filter size={12} /> Filtrele
                        </button>
                        <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                          Tümünü Gör <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-[9px] text-slate-500 uppercase tracking-wider">
                            <th className="text-left font-medium pb-2">Sipariş</th>
                            <th className="text-left font-medium pb-2">Müşteri</th>
                            <th className="text-left font-medium pb-2">Ürün</th>
                            <th className="text-left font-medium pb-2">Durum</th>
                            <th className="text-right font-medium pb-2">Tutar</th>
                          </tr>
                        </thead>
                        <tbody className="text-[10px]">
                          {recentOrders.slice(0, 3).map((order) => (
                            <motion.tr
                              key={order.id}
                              onHoverStart={() => setHoveredOrder(order.id)}
                              onHoverEnd={() => setHoveredOrder(null)}
                              className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                            >
                              <td className="py-2">
                                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{order.id}</span>
                              </td>
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-[8px] font-bold">
                                    {order.avatar}
                                  </div>
                                  <span className="text-slate-700 dark:text-slate-300">{order.customer}</span>
                                </div>
                              </td>
                              <td className="py-2 text-slate-500 max-w-[120px] truncate">{order.product}</td>
                              <td className="py-2"><StatusBadge status={order.status} /></td>
                              <td className="py-2 text-right font-semibold text-slate-900 dark:text-white">{order.amount}</td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <motion.div
                  key="orders"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tüm Siparişler</h3>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-medium">
                        {ordersCount} sipariş
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-medium shadow-sm hover:bg-blue-700 transition-colors">
                        <Package size={12} /> Yeni Sipariş
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
                    <div className="overflow-auto h-full">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-white dark:bg-slate-800">
                          <tr className="text-[9px] text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                            <th className="text-left font-medium py-2">Sipariş</th>
                            <th className="text-left font-medium py-2">Müşteri</th>
                            <th className="text-left font-medium py-2">Ürün</th>
                            <th className="text-left font-medium py-2">Durum</th>
                            <th className="text-left font-medium py-2">Tarih</th>
                            <th className="text-right font-medium py-2">Tutar</th>
                            <th className="text-right font-medium py-2">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="text-[10px]">
                          {[...recentOrders, ...recentOrders].map((order, i) => (
                            <tr key={`${order.id}-${i}`} className="border-b border-slate-50 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                              <td className="py-2.5 font-mono font-medium text-slate-700 dark:text-slate-300">{order.id}</td>
                              <td className="py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-[8px] font-bold">
                                    {order.avatar}
                                  </div>
                                  <span className="text-slate-700 dark:text-slate-300">{order.customer}</span>
                                </div>
                              </td>
                              <td className="py-2.5 text-slate-500 max-w-[150px] truncate">{order.product}</td>
                              <td className="py-2.5"><StatusBadge status={order.status} /></td>
                              <td className="py-2.5 text-slate-400">{order.time}</td>
                              <td className="py-2.5 text-right font-semibold text-slate-900 dark:text-white">{order.amount}</td>
                              <td className="py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 transition-colors">
                                    <Eye size={12} />
                                  </button>
                                  <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-600 transition-colors">
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Other Tabs Placeholder */}
              {!['dashboard', 'orders'].includes(activeTab) && (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full flex flex-col items-center justify-center text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center text-blue-600 mb-4">
                    {activeTab === 'customers' && <Users size={32} />}
                    {activeTab === 'reports' && <PieChartIcon size={32} />}
                    {activeTab === 'calendar' && <Calendar size={32} />}
                    {activeTab === 'settings' && <Settings size={32} />}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {activeTab === 'customers' && 'Müşteri Yönetimi'}
                    {activeTab === 'reports' && 'Raporlar & Analitik'}
                    {activeTab === 'calendar' && 'Üretim Takvimi'}
                    {activeTab === 'settings' && 'Sistem Ayarları'}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-xs">
                    Bu modül yol haritasında planlanmıştır. Önceliklendirme talebinizi paylaşarak süreci hızlandırabilirsiniz.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Floating Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, x: 20, scale: 0.8 }}
            className={`absolute top-[-30px] right-[-20px] z-[100] p-4 rounded-xl shadow-2xl flex items-center gap-3 border backdrop-blur-sm ${
              notification.type === 'success' 
                ? 'bg-white dark:bg-slate-800 border-emerald-100 dark:border-emerald-900' 
                : notification.type === 'warning'
                ? 'bg-white dark:bg-slate-800 border-amber-100 dark:border-amber-900'
                : 'bg-white dark:bg-slate-800 border-blue-100 dark:border-blue-900'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
              notification.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' :
              notification.type === 'warning' ? 'bg-amber-500/10 text-amber-600' :
              'bg-blue-500/10 text-blue-600'
            }`}>
              {notification.type === 'success' ? <CheckCircle2 size={20} /> :
               notification.type === 'warning' ? <AlertCircle size={20} /> :
               <Bell size={20} />}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{notification.title}</p>
              <p className={`text-sm font-bold ${
                notification.type === 'success' ? 'text-emerald-600' :
                notification.type === 'warning' ? 'text-amber-600' :
                'text-blue-600'
              }`}>+{notification.amount}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
