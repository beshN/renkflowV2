'use client';

/**
 * OrderHoverCard - Professional hover preview for orders
 * 
 * Features:
 * - Rich order summary on hover
 * - Customer contact info
 * - Order timeline mini-view
 * - Quick actions
 * - Smooth animations
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Order, OrderStatus } from '@/lib/types';
import { formatCurrency, formatDate, getOrderStatusInfo, cn } from '@/lib/utils';
import {
  User,
  Mail,
  Phone,
  Package,
  Calendar,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  MoreHorizontal,
} from 'lucide-react';

interface OrderHoverCardProps {
  order: Order;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
}

const statusTimeline: { status: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'pending', label: 'Beklemede', icon: <Clock className="w-3 h-3" /> },
  { status: 'in_production', label: 'Üretimde', icon: <Package className="w-3 h-3" /> },
  { status: 'delivered', label: 'Teslim', icon: <CheckCircle2 className="w-3 h-3" /> },
];

export function OrderHoverCard({
  order,
  children,
  side = 'right',
  align = 'start',
  delayDuration = 300,
}: OrderHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsOpen(true), delayDuration);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsOpen(false);
  };

  const statusInfo = getOrderStatusInfo(order.status);
  const isOverdue = order.deliveryDate && 
    new Date(order.deliveryDate) < new Date() && 
    order.status !== 'delivered';

  const currentStatusIndex = statusTimeline.findIndex(s => s.status === order.status);

  const getPositionStyles = () => {
    const base = 'absolute z-50';
    switch (side) {
      case 'top':
        return `${base} bottom-full mb-2 ${align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`;
      case 'bottom':
        return `${base} top-full mt-2 ${align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`;
      case 'left':
        return `${base} right-full mr-2 ${align === 'start' ? 'top-0' : align === 'end' ? 'bottom-0' : 'top-1/2 -translate-y-1/2'}`;
      case 'right':
      default:
        return `${base} left-full ml-2 ${align === 'start' ? 'top-0' : align === 'end' ? 'bottom-0' : 'top-1/2 -translate-y-1/2'}`;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: side === 'bottom' ? -10 : side === 'top' ? 10 : 0, x: side === 'right' ? -10 : side === 'left' ? 10 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.19, 1, 0.22, 1] }}
            className={cn(
              getPositionStyles(),
              'w-80 glass-panel shadow-2xl overflow-hidden'
            )}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border-b border-gray-100/50 dark:border-gray-800/50">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                      #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                    </span>
                    {isOverdue && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        Gecikmiş
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <span className={cn(
                  'px-2 py-1 text-xs font-medium rounded-full',
                  statusInfo?.className || 'bg-gray-100 text-gray-800'
                )}>
                  {statusInfo?.label || order.status}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Customer Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Müşteri
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-white">{order.customerName}</span>
                  </div>
                  {order.email && (
                    <div className="flex items-center gap-2 text-sm group">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-300 flex-1 truncate">{order.email}</span>
                      <button 
                        onClick={() => copyToClipboard(order.email!)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                      >
                        <Copy className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  )}
                  {order.phone && (
                    <div className="flex items-center gap-2 text-sm group">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-300">{order.phone}</span>
                      <button 
                        onClick={() => copyToClipboard(order.phone!)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                      >
                        <Copy className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Details */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Sipariş Detayı
                </h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">{order.productName}</span>
                  </div>
                  <span className="text-sm text-gray-500">x{order.quantity}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-sm font-medium text-gray-500">Toplam</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </span>
                </div>
              </div>

              {/* Mini Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  İlerleme
                </h4>
                <div className="flex items-center gap-1">
                  {statusTimeline.map((step, index) => {
                    const isActive = index <= currentStatusIndex;
                    const isCurrent = index === currentStatusIndex;
                    return (
                      <React.Fragment key={step.status}>
                        <div className={cn(
                          'flex items-center justify-center w-6 h-6 rounded-full transition-colors',
                          isActive 
                            ? isCurrent 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-green-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                        )}>
                          {step.icon}
                        </div>
                        {index < statusTimeline.length - 1 && (
                          <div className={cn(
                            'flex-1 h-0.5 rounded-full transition-colors',
                            index < currentStatusIndex 
                              ? 'bg-green-500' 
                              : 'bg-gray-200 dark:bg-gray-700'
                          )} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  {statusTimeline.map((step, index) => (
                    <span key={step.status} className={cn(
                      index === currentStatusIndex && 'font-medium text-blue-600 dark:text-blue-400'
                    )}>
                      {step.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Delivery Date */}
              {order.deliveryDate && (
                <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Teslim Tarihi</span>
                  </div>
                  <span className={cn(
                    'text-sm font-medium',
                    isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                  )}>
                    {formatDate(order.deliveryDate)}
                  </span>
                </div>
              )}

              {/* Notes Preview */}
              {order.notes && (
                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 italic">
                  "{order.notes}"
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <button className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700">
                <ExternalLink className="w-3.5 h-3.5" />
                Detayları Gör
              </button>
              <button className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <MoreHorizontal className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OrderHoverCard;
