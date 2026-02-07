'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  ChevronDown, 
  ArrowRight, 
  MessageSquare, 
  Phone, 
  Mail,
  MoreHorizontal 
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  company: string;
  avatar?: string;
  selected?: boolean;
}

interface CustomerListProps {
  customers: Customer[];
  className?: string;
}

export function CustomerList({ customers, className }: CustomerListProps) {
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className={cn(
      "bg-white rounded-2xl py-6 flex-1 flex flex-col min-h-[400px] overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pb-4">
        <h3 className="text-xl font-semibold text-gray-900 tracking-tight">Müşteriler</h3>
        <button 
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
        >
          <span>Sırala: </span>
          <span className="font-medium">{sortBy === 'newest' ? 'En Yeni' : 'En Eski'}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Customer List */}
      <div className="flex-1 overflow-y-auto px-2">
        {customers.map((customer) => (
          <div
            key={customer.id}
            onClick={() => setSelectedId(selectedId === customer.id ? null : customer.id)}
            className={cn(
              "flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-colors",
              selectedId === customer.id 
                ? "bg-amber-50" 
                : "hover:bg-gray-50"
            )}
          >
            {/* Avatar */}
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-orange-300 to-orange-500 flex-shrink-0">
              {customer.avatar ? (
                <img 
                  src={customer.avatar} 
                  alt={customer.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium">
                  {customer.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{customer.name}</p>
              <p className="text-xs text-gray-500 truncate">{customer.company}</p>
            </div>

            {/* Actions (visible when selected) */}
            {selectedId === customer.id && (
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors">
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors">
                  <Phone className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors">
                  <Mail className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-amber-200 mx-1" />
                <button className="p-2 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Link */}
      <div className="px-6 pt-4">
        <a 
          href="/dashboard/customers" 
          className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 transition-colors"
        >
          Tüm müşteriler
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

interface ChatAvatarProps {
  name: string;
  avatar?: string;
  unread?: boolean;
  onClick?: () => void;
}

function ChatAvatar({ name, avatar, unread, onClick }: ChatAvatarProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "relative p-3 rounded-2xl transition-colors",
        unread ? "bg-amber-50" : "hover:bg-gray-50"
      )}
    >
      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-orange-300 to-orange-500">
        {avatar ? (
          <img 
            src={avatar} 
            alt={name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium">
            {name.split(' ').map(n => n[0]).join('')}
          </div>
        )}
      </div>
      {unread && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-amber-50" />
      )}
    </button>
  );
}

interface ChatWidgetProps {
  chats: { id: string; name: string; avatar?: string; unread?: boolean }[];
  unreadCount?: number;
  className?: string;
}

export function ChatWidget({ chats, unreadCount = 0, className }: ChatWidgetProps) {
  return (
    <div className={cn(
      "bg-white rounded-2xl p-6 min-w-[320px] flex flex-col",
      className
    )}>
      {/* Header */}
      <div className="pb-4">
        <h3 className="text-xl font-semibold text-gray-900 tracking-tight">Sohbetler</h3>
        <p className="text-sm text-gray-500 mt-1">{unreadCount} okunmamış mesaj</p>
      </div>

      {/* Chat Avatars */}
      <div className="flex flex-wrap gap-2">
        {chats.map((chat) => (
          <ChatAvatar 
            key={chat.id} 
            name={chat.name} 
            avatar={chat.avatar}
            unread={chat.unread}
          />
        ))}
      </div>

      {/* Footer Link */}
      <div className="pt-4 mt-auto">
        <a 
          href="/dashboard/messages" 
          className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 transition-colors"
        >
          Tüm mesajlar
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
