'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { AreaChart, Area, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
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
  PieChart,
  Calendar,
  Zap,
  Briefcase,
  CheckCircle2,
  Box,
  Truck
} from 'lucide-react';

interface DashboardPreviewProps {
  isDark: boolean;
  locale?: 'tr' | 'en' | 'ar';
}

const weeklyBase = [24000, 13980, 98000, 39080, 48000, 38000, 43000];
const monthlyBase = [40000, 30000, 20000, 27800, 18900, 23900, 34900];

const barData = [
    { name: 'A', value: 80 },
    { name: 'B', value: 45 },
    { name: 'C', value: 60 },
    { name: 'D', value: 90 },
    { name: 'E', value: 55 },
];

export const DashboardPreview: React.FC<DashboardPreviewProps> = ({ isDark, locale = 'tr' }) => {
  const uiLocale: 'tr' | 'en' | 'ar' = locale === 'en' || locale === 'ar' ? locale : 'tr';
  const localizedCopy = {
    tr: {
      orderCompleted: 'Sipariş Tamamlandı',
      totalRevenue: 'Toplam Gelir',
      activeOrders: 'Aktif Siparişler',
      efficiency: 'Verimlilik',
      weeklyProduction: 'Haftalık Üretim Analizi',
      performance7Days: 'Son 7 günlük performans',
      weekly: 'Haftalık',
      monthly: 'Aylık',
      recentOrders: 'Son Siparişler',
      completed: 'Tamamlandı',
      inProduction: 'Üretimde',
      waiting: 'Bekliyor',
      growth: 'Haftalık Büyüme',
      overview: 'Genel Bakış',
      stocks: 'Stoklar',
      users: 'Kullanıcılar',
      reports: 'Raporlar',
      calendar: 'Takvim',
      settings: 'Ayarlar',
      search: 'Ara...',
      newAlert: 'Yeni Bildirim',
      minutesAgo: 'dk. önce',
      hourAgo: 'sa. önce',
      weeklyLabels: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
      monthlyLabels: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'],
    },
    en: {
      orderCompleted: 'Order Completed',
      totalRevenue: 'Total Revenue',
      activeOrders: 'Active Orders',
      efficiency: 'Efficiency',
      weeklyProduction: 'Weekly Production Analysis',
      performance7Days: 'Performance over last 7 days',
      weekly: 'Weekly',
      monthly: 'Monthly',
      recentOrders: 'Recent Orders',
      completed: 'Completed',
      inProduction: 'In Production',
      waiting: 'Queued',
      growth: 'Weekly Growth',
      overview: 'Overview',
      stocks: 'Stocks',
      users: 'Users',
      reports: 'Reports',
      calendar: 'Calendar',
      settings: 'Settings',
      search: 'Search...',
      newAlert: 'New Alert',
      minutesAgo: 'min ago',
      hourAgo: 'h ago',
      weeklyLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      monthlyLabels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
    },
    ar: {
      orderCompleted: 'تم إكمال الطلب',
      totalRevenue: 'إجمالي الإيرادات',
      activeOrders: 'الطلبات النشطة',
      efficiency: 'الكفاءة',
      weeklyProduction: 'تحليل الإنتاج الأسبوعي',
      performance7Days: 'أداء آخر 7 أيام',
      weekly: 'أسبوعي',
      monthly: 'شهري',
      recentOrders: 'آخر الطلبات',
      completed: 'مكتمل',
      inProduction: 'قيد الإنتاج',
      waiting: 'قيد الانتظار',
      growth: 'النمو الأسبوعي',
      overview: 'نظرة عامة',
      stocks: 'المخزون',
      users: 'المستخدمون',
      reports: 'التقارير',
      calendar: 'التقويم',
      settings: 'الإعدادات',
      search: 'بحث...',
      newAlert: 'تنبيه جديد',
      minutesAgo: 'دقيقة',
      hourAgo: 'ساعة',
      weeklyLabels: ['الإث', 'الثل', 'الأر', 'الخ', 'الجم', 'السب', 'الأح'],
      monthlyLabels: ['أ1', 'أ2', 'أ3', 'أ4', 'أ5', 'أ6', 'أ7'],
    },
  } as const;
  const text = localizedCopy[uiLocale];
  const weeklyData: Array<{ name: string; value: number }> = weeklyBase.map((value, index) => ({ name: text.weeklyLabels[index] ?? '', value }));
  const monthlyData: Array<{ name: string; value: number }> = monthlyBase.map((value, index) => ({ name: text.monthlyLabels[index] ?? '', value }));
  const currencyNumber = new Intl.NumberFormat(uiLocale === 'tr' ? 'tr-TR' : uiLocale === 'ar' ? 'ar-EG' : 'en-US');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dataMode, setDataMode] = useState<'weekly' | 'monthly'>('weekly');
  const [notification, setNotification] = useState<{title: string, amount: string} | null>(null);
  const [income, setIncome] = useState(854950);
  const reportMetrics = uiLocale === 'tr'
    ? [
        { label: 'Toplam Gelir', value: '₺1.2M', trend: '+9.4% bu ay' },
        { label: 'Teslimat Süresi', value: '3.8 gün', trend: '-0.6 gün' },
        { label: 'Fire Oranı', value: '%1.4', trend: 'stabil' },
      ]
    : uiLocale === 'en'
      ? [
          { label: 'Revenue', value: '$1.2M', trend: '+9.4% this month' },
          { label: 'Lead Time', value: '3.8 days', trend: '-0.6 days' },
          { label: 'Scrap Rate', value: '1.4%', trend: 'stable' },
        ]
      : [
          { label: 'الإيراد', value: '١٫٢M$', trend: '+٩٫٤٪ هذا الشهر' },
          { label: 'زمن التسليم', value: '٣٫٨ يوم', trend: '-٠٫٦ يوم' },
          { label: 'معدل الهدر', value: '١٫٤٪', trend: 'مستقر' },
        ];
  const reportDistributionTitle =
    uiLocale === 'tr' ? 'Üretim Dağılımı' : uiLocale === 'en' ? 'Production Distribution' : 'توزيع الإنتاج';
  const reportLast30Days =
    uiLocale === 'tr' ? 'Son 30 gün' : uiLocale === 'en' ? 'Last 30 days' : 'آخر 30 يوماً';
  const reportTopLinesTitle =
    uiLocale === 'tr' ? 'Öne Çıkan Hatlar' : uiLocale === 'en' ? 'Top Lines' : 'الخطوط الأبرز';
  const reportLines = uiLocale === 'tr'
    ? [
        { label: 'Kesim Hattı', value: '₺320K', icon: Box },
        { label: 'Montaj Hattı', value: '₺240K', icon: Briefcase },
        { label: 'Paketleme', value: '₺190K', icon: Truck },
      ]
    : uiLocale === 'en'
      ? [
          { label: 'Cutting Line', value: '$320K', icon: Box },
          { label: 'Assembly Line', value: '$240K', icon: Briefcase },
          { label: 'Packaging', value: '$190K', icon: Truck },
        ]
      : [
          { label: 'خط القص', value: '$320K', icon: Box },
          { label: 'خط التجميع', value: '$240K', icon: Briefcase },
          { label: 'التغليف', value: '$190K', icon: Truck },
        ];
  const calendarTitle =
    uiLocale === 'tr' ? 'Üretim Takvimi' : uiLocale === 'en' ? 'Production Calendar' : 'تقويم الإنتاج';
  const calendarViewLabel =
    uiLocale === 'tr' ? 'Haftalık görünüm' : uiLocale === 'en' ? 'Weekly view' : 'عرض أسبوعي';
  const calendarItems = uiLocale === 'tr'
    ? [
        { day: 'Pzt', task: 'Kesim - 14 sipariş', color: 'bg-blue-500' },
        { day: 'Sal', task: 'Montaj - 11 sipariş', color: 'bg-emerald-500' },
        { day: 'Çar', task: 'Boya - 9 sipariş', color: 'bg-purple-500' },
        { day: 'Per', task: 'Paketleme - 16 sipariş', color: 'bg-amber-500' },
      ]
    : uiLocale === 'en'
      ? [
          { day: 'Mon', task: 'Cutting - 14 orders', color: 'bg-blue-500' },
          { day: 'Tue', task: 'Assembly - 11 orders', color: 'bg-emerald-500' },
          { day: 'Wed', task: 'Painting - 9 orders', color: 'bg-purple-500' },
          { day: 'Thu', task: 'Packaging - 16 orders', color: 'bg-amber-500' },
        ]
      : [
          { day: 'الإث', task: 'قص - 14 طلب', color: 'bg-blue-500' },
          { day: 'الثل', task: 'تجميع - 11 طلب', color: 'bg-emerald-500' },
          { day: 'الأر', task: 'دهان - 9 طلبات', color: 'bg-purple-500' },
          { day: 'الخ', task: 'تغليف - 16 طلب', color: 'bg-amber-500' },
        ];
  const todayTasksTitle =
    uiLocale === 'tr' ? 'Bugünkü görevler' : uiLocale === 'en' ? "Today's tasks" : 'مهام اليوم';
  const todayTasksCount =
    uiLocale === 'tr' ? '4 adet' : uiLocale === 'en' ? '4 items' : '4 مهام';
  const todayTasks = uiLocale === 'tr'
    ? ['Kesim hattı kontrol', 'Montaj kalite testi', 'Depo sevkiyat planı', 'Müşteri revizyonu']
    : uiLocale === 'en'
      ? ['Cutting line check', 'Assembly QA test', 'Warehouse shipping plan', 'Customer revision']
      : ['فحص خط القص', 'اختبار جودة التجميع', 'خطة شحن المخزن', 'مراجعة طلب العميل'];
  const settingsDescription =
    uiLocale === 'tr' ? 'Takım ve süreç tercihleri' : uiLocale === 'en' ? 'Team and process preferences' : 'تفضيلات الفريق والعمليات';
  const settingsCards = uiLocale === 'tr'
    ? [
        { label: 'Otomatik Bildirimler', status: 'Açık' },
        { label: 'Teslimat Hatırlatıcıları', status: 'Açık' },
        { label: 'Raporlama Özeti', status: 'Haftalık' },
        { label: 'Kalite Kontrol', status: 'Standart' },
      ]
    : uiLocale === 'en'
      ? [
          { label: 'Auto Notifications', status: 'On' },
          { label: 'Delivery Reminders', status: 'On' },
          { label: 'Reporting Digest', status: 'Weekly' },
          { label: 'Quality Control', status: 'Standard' },
        ]
      : [
          { label: 'إشعارات تلقائية', status: 'مفعّل' },
          { label: 'تذكير التسليم', status: 'مفعّل' },
          { label: 'ملخص التقارير', status: 'أسبوعي' },
          { label: 'ضبط الجودة', status: 'قياسي' },
        ];

  const triggerNotification = useCallback((title?: string) => {
    const randomBonus = Math.floor(Math.random() * 2500) + 2500;
    setNotification({
      title: title ?? text.orderCompleted,
      amount: `₺${randomBonus}`
    });
    setIncome(prev => prev + randomBonus);
    setTimeout(() => setNotification(null), 3000);
  }, [text.orderCompleted]);

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
        triggerNotification(text.orderCompleted);
    }, 5000); // Faster updates

    return () => clearInterval(interval);
  }, [text.orderCompleted, triggerNotification]);

  const renderContent = () => {
      switch(activeTab) {
          case 'dashboard':
              return (
                <div className="p-6 overflow-hidden flex flex-col gap-6 h-full animate-in fade-in duration-500">
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-4">
                        {/* Stat Card 1 */}
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            whileHover={{ y: -2 }}
                            className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-border shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs text-muted-foreground font-medium">{text.totalRevenue}</span>
                                <span className="text-xs font-semibold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <TrendingUp size={10} /> +12%
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                ₺{currencyNumber.format(income)}
                            </h3>
                        </motion.div>

                         {/* Stat Card 2 */}
                         <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            whileHover={{ y: -2 }}
                            className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-border shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs text-muted-foreground font-medium">{text.activeOrders}</span>
                                 <div className="p-1 bg-blue-500/10 rounded text-blue-600 animate-pulse-slow">
                                    <Package size={12} />
                                 </div>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">148</h3>
                        </motion.div>

                         {/* Stat Card 3 */}
                         <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            whileHover={{ y: -2 }}
                            className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-border shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs text-muted-foreground font-medium">{text.efficiency}</span>
                                <div className="p-1 bg-purple-500/10 rounded text-purple-600">
                                    <Zap size={12} />
                                 </div>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">%94.2</h3>
                        </motion.div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
                        
                        {/* Main Chart Section */}
                        <div className="col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-border shadow-sm flex flex-col relative overflow-hidden">
                            <div className="flex justify-between items-center mb-4 relative z-10">
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{text.weeklyProduction}</h4>
                                    <p className="text-[10px] text-muted-foreground">{text.performance7Days}</p>
                                </div>
                                <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5">
                                    <button onClick={() => setDataMode('weekly')} className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${dataMode === 'weekly' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 font-medium' : 'text-slate-500'}`}>{text.weekly}</button>
                                    <button onClick={() => setDataMode('monthly')} className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${dataMode === 'monthly' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 font-medium' : 'text-slate-500'}`}>{text.monthly}</button>
                                </div>
                            </div>
                            <div className="flex-1 min-h-[150px] relative z-10">
                                <SafeResponsiveContainer width="100%" height="100%" minHeight={150}>
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
                                </SafeResponsiveContainer>
                            </div>
                        </div>

                        {/* Recent Orders / Activity Column */}
                        <div className="col-span-1 flex flex-col gap-4">
                             {/* Efficiency Chart */}
                            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-border shadow-sm flex flex-col h-[180px]">
                                <div className="flex justify-between items-center mb-2">
                                     <h4 className="font-semibold text-slate-900 dark:text-white text-xs">{text.efficiency}</h4>
                                     <div className="text-[10px] text-green-500 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">+4.2%</div>
                                </div>
                                <div className="flex-1 w-full">
                                    <SafeResponsiveContainer width="100%" height="100%" minHeight={100}>
                                        <BarChart data={barData}>
                                            <Bar dataKey="value" radius={[4, 4, 4, 4]} animationDuration={1500}>
                                                {barData.map((entry, index) => (
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={index === 3 ? '#2563EB' : '#E2E8F0'} 
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </SafeResponsiveContainer>
                                </div>
                            </div>
                            
                            {/* Mini Recent Orders List */}
                            <div className="flex-1 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-border shadow-sm overflow-hidden flex flex-col">
                                <h4 className="font-semibold text-slate-900 dark:text-white text-xs mb-3">{text.recentOrders}</h4>
                                <div className="flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar">
                                    {[
                                        { id: '#4829', status: text.completed, amount: '₺12,400', time: `2 ${text.minutesAgo}`, color: 'bg-green-500' },
                                        { id: '#4830', status: text.inProduction, amount: '₺8,250', time: `15 ${text.minutesAgo}`, color: 'bg-blue-500' },
                                        { id: '#4831', status: text.waiting, amount: '₺3,100', time: `1 ${text.hourAgo}`, color: 'bg-orange-500' },
                                    ].map((order, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-border/50">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{order.id}</span>
                                                <span className="text-[9px] text-muted-foreground">{order.time}</span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                 <span className="text-[10px] font-semibold text-slate-900 dark:text-white">{order.amount}</span>
                                                 <span className={`text-[8px] px-1.5 py-0.5 rounded-full text-white ${order.color} bg-opacity-80`}>{order.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
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
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{text.stocks}</h3>
                      <p className="text-slate-500 text-sm max-w-xs">
                        {uiLocale === 'tr'
                          ? 'Tüm ürünleriniz, hammaddeleriniz ve envanteriniz tek bir yerde.'
                          : uiLocale === 'en'
                            ? 'Manage products, raw materials, and inventory in one operational view.'
                            : 'إدارة المنتجات والمواد الخام والمخزون من شاشة تشغيل واحدة.'}
                      </p>
                      
                      <div className="mt-8 w-full space-y-3">
                          {[1,2,3].map(i => (
                              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-white dark:bg-slate-800 shadow-sm">
                                  <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700" />
                                      <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded" />
                                  </div>
                                  <div className="w-12 h-2 bg-green-200 dark:bg-green-900 rounded" />
                              </div>
                          ))}
                      </div>
                  </div>
              );
        case 'reports':
            return (
                <div className="p-6 h-full flex flex-col gap-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-3 gap-4">
                        {reportMetrics.map((metric) => (
                            <div key={metric.label} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-border shadow-sm">
                                <p className="text-[10px] text-muted-foreground font-medium">{metric.label}</p>
                                <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{metric.value}</p>
                                <p className="text-[10px] text-emerald-500 font-semibold mt-1">{metric.trend}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-border shadow-sm flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-slate-900 dark:text-white text-xs">{reportDistributionTitle}</h4>
                                <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">{reportLast30Days}</span>
                            </div>
                            <div className="flex-1 min-h-[140px]">
                                <SafeResponsiveContainer width="100%" height="100%" minHeight={140}>
                                    <BarChart data={barData}>
                                        <Bar dataKey="value" radius={[6, 6, 6, 6]} animationDuration={1500}>
                                            {barData.map((entry, index) => (
                                                <Cell 
                                                    key={`report-cell-${index}`} 
                                                    fill={index === 3 ? '#2563EB' : '#E2E8F0'} 
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </SafeResponsiveContainer>
                            </div>
                        </div>
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-border shadow-sm flex flex-col">
                            <h4 className="font-semibold text-slate-900 dark:text-white text-xs mb-3">{reportTopLinesTitle}</h4>
                            <div className="flex flex-col gap-3">
                                {reportLines.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-border/50">
                                        <div className="flex items-center gap-2">
                                            <item.icon size={14} className="text-slate-500" />
                                            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                                        </div>
                                        <span className="text-[11px] font-semibold text-slate-900 dark:text-white">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            );
        case 'calendar':
            return (
                <div className="p-8 h-full flex flex-col gap-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{calendarTitle}</h3>
                        <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">{calendarViewLabel}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {calendarItems.map((item, i) => (
                            <div key={i} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-border shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{item.day}</span>
                                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                </div>
                                <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.task}</p>
                                <p className="text-[10px] text-slate-500 mt-1">08:30 - 17:00</p>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-border shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-slate-500" />
                                <span className="text-xs font-semibold text-slate-900 dark:text-white">{todayTasksTitle}</span>
                            </div>
                            <span className="text-[10px] text-blue-600 font-semibold">{todayTasksCount}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                            {todayTasks.map((task, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                    {task}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        case 'users':
            return (
                <div className="p-8 h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4 text-purple-600">
                        <Users size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{text.users}</h3>
                    <p className="text-slate-500 text-sm max-w-xs">
                      {uiLocale === 'tr'
                        ? 'Kullanıcı rolleri, izinler ve performans takibi.'
                        : uiLocale === 'en'
                          ? 'User roles, permissions, and team execution visibility.'
                          : 'الأدوار والصلاحيات ومتابعة تنفيذ الفريق.'}
                    </p>
                </div>
            );
        default:
              return (
                <div className="p-8 h-full flex flex-col gap-6 animate-in fade-in duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                            <Settings size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{text.settings}</h3>
                            <p className="text-[10px] text-slate-500">{settingsDescription}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {settingsCards.map((item, i) => (
                            <div key={i} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-border shadow-sm">
                                <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.label}</p>
                                <p className="text-[10px] text-slate-500 mt-1">{item.status}</p>
                            </div>
                        ))}
                    </div>
                </div>
            );
      }
  }

  return (
    <div className="relative group">
      <div 
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden h-[500px] xl:h-[560px] 2xl:h-[600px] flex z-10"
      >
        
        {/* Sidebar */}
        <div className="w-16 border-r border-border flex flex-col items-center py-6 gap-6 bg-secondary/50 backdrop-blur-sm z-[60] relative pointer-events-auto">
            <Image
              src="/renkflow-logo-new.png"
              alt="RenkFlow"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
              priority
            />
            
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
                        onClick={(e: React.MouseEvent<HTMLElement>) => { e.stopPropagation(); setActiveTab(item.id); }}
                        className={`p-2 rounded-lg transition-all cursor-pointer relative z-40 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105' : 'text-muted-foreground hover:bg-secondary hover:scale-105'}`}
                    >
                        <item.icon size={20} />
                        {activeTab === item.id && (
                            <motion.div layoutId="activeTabIndicator" className="absolute -right-[10px] top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-l-full" />
                        )}
                    </div>
                ))}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="mt-auto p-2 text-muted-foreground hover:text-foreground transition-colors hover:rotate-90 duration-500 z-40"
              aria-label={text.settings}
            >
                <Settings size={20} />
            </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-xl relative z-10 transition-all duration-300">
            
            {/* Header */}
            <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/50">
                <h2 className="font-semibold text-foreground">
                    {activeTab === 'dashboard' ? text.overview :
                     activeTab === 'package' ? text.stocks :
                     activeTab === 'users' ? text.users :
                     activeTab === 'reports' ? text.reports : text.calendar}
                </h2>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 text-muted-foreground text-xs border border-border w-48 shadow-sm">
                        <Search size={14} />
                        <span>{text.search}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => triggerNotification(text.newAlert)}
                        className="relative group/bell transition-colors"
                        aria-label={text.newAlert}
                    >
                        <Bell size={18} className="text-muted-foreground group-hover/bell:text-blue-600 transition-colors" />
                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-background animate-pulse"></span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('users')}
                        className="w-8 h-8 rounded-full bg-orange-400 border-2 border-white shadow-md hover:scale-105 transition-transform"
                        aria-label={uiLocale === 'tr' ? 'Profil' : uiLocale === 'en' ? 'Profile' : 'الملف الشخصي'}
                    ></button>
                </div>
            </div>

            {/* Dashboard Content Grid */}
            {renderContent()}
        </div>
      </div>

      {/* Live Notification Popup (Floating) - Moved to bottom for Z-Index Stacking */}
      <AnimatePresence>
        {notification && (
            <motion.div 
                initial={{ opacity: 0, y: 20, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, x: 20, scale: 0.8 }}
                className="absolute top-[-40px] right-[-20px] z-[9999] bg-white dark:bg-slate-800 p-3 rounded-xl shadow-lg flex items-center gap-3 border border-slate-200 dark:border-slate-700"
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
