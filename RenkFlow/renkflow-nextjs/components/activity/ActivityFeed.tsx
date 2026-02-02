'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Package, 
  User, 
  DollarSign, 
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Activity {
  id: string;
  type: 'order_created' | 'order_updated' | 'payment_received' | 'document_uploaded' | 'status_changed' | 'note_added' | 'task_completed';
  title: string;
  description: string;
  user: {
    name: string;
    avatar?: string;
  };
  timestamp: string;
  metadata?: {
    orderId?: string;
    orderNumber?: string;
    amount?: number;
    currency?: string;
    oldStatus?: string;
    newStatus?: string;
  };
}

const activityIcons: Record<Activity['type'], React.ReactNode> = {
  order_created: <Package className="w-4 h-4" />,
  order_updated: <RefreshCw className="w-4 h-4" />,
  payment_received: <DollarSign className="w-4 h-4" />,
  document_uploaded: <FileText className="w-4 h-4" />,
  status_changed: <CheckCircle className="w-4 h-4" />,
  note_added: <AlertCircle className="w-4 h-4" />,
  task_completed: <CheckCircle className="w-4 h-4" />,
};

const activityColors: Record<Activity['type'], string> = {
  order_created: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  order_updated: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  payment_received: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  document_uploaded: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  status_changed: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  note_added: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  task_completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

// Mock data - will be replaced with real API
const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'order_created',
    title: 'Yeni Sipariş',
    description: 'ABC Ltd. tarafından yeni bir sipariş oluşturuldu',
    user: { name: 'Ahmet Yılmaz' },
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 min ago
    metadata: { orderId: '123', orderNumber: 'SIP-2024-001' }
  },
  {
    id: '2',
    type: 'payment_received',
    title: 'Ödeme Alındı',
    description: 'XYZ A.Ş. siparişi için ödeme alındı',
    user: { name: 'Sistem' },
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
    metadata: { orderId: '124', orderNumber: 'SIP-2024-002', amount: 15000, currency: 'TRY' }
  },
  {
    id: '3',
    type: 'status_changed',
    title: 'Durum Güncellendi',
    description: 'Sipariş üretim durumundan teslimat durumuna geçti',
    user: { name: 'Mehmet Demir' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    metadata: { orderId: '125', orderNumber: 'SIP-2024-003', oldStatus: 'in_production', newStatus: 'delivered' }
  },
  {
    id: '4',
    type: 'document_uploaded',
    title: 'Belge Yüklendi',
    description: 'Fatura ve teslimat notu yüklendi',
    user: { name: 'Ayşe Kaya' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    metadata: { orderId: '126', orderNumber: 'SIP-2024-004' }
  },
  {
    id: '5',
    type: 'note_added',
    title: 'Not Eklendi',
    description: 'Müşteri ile yapılan görüşme notları eklendi',
    user: { name: 'Fatma Şahin' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    metadata: { orderId: '127', orderNumber: 'SIP-2024-005' }
  },
  {
    id: '6',
    type: 'task_completed',
    title: 'Görev Tamamlandı',
    description: 'Kalite kontrol süreci başarıyla tamamlandı',
    user: { name: 'Ali Veli' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
    metadata: { orderId: '128', orderNumber: 'SIP-2024-006' }
  },
];

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Az önce';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dk önce`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} sa önce`;
  return `${Math.floor(diffInSeconds / 86400)} gün önce`;
}

interface ActivityFeedProps {
  limit?: number;
  showFilters?: boolean;
  className?: string;
}

export function ActivityFeed({ limit = 10, showFilters = true, className }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>(mockActivities);
  const [filter, setFilter] = useState<Activity['type'] | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);

  const filteredActivities = filter === 'all' 
    ? activities.slice(0, limit)
    : activities.filter(a => a.type === filter).slice(0, limit);

  const loadMore = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  return (
    <div className={cn("bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Aktivite Akışı</h3>
        </div>
        {showFilters && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Activity['type'] | 'all')}
              className="text-sm border-0 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tümü</option>
              <option value="order_created">Yeni Sipariş</option>
              <option value="payment_received">Ödeme</option>
              <option value="status_changed">Durum Değişikliği</option>
              <option value="document_uploaded">Belge</option>
            </select>
          </div>
        )}
      </div>

      {/* Activities List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        <AnimatePresence mode="popLayout">
          {filteredActivities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className="group px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex gap-4">
                {/* Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  activityColors[activity.type]
                )}>
                  {activityIcons[activity.type]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white text-sm">
                        {activity.title}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
                        {activity.description}
                      </p>
                      
                      {/* Metadata */}
                      {activity.metadata && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {activity.metadata.orderNumber && (
                            <Link 
                              href={`/orders/${activity.metadata.orderId}`}
                              className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                            >
                              #{activity.metadata.orderNumber}
                            </Link>
                          )}
                          {activity.metadata.amount && (
                            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: activity.metadata.currency || 'TRY' }).format(activity.metadata.amount)}
                            </span>
                          )}
                          {activity.metadata.oldStatus && activity.metadata.newStatus && (
                            <span className="text-xs flex items-center gap-1">
                              <span className="text-slate-400">{activity.metadata.oldStatus}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="text-blue-600 font-medium">{activity.metadata.newStatus}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <span className="text-xs text-slate-400 shrink-0">
                      {getRelativeTime(activity.timestamp)}
                    </span>
                  </div>

                  {/* User */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                      {activity.user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {activity.user.name}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredActivities.length === 0 && (
          <div className="px-6 py-8 text-center">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">
              Bu kriterlere uygun aktivite bulunmuyor
            </p>
          </div>
        )}
      </div>

      {/* Load More */}
      {activities.length >= limit && (
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="w-full text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2 py-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Yükleniyor...
              </>
            ) : (
              <>
                Daha fazla göster
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// Compact version for sidebar/dashboard
export function ActivityFeedCompact({ limit = 5 }: { limit?: number }) {
  const activities = mockActivities.slice(0, limit);

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <Link
          key={activity.id}
          href={activity.metadata?.orderId ? `/orders/${activity.metadata.orderId}` : '#'}
          className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
        >
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
            activityColors[activity.type]
          )}>
            {activityIcons[activity.type]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
              {activity.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {getRelativeTime(activity.timestamp)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
