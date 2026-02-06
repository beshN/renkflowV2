'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  Filter, 
  UserPlus, 
  Phone, 
  Mail, 
  Users, 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight 
} from 'lucide-react';
import { getCustomerStats } from '@/app/actions/customer.actions';
import { getCustomers } from '@/lib/services/customer.server';
import { 
  type Customer, 
  CUSTOMER_STATUS_LABELS, 
  CUSTOMER_STATUS_COLORS,
  INDUSTRY_LABELS,
  type CustomerStatus
} from '@/lib/types/customer';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/Table';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem 
} from '@/components/ui/DropdownMenu';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================
// Main CRM Dashboard
// ============================================

export default function CRMDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'all'>('all');
  
  // Fetch customer statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['customerStats'],
    queryFn: getCustomerStats,
  });
  
  // Fetch customers with filters
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers', searchTerm, statusFilter],
    queryFn: () => getCustomers({ 
      search: searchTerm, 
      status: statusFilter !== 'all' ? statusFilter : undefined 
    }),
  });
  
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Müşteri İlişkileri Yönetimi (CRM)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Müşterilerinizi yönetin, etkileşimleri takip edin ve satışları artırın
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Müşteri
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Toplam Müşteri" 
          value={stats?.totalCustomers || 0} 
          icon={<Users className="w-5 h-5" />} 
          trend={stats ? (stats.newThisMonth - stats.churnedThisMonth) : 0}
        />
        <StatCard 
          title="Aktif Müşteri" 
          value={stats?.activeCustomers || 0} 
          icon={<Activity className="w-5 h-5" />} 
          trend={stats ? stats.activeCustomers / (stats.totalCustomers || 1) * 100 : 0}
        />
        <StatCard 
          title="VIP Müşteri" 
          value={stats?.vipCustomers || 0} 
          icon={<UserPlus className="w-5 h-5" />} 
          trend={stats ? stats.vipCustomers / (stats.totalCustomers || 1) * 100 : 0}
        />
        <StatCard 
          title="Bu Ay Kaybedilen" 
          value={stats?.churnedThisMonth || 0} 
          icon={<UserPlus className="w-5 h-5" />} 
          trend={stats?.churnedThisMonth || 0}
          negative
        />
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Müşteri ara..."
            className="pl-10"
            variant="glass"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              {statusFilter === 'all' ? 'Tüm Durumlar' : CUSTOMER_STATUS_LABELS[statusFilter]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
              Tümü
            </DropdownMenuItem>
            {Object.entries(CUSTOMER_STATUS_LABELS).map(([key, label]) => (
              <DropdownMenuItem 
                key={key} 
                onClick={() => setStatusFilter(key as CustomerStatus)}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Customer Table */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Müşteri Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Firma</TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead>Endüstri</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Kredi Limiti</TableHead>
                <TableHead>Son Etkileşim</TableHead>
                <TableHead className="text-right">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customersLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ) : customers && customers.length > 0 ? (
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      {customer.companyName}
                      {customer.taxNumber && (
                        <div className="text-sm text-slate-500">
                          {customer.taxNumber}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {customer.contactName && (
                          <span>{customer.contactName}</span>
                        )}
                        {customer.phone && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Phone className="w-4 h-4" />
                            {customer.phone}
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Mail className="w-4 h-4" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.industry ? INDUSTRY_LABELS[customer.industry] : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={CUSTOMER_STATUS_COLORS[customer.status]}
                      >
                        {CUSTOMER_STATUS_LABELS[customer.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(customer.creditLimit)}
                    </TableCell>
                    <TableCell>
                      {customer.lastContactDate
                        ? new Date(customer.lastContactDate).toLocaleDateString('tr-TR')
                        : 'Hiç etkileşim yok'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline">
                        Detay
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Müşteri bulunamadı
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function StatCard({ 
  title, 
  value, 
  icon, 
  trend, 
  negative = false 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode; 
  trend: number;
  negative?: boolean;
}) {
  const TrendIcon = negative ? ArrowDownRight : ArrowUpRight;
  const trendColor = negative ? 'text-red-600' : 'text-green-600';
  
  return (
    <Card variant="glass">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {title}
        </CardTitle>
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-600">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span>{trend.toFixed(1)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
