'use client';

import { useMemo } from 'react';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { 
  StatCard, 
  QuarterGoalCard, 
  MiniStatCard,
  CustomerList,
  ChatWidget,
  GrowthChart,
  TopStates,
  NewDeals,
} from '@/components/dashboard';

const mockCustomers = [
  { id: '1', name: 'Ahmet Yılmaz', company: 'ABC Tekstil' },
  { id: '2', name: 'Fatma Demir', company: 'Organik Gıda A.Ş.' },
  { id: '3', name: 'Mehmet Kaya', company: 'İstanbul Meyve Ltd.' },
  { id: '4', name: 'Zeynep Öztürk', company: 'Ege Tarım' },
];

const mockChats = [
  { id: '1', name: 'Fatma Demir', unread: true },
  { id: '2', name: 'Ahmet Yılmaz', unread: true },
  { id: '3', name: 'Mehmet Kaya' },
  { id: '4', name: 'Zeynep Öztürk' },
];

const mockGrowthData = [
  { year: '2018', value: 20000 },
  { year: '2019', value: 35000 },
  { year: '2020', value: 28000 },
  { year: '2021', value: 45000 },
  { year: '2022', value: 62000 },
  { year: '2023', value: 85000 },
  { year: '2024', value: 95000 },
];

const mockTopStates = [
  { code: 'İST', value: 120000 },
  { code: 'ANK', value: 80000 },
  { code: 'İZM', value: 70000 },
  { code: 'BRS', value: 50000 },
];

const mockDeals = [
  { id: '1', name: 'Fruit2Go' },
  { id: '2', name: "Marshall's MKT" },
  { id: '3', name: 'CCNT' },
  { id: '4', name: 'Joana Mini-market' },
  { id: '5', name: 'Little Brazil Vegan' },
  { id: '6', name: 'Target' },
  { id: '7', name: 'Organic Place' },
  { id: '8', name: "Morello's" },
];

export default function ProfessionalDashboard() {
  const { orders } = useOrders();
  const { user } = useAuth();

  const stats = useMemo(() => {
    if (!orders) return { revenue: 0, lostDeals: 0, quarterGoal: 0, delivered: 0 };
    
    const totalOrders = orders.length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const quarterGoal = totalOrders > 0 ? Math.round((delivered / totalOrders) * 100) : 84;
    
    return {
      revenue: 15,
      lostDeals: 4,
      quarterGoal,
      delivered,
      totalRevenue,
    };
  }, [orders]);

  return (
    <div className="min-h-screen bg-[#f6f6f3] p-4 space-y-4">
      {/* Row 1: Stats Cards */}
      <div className="flex gap-4 flex-wrap">
        <StatCard
          title="Gelirler"
          value={`${stats.revenue}%`}
          trend="up"
          description="Geçen haftaya kıyasla artış"
          linkText="Gelir raporu"
          linkHref="/dashboard/reports/revenue"
        />
        <StatCard
          title="Kaybedilen Anlaşmalar"
          value={`${stats.lostDeals}%`}
          description="100 anlaşmadan 96'sını kapattınız"
          linkText="Tüm anlaşmalar"
          linkHref="/dashboard/deals"
        />
        <QuarterGoalCard
          percentage={stats.quarterGoal}
          linkText="Tüm hedefler"
          linkHref="/dashboard/goals"
        />
      </div>

      {/* Row 2: Customers & Growth */}
      <div className="flex gap-4 flex-wrap">
        <CustomerList 
          customers={mockCustomers}
          className="min-w-[300px]"
        />
        <div className="flex-1 flex flex-col gap-4 min-w-[540px]">
          <GrowthChart 
            data={mockGrowthData}
            className="w-full"
          />
          <div className="flex gap-4">
            <MiniStatCard
              title="En İyi Ay"
              value="Kasım"
              subtitle="2019"
              className="flex-1"
            />
            <MiniStatCard
              title="En İyi Yıl"
              value="2023"
              subtitle="96K satış"
              className="flex-1"
            />
            <MiniStatCard
              title="En İyi Müşteri"
              value="Fatma Demir"
              subtitle="Organik Gıda A.Ş."
              avatar={
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white text-[10px] font-medium">
                  FD
                </div>
              }
              className="flex-1"
            />
          </div>
        </div>
      </div>

      {/* Row 3: Chats, Top States, New Deals */}
      <div className="flex gap-4 flex-wrap">
        <ChatWidget 
          chats={mockChats}
          unreadCount={2}
          className="min-w-[300px]"
        />
        <TopStates 
          states={mockTopStates}
          className="min-w-[300px]"
        />
        <NewDeals 
          deals={mockDeals}
          className="min-w-[320px]"
        />
      </div>
    </div>
  );
}
