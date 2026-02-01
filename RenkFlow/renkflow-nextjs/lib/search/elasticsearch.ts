/**
 * Elasticsearch Service
 * Enterprise-grade search with Elasticsearch
 */

import { Client } from '@elastic/elasticsearch';
import { Order } from '@/lib/types';

// ============================================
// Client Configuration
// ============================================

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    const config: any = {
      node: ELASTICSEARCH_URL,
    };

    if (ELASTICSEARCH_API_KEY) {
      config.auth = {
        apiKey: ELASTICSEARCH_API_KEY,
      };
    }

    client = new Client(config);
  }

  return client;
}

// ============================================
// Index Configuration
// ============================================

const ORDERS_INDEX = 'renkflow_orders';

const ORDERS_MAPPING = {
  properties: {
    id: { type: 'keyword' },
    tenantId: { type: 'keyword' },
    orderNumber: { type: 'keyword' },
    customerName: {
      type: 'text',
      analyzer: 'turkish',
      fields: {
        keyword: { type: 'keyword' },
        suggest: { type: 'completion' },
      },
    },
    email: { type: 'keyword' },
    phone: { type: 'keyword' },
    productName: {
      type: 'text',
      analyzer: 'turkish',
      fields: {
        keyword: { type: 'keyword' },
        suggest: { type: 'completion' },
      },
    },
    quantity: { type: 'integer' },
    status: { type: 'keyword' },
    totalAmount: { type: 'float' },
    currency: { type: 'keyword' },
    deliveryDate: { type: 'date' },
    notes: { type: 'text', analyzer: 'turkish' },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
  },
};

// ============================================
// Index Management
// ============================================

export async function createOrdersIndex(): Promise<void> {
  const es = getClient();

  const exists = await es.indices.exists({ index: ORDERS_INDEX });

  if (!exists) {
    await es.indices.create({
      index: ORDERS_INDEX,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          analyzer: {
            turkish: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'turkish_stemmer', 'asciifolding'],
            },
          },
          filter: {
            turkish_stemmer: {
              type: 'stemmer',
              language: 'turkish',
            },
          },
        },
      },
      mappings: ORDERS_MAPPING as any,
    });

    console.log('[Elasticsearch] Orders index created');
  }
}

export async function deleteOrdersIndex(): Promise<void> {
  const es = getClient();

  const exists = await es.indices.exists({ index: ORDERS_INDEX });

  if (exists) {
    await es.indices.delete({ index: ORDERS_INDEX });
    console.log('[Elasticsearch] Orders index deleted');
  }
}

// ============================================
// Document Operations
// ============================================

export async function indexOrder(order: Order, tenantId: string): Promise<void> {
  const es = getClient();

  await es.index({
    index: ORDERS_INDEX,
    id: String(order.id),
    document: {
      ...order,
      tenantId,
    },
  });
}

export async function bulkIndexOrders(orders: Order[], tenantId: string): Promise<void> {
  const es = getClient();

  const operations = orders.flatMap((order) => [
    { index: { _index: ORDERS_INDEX, _id: String(order.id) } },
    { ...order, tenantId },
  ]);

  await es.bulk({ operations });
}

export async function deleteOrderFromIndex(orderId: string): Promise<void> {
  const es = getClient();

  await es.delete({
    index: ORDERS_INDEX,
    id: orderId,
  });
}

// ============================================
// Search Types
// ============================================

export interface ElasticSearchOptions {
  query: string;
  tenantId: string;
  filters?: {
    status?: string[];
    dateRange?: { from?: string; to?: string };
    amountRange?: { min?: number; max?: number };
  };
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ElasticSearchResult {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  suggestions: string[];
  executionTime: number;
}

// ============================================
// Search Operations
// ============================================

export async function searchOrders(options: ElasticSearchOptions): Promise<ElasticSearchResult> {
  const es = getClient();
  const startTime = Date.now();

  const {
    query,
    tenantId,
    filters = {},
    page = 1,
    pageSize = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  // Build query
  const must: any[] = [
    { term: { tenantId } },
  ];

  // Text search
  if (query.trim()) {
    must.push({
      multi_match: {
        query,
        fields: ['customerName^3', 'productName^2', 'orderNumber^2', 'notes', 'email'],
        type: 'best_fields',
        fuzziness: 'AUTO',
        operator: 'or',
      },
    });
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    must.push({
      terms: { status: filters.status },
    });
  }

  // Date range filter
  if (filters.dateRange) {
    const range: any = {};
    if (filters.dateRange.from) range.gte = filters.dateRange.from;
    if (filters.dateRange.to) range.lte = filters.dateRange.to;
    if (Object.keys(range).length > 0) {
      must.push({ range: { createdAt: range } });
    }
  }

  // Amount range filter
  if (filters.amountRange) {
    const range: any = {};
    if (filters.amountRange.min !== undefined) range.gte = filters.amountRange.min;
    if (filters.amountRange.max !== undefined) range.lte = filters.amountRange.max;
    if (Object.keys(range).length > 0) {
      must.push({ range: { totalAmount: range } });
    }
  }

  // Execute search
  const result = await es.search({
    index: ORDERS_INDEX,
    query: {
      bool: { must },
    },
    from: (page - 1) * pageSize,
    size: pageSize,
    sort: [{ [sortBy]: { order: sortOrder } }],
    highlight: {
      fields: {
        customerName: {},
        productName: {},
        notes: {},
      },
      pre_tags: ['<mark>'],
      post_tags: ['</mark>'],
    },
    suggest: query.trim() ? {
      text: query,
      customerSuggestion: {
        completion: {
          field: 'customerName.suggest',
          skip_duplicates: true,
          size: 5,
        },
      },
      productSuggestion: {
        completion: {
          field: 'productName.suggest',
          skip_duplicates: true,
          size: 5,
        },
      },
    } : undefined,
  });

  const hits = result.hits.hits;
  const total = typeof result.hits.total === 'number' 
    ? result.hits.total 
    : result.hits.total?.value || 0;

  // Extract suggestions
  const suggestions: string[] = [];
  if (result.suggest) {
    const customerSuggestions = (result.suggest as any).customerSuggestion?.[0]?.options || [];
    const productSuggestions = (result.suggest as any).productSuggestion?.[0]?.options || [];
    
    for (const s of [...customerSuggestions, ...productSuggestions]) {
      if (!suggestions.includes(s.text)) {
        suggestions.push(s.text);
      }
    }
  }

  const executionTime = Date.now() - startTime;

  return {
    items: hits.map((hit) => hit._source as Order),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    suggestions,
    executionTime,
  };
}

// ============================================
// Autocomplete / Suggestions
// ============================================

export async function getSearchSuggestions(
  query: string,
  tenantId: string,
  limit: number = 10
): Promise<string[]> {
  const es = getClient();

  if (!query.trim()) return [];

  const result = await es.search({
    index: ORDERS_INDEX,
    size: 0,
    query: {
      bool: {
        must: [
          { term: { tenantId } },
          {
            multi_match: {
              query,
              fields: ['customerName', 'productName', 'orderNumber'],
              type: 'phrase_prefix',
            },
          },
        ],
      },
    },
    suggest: {
      text: query,
      customerSuggestion: {
        completion: {
          field: 'customerName.suggest',
          skip_duplicates: true,
          size: limit,
          contexts: {
            tenantId: [tenantId],
          },
        },
      },
      productSuggestion: {
        completion: {
          field: 'productName.suggest',
          skip_duplicates: true,
          size: limit,
        },
      },
    },
  } as any);

  const suggestions: string[] = [];

  if (result.suggest) {
    const customerSuggestions = (result.suggest as any).customerSuggestion?.[0]?.options || [];
    const productSuggestions = (result.suggest as any).productSuggestion?.[0]?.options || [];

    for (const s of [...customerSuggestions, ...productSuggestions]) {
      if (!suggestions.includes(s.text)) {
        suggestions.push(s.text);
      }
    }
  }

  return suggestions.slice(0, limit);
}

// ============================================
// Aggregations / Analytics
// ============================================

export async function getOrdersAggregations(tenantId: string): Promise<{
  statusCounts: Record<string, number>;
  totalRevenue: number;
  averageOrderValue: number;
  ordersPerMonth: { month: string; count: number }[];
}> {
  const es = getClient();

  const result = await es.search({
    index: ORDERS_INDEX,
    size: 0,
    query: {
      term: { tenantId },
    },
    aggs: {
      statusCounts: {
        terms: { field: 'status' },
      },
      totalRevenue: {
        sum: { field: 'totalAmount' },
      },
      averageOrderValue: {
        avg: { field: 'totalAmount' },
      },
      ordersPerMonth: {
        date_histogram: {
          field: 'createdAt',
          calendar_interval: 'month',
          format: 'yyyy-MM',
        },
      },
    },
  } as any);

  const aggs = result.aggregations as any;

  return {
    statusCounts: Object.fromEntries(
      (aggs?.statusCounts?.buckets || []).map((b: any) => [b.key, b.doc_count])
    ),
    totalRevenue: aggs?.totalRevenue?.value || 0,
    averageOrderValue: aggs?.averageOrderValue?.value || 0,
    ordersPerMonth: (aggs?.ordersPerMonth?.buckets || []).map((b: any) => ({
      month: b.key_as_string,
      count: b.doc_count,
    })),
  };
}

// ============================================
// Health Check
// ============================================

export async function checkElasticsearchHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  cluster?: string;
  indices?: number;
  documents?: number;
}> {
  try {
    const es = getClient();
    const health = await es.cluster.health();
    const stats = await es.indices.stats({ index: ORDERS_INDEX }).catch(() => null);

    return {
      status: health.status === 'green' ? 'healthy' : health.status === 'yellow' ? 'degraded' : 'unhealthy',
      cluster: health.cluster_name,
      indices: health.active_primary_shards,
      documents: stats?._all?.primaries?.docs?.count || 0,
    };
  } catch (error) {
    return { status: 'unhealthy' };
  }
}

// ============================================
// Fallback Search (when ES is unavailable)
// ============================================

export function isElasticsearchConfigured(): boolean {
  return !!process.env.ELASTICSEARCH_URL;
}

export { getClient };
