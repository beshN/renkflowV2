import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from 'recharts';
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
      <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-purple-600 rounded-[2rem] blur opacity-20 dark:opacity-40 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
      
      {/* Main Container - Rotated 3D Effect */}
      <div className="relative bg-white dark:bg-[#0f172a] rounded-[1.5rem] shadow-2xl ring-1 ring-gray-900/5 dark:ring-white/10 overflow-hidden transform rotate-y-[-10deg] rotate-x-[5deg] group-hover:rotate-0 transition-all duration-700 ease-out h-[600px] flex">
        
        {/* Sidebar */}
        <div className="w-16 border-r border-gray-100 dark:border-gray-800 flex flex-col items-center py-6 gap-6 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold">R</div>
            <div className="flex flex-col gap-4 mt-4 w-full px-2">
                <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                    <LayoutDashboard size={20} />
                </div>
                <div className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <Package size={20} />
                </div>
                <div className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <Users size={20} />
                </div>
                <div className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <PieChart size={20} />
                </div>
                 <div className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <Calendar size={20} />
                </div>
            </div>
            <div className="mt-auto p-2 text-gray-400">
                <Settings size={20} />
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-white/80 dark:bg-gray-900/80">
            
            {/* Header */}
            <div className="h-16 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-6 bg-white dark:bg-gray-900">
                <h2 className="font-semibold text-gray-800 dark:text-white">Genel Bakış</h2>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 text-xs border border-gray-200 dark:border-gray-700 w-48">
                        <Search size={14} />
                        <span>Ara...</span>
                    </div>
                    <div className="relative">
                        <Bell size={18} className="text-gray-500 dark:text-gray-400" />
                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-gray-900"></span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 border-2 border-white dark:border-gray-800 shadow-sm"></div>
                </div>
            </div>

            {/* Dashboard Content Grid */}
            <div className="p-6 overflow-hidden flex flex-col gap-6">
                
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4">
                    {/* Stat Card 1 */}
                    <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Toplam Gelir</span>
                            <span className="text-xs font-semibold text-green-500 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <TrendingUp size={10} /> +12%
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">₺124,500</h3>
                    </div>
                     {/* Stat Card 2 */}
                    <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Aktif Sipariş</span>
                             <div className="p-1 bg-blue-50 dark:bg-blue-900/30 rounded text-primary-600">
                                <Package size={12} />
                             </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">48</h3>
                    </div>
                     {/* Stat Card 3 */}
                    <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Verimlilik</span>
                            <div className="p-1 bg-purple-50 dark:bg-purple-900/30 rounded text-purple-600">
                                <Zap size={12} />
                             </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">%94.2</h3>
                    </div>
                </div>

                {/* Main Chart Section */}
                <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
                    <div className="col-span-2 p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold text-gray-800 dark:text-white text-sm">Haftalık Üretim</h4>
                            <MoreHorizontal size={16} className="text-gray-400" />
                        </div>
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={areaData}>
                                    <defs>
                                        <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} fill="url(#colorProd)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="col-span-1 p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold text-gray-800 dark:text-white text-sm">Hedefler</h4>
                        </div>
                        <div className="flex-1 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData}>
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {barData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3B82F6' : '#93C5FD'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                 {/* Recent Activity Table Preview */}
                 <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-100 dark:border-gray-700">
                            <span className="font-medium text-gray-400">PROJE</span>
                            <span className="font-medium text-gray-400">DURUM</span>
                            <span className="font-medium text-gray-400">TARİH</span>
                        </div>
                        {[1, 2].map((i) => (
                             <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700"></div>
                                    <div className="w-20 h-2 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                </div>
                                <div className="w-16 h-4 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 text-[10px] flex items-center justify-center font-medium">Tamamlandı</div>
                                <div className="w-12 h-2 bg-gray-100 dark:bg-gray-700 rounded"></div>
                            </div>
                        ))}
                    </div>
                 </div>

            </div>
        </div>
      </div>
    </div>
  );
};