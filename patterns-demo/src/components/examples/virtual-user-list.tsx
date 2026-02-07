// ============================================
// EXAMPLE: VIRTUAL USER LIST
// Demonstrates Virtualization + Data Fetching
// ============================================

'use client';

import { useState } from 'react';
import { VirtualList, VirtualTable, useInfiniteScroll } from '@/lib/virtualization/virtual-list';
import { useInfinitePosts, usePrefetchPost } from '@/lib/query/hooks';
import { SkeletonList, SkeletonAvatar, Spinner } from '@/components/loading';
import { formatRelativeTime } from '@/lib/utils';

// ============================================
// MOCK DATA
// ============================================

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'admin' | 'user';
  lastActive: string;
}

function generateUsers(count: number): User[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `user-${i + 1}`,
    name: `Kullanıcı ${i + 1}`,
    email: `user${i + 1}@example.com`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
    role: i % 10 === 0 ? 'admin' : 'user',
    lastActive: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

const mockUsers = generateUsers(10000);

// ============================================
// VIRTUAL USER LIST COMPONENT
// ============================================

export function VirtualUserList() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">
          Kullanıcılar ({mockUsers.length.toLocaleString()})
        </h2>
        <p className="text-sm text-gray-500">
          10,000 kullanıcı virtualized liste ile render ediliyor
        </p>
      </div>

      <VirtualList
        items={mockUsers}
        height={500}
        itemHeight={72}
        overscan={5}
        renderItem={(user, index) => (
          <div
            className={`
              flex items-center gap-4 p-4 border-b cursor-pointer transition-colors
              ${selectedId === user.id ? 'bg-blue-50' : 'hover:bg-gray-50'}
            `}
            onClick={() => setSelectedId(user.id)}
          >
            <img
              src={user.avatar}
              alt={user.name}
              className="w-10 h-10 rounded-full bg-gray-200"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 truncate">{user.name}</p>
                {user.role === 'admin' && (
                  <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">
                {formatRelativeTime(user.lastActive)}
              </p>
            </div>
          </div>
        )}
        emptyComponent={
          <div className="text-center text-gray-500 py-8">
            Kullanıcı bulunamadı
          </div>
        }
      />
    </div>
  );
}

// ============================================
// VIRTUAL TABLE EXAMPLE
// ============================================

export function VirtualUserTable() {
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>();

  const columns = [
    {
      key: 'name' as const,
      header: 'İsim',
      width: '25%',
      sortable: true,
      render: (user: User) => (
        <div className="flex items-center gap-2">
          <img src={user.avatar} alt="" className="w-6 h-6 rounded-full" />
          <span className="font-medium">{user.name}</span>
        </div>
      ),
    },
    {
      key: 'email' as const,
      header: 'E-posta',
      width: '30%',
      sortable: true,
    },
    {
      key: 'role' as const,
      header: 'Rol',
      width: '15%',
      sortable: true,
      render: (user: User) => (
        <span className={`
          px-2 py-1 text-xs rounded-full
          ${user.role === 'admin' 
            ? 'bg-purple-100 text-purple-700' 
            : 'bg-gray-100 text-gray-700'
          }
        `}>
          {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
        </span>
      ),
    },
    {
      key: 'lastActive' as const,
      header: 'Son Aktif',
      width: '20%',
      sortable: true,
      render: (user: User) => (
        <span className="text-gray-500">
          {formatRelativeTime(user.lastActive)}
        </span>
      ),
    },
    {
      key: 'actions' as const,
      header: '',
      width: '10%',
      render: (user: User) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('Edit user:', user.id);
          }}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          Düzenle
        </button>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">
          Kullanıcı Tablosu
        </h2>
        <p className="text-sm text-gray-500">
          Sıralanabilir ve seçilebilir virtual tablo
        </p>
      </div>

      <VirtualTable
        data={mockUsers}
        columns={columns}
        height={500}
        rowHeight={52}
        selectedIndex={selectedIndex}
        onRowClick={(user, index) => setSelectedIndex(index)}
      />
    </div>
  );
}

// ============================================
// INFINITE SCROLL EXAMPLE
// ============================================

export function InfiniteUserList() {
  const [users, setUsers] = useState(() => generateUsers(50));
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newUsers = generateUsers(50).map((u, i) => ({
      ...u,
      id: `user-${users.length + i + 1}`,
      name: `Kullanıcı ${users.length + i + 1}`,
    }));
    
    setUsers(prev => [...prev, ...newUsers]);
    setIsLoading(false);
    
    // Stop after 500 users
    if (users.length >= 450) {
      setHasMore(false);
    }
  };

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMore,
  });

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">
          Infinite Scroll ({users.length} kullanıcı)
        </h2>
        <p className="text-sm text-gray-500">
          Aşağı kaydırdıkça otomatik yükleme
        </p>
      </div>

      <div className="h-[500px] overflow-auto">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-4 p-4 border-b hover:bg-gray-50"
          >
            <img
              src={user.avatar}
              alt={user.name}
              className="w-10 h-10 rounded-full bg-gray-200"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
        ))}

        {/* Load more trigger */}
        <div ref={loadMoreRef} className="p-4 flex justify-center">
          {isLoading && <Spinner size="md" />}
          {!hasMore && (
            <p className="text-gray-500 text-sm">
              Tüm kullanıcılar yüklendi
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
