import { visibleOrdersForActor } from '@/lib/features/orders/access';
/**
 * Global Search API
 * Provides unified search across orders with Elasticsearch or fallback
 */

import { NextRequest } from 'next/server';
import { getAPIUser, successResponse, errorResponse, handleCORS } from '@/lib/api/auth-helpers';
import { hasPermission, UserRole } from '@/lib/auth/rbac';
import { 
  searchOrders, 
  getSearchSuggestions, 
  isElasticsearchConfigured,
  ElasticSearchOptions 
} from '@/lib/search/elasticsearch';
import { orderService } from '@/lib/services/orderService.server';
import { SearchEngine } from '@/lib/search/search-engine';
import { Order } from '@/lib/types';
import type { SearchableDocument } from '@/lib/features/search/search/search-engine';

type SearchOrderDocument = Omit<Order, 'id'> & SearchableDocument & { id: string };

// CORS preflight
export async function OPTIONS() {
  return handleCORS();
}

// GET /api/v1/search - Search orders
export async function GET(request: NextRequest) {
  try {
    const user = await getAPIUser(request);

    if (!user?.tenantId) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    // RBAC Check
    const userRole = (user.role as UserRole) || 'member';
    if (!hasPermission(userRole, 'orders', 'list')) {
      return errorResponse('Bu işlem için yetkiniz bulunmuyor', 403);
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const statusFilter = searchParams.get('status')?.split(',').filter(Boolean) || [];
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const amountMin = userRole !== 'worker' && searchParams.get('amountMin') ? parseFloat(searchParams.get('amountMin')!) : undefined;
    const amountMax = userRole !== 'worker' && searchParams.get('amountMax') ? parseFloat(searchParams.get('amountMax')!) : undefined;
    const suggestionsOnly = searchParams.get('suggestionsOnly') === 'true';

    // Suggestions only mode
    if (suggestionsOnly) {
      if (userRole !== 'worker' && isElasticsearchConfigured()) {
        const suggestions = await getSearchSuggestions(query, user.tenantId, 10);
        return successResponse({ suggestions }, 'Öneriler getirildi');
      } else {
        // Fallback: simple prefix matching
        const orders = await visibleOrdersForActor(await orderService.getOrders(user.tenantId), { tenantId:user.tenantId,userId:user.id,role:userRole });
        const normalizedOrders: SearchOrderDocument[] = orders.map((o: Order) => ({
          ...o,
          id: String(o.id),
        }));
        const engine = new SearchEngine<SearchOrderDocument>(normalizedOrders);
        const suggestions = engine.getSuggestions(query, 10);
        return successResponse({ suggestions }, 'Öneriler getirildi');
      }
    }

    // Full search
    if (userRole !== 'worker' && isElasticsearchConfigured()) {
      // Use Elasticsearch
      const searchOptions: ElasticSearchOptions = {
        query,
        tenantId: user.tenantId,
        filters: {
          status: statusFilter.length > 0 ? statusFilter : undefined,
          dateRange: dateFrom || dateTo ? { from: dateFrom, to: dateTo } : undefined,
          amountRange: amountMin !== undefined || amountMax !== undefined 
            ? { min: amountMin, max: amountMax } 
            : undefined,
        },
        page,
        pageSize,
        sortBy,
        sortOrder,
      };

      const result = await searchOrders(searchOptions);

      return successResponse({
        items: result.items,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        suggestions: result.suggestions,
        executionTime: result.executionTime,
        engine: 'elasticsearch',
      }, 'Arama tamamlandı');
    } else {
      // Fallback: In-memory search
      const orders = await visibleOrdersForActor(await orderService.getOrders(user.tenantId), { tenantId:user.tenantId,userId:user.id,role:userRole });
      const normalizedOrders: SearchOrderDocument[] = orders.map((o: Order) => ({
        ...o,
        id: String(o.id),
      }));
      const engine = new SearchEngine<SearchOrderDocument>(normalizedOrders);

      const searchResult = engine.search({
        query,
        fields: [
          { name: 'customerName', weight: 3, fuzzy: true },
          { name: 'productName', weight: 2, fuzzy: true },
          { name: 'orderNumber', weight: 2, exact: true },
          { name: 'notes', weight: 1, fuzzy: true },
          { name: 'email', weight: 1, exact: true },
        ],
        filters: {
          ...(statusFilter.length > 0 && { status: statusFilter }),
          ...(amountMin !== undefined || amountMax !== undefined) && {
            totalAmount: { min: amountMin, max: amountMax },
          },
        },
        page,
        pageSize,
        sortBy,
        sortOrder,
      });

      return successResponse({
        items: searchResult.items,
        total: searchResult.total,
        page: searchResult.page,
        pageSize: searchResult.pageSize,
        totalPages: searchResult.totalPages,
        suggestions: engine.getSuggestions(query, 5),
        executionTime: searchResult.executionTime,
        engine: 'in-memory',
      }, 'Arama tamamlandı');
    }
  } catch (error) {
    console.error('Search error:', error);
    return errorResponse('Arama sırasında bir hata oluştu', 500);
  }
}
