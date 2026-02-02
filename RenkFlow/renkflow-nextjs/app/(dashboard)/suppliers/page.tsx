'use client';

import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { 
  Plus, 
  Search, 
  Filter, 
  Truck, 
  Package, 
  BarChart3,
  ArrowUpRight, 
  ArrowDownRight,
  Phone,
  Mail
} from 'lucide-react';
import { 
  getSuppliers,
  getSupplierStats
} from '@/app/actions/supplier.actions';
import { 
  type Supplier, 
  SUPPLIER_STATUS_LABELS, 
  SUPPLIER_STATUS_COLORS,
  SUPPLIER_CATEGORY_LABELS,
  type SupplierStatus,
} from '@/lib/types/supplier';
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
import { useQuery } from '@tanstack/react-query';

// ============================================
// Main Supplier Dashboard
// ============================================

export default function SupplierDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | 'all'>('all');
  
  // Fetch supplier statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['supplierStats'],
    queryFn: getSupplierStats,
  });
  
  // Fetch suppliers with filters
  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers', searchTerm, statusFilter],
    queryFn: () => getSuppliers({ 
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
            Tedarikçi Yönetimi
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Tedarikçilerinizi yönetin, performansı takip edin ve optimizasyon yapın
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Tedarikçi
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Toplam Tedarikçi" 
          value={stats?.totalSuppliers || 0} 
          icon={<Truck className="w-5 h-5" />} 
          trend={stats ? stats.activeSuppliers / (stats.totalSuppliers || 1) * 100 : 0}
        />
        <StatCard 
          title="Aktif Tedarikçi" 
          value={stats?.activeSuppliers || 0} 
          icon={<Package className="w-5 h-5" />} 
          trend={stats ? stats.activeSuppliers / (stats.totalSuppliers || 1) * 100 : 0}
        />
        <StatCard 
          title="Tercih Edilen" 
          value={stats?.preferredSuppliers || 0} 
          icon={<BarChart3 className="w-5 h-5" />} 
          trend={stats ? stats.preferredSuppliers / (stats.totalSuppliers || 1) * 100 : 0}
        />
        <StatCard 
          title="Kara Listede" 
          value={stats?.blacklistedSuppliers || 0} 
          icon={<BarChart3 className="w-5 h-5" />} 
          trend={stats?.blacklistedSuppliers || 0}
          negative
        />
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Tedarikçi ara..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              {statusFilter === 'all' ? 'Tüm Durumlar' : SUPPLIER_STATUS_LABELS[statusFilter]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
              Tümü
            </DropdownMenuItem>
            {Object.entries(SUPPLIER_STATUS_LABELS).map(([key, label]) => (
              <DropdownMenuItem 
                key={key} 
                onClick={() => setStatusFilter(key as SupplierStatus)}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Supplier Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tedarikçi Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Firma</TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Ort. Teslimat Süresi</TableHead>
                <TableHead>Kalite Puanı</TableHead>
                <TableHead className="text-right">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliersLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ) : suppliers && suppliers.length > 0 ? (
                suppliers.map((supplier: Supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">
                      {supplier.companyName}
                      {supplier.taxNumber && (
                        <div className="text-sm text-slate-500">
                          {supplier.taxNumber}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {supplier.contactName && (
                          <span>{supplier.contactName}</span>
                        )}
                        {supplier.phone && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Phone className="w-4 h-4" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Mail className="w-4 h-4" />
                            {supplier.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {supplier.category ? SUPPLIER_CATEGORY_LABELS[supplier.category] : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={SUPPLIER_STATUS_COLORS[supplier.status]}
                      >
                        {SUPPLIER_STATUS_LABELS[supplier.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {supplier.averageDeliveryTime ? `${supplier.averageDeliveryTime} gün` : '-'}
                    </TableCell>
                    <TableCell>
                      {supplier.qualityRating ? `${supplier.qualityRating}/5` : '-'}
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
                    Tedarikçi bulunamadı
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
    <Card>
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
