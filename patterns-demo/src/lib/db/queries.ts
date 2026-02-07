// ============================================
// DRIZZLE ORM QUERY PATTERNS
// Relational vs Raw SQL Approaches
// ============================================

import { eq, and, or, desc, like, sql, inArray, isNull, gte, lte, count, ilike } from 'drizzle-orm';

// ============================================
// SECURITY UTILITIES
// ============================================

/**
 * Sanitize search input to prevent SQL injection via LIKE patterns
 * Escapes special characters: % _ \
 */
function sanitizeSearchInput(input: string): string {
  return input
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/%/g, '\\%')    // Escape percent signs
    .replace(/_/g, '\\_')    // Escape underscores
    .trim()
    .slice(0, 100); // Limit length to prevent DoS
}
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { users, posts, comments, tags, postTags, sessions } from './schema';
import type { User, Post, Comment, NewUser, NewPost, NewComment } from './schema';

// ============================================
// DATABASE CONNECTION
// ============================================

import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

// Database connection with lazy initialization
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!dbInstance) {
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    const pool = new Pool({ connectionString });
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}

// Proxy to lazily access db
const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle<typeof schema>>];
  },
});

// ============================================
// USER QUERIES
// ============================================

export const userQueries = {
  // Basic CRUD with relational queries
  findById: async (id: string) => {
    return db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        posts: {
          limit: 5,
          orderBy: [desc(posts.createdAt)],
        },
      },
    });
  },

  findByEmail: async (email: string) => {
    return db.query.users.findFirst({
      where: eq(users.email, email),
    });
  },

  findMany: async (params: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
  }) => {
    const { page = 1, limit = 10, role, search } = params;
    const offset = (page - 1) * limit;

    const conditions = [isNull(users.deletedAt)];
    
    if (role) {
      conditions.push(eq(users.role, role));
    }
    
    if (search) {
      const sanitizedSearch = sanitizeSearchInput(search);
      conditions.push(
        or(
          ilike(users.name, `%${sanitizedSearch}%`),
          ilike(users.email, `%${sanitizedSearch}%`)
        )!
      );
    }

    const [data, totalResult] = await Promise.all([
      db.query.users.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: [desc(users.createdAt)],
      }),
      db.select({ count: count() })
        .from(users)
        .where(and(...conditions)),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total: totalResult[0].count,
        hasMore: offset + data.length < totalResult[0].count,
      },
    };
  },

  create: async (data: NewUser) => {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },

  update: async (id: string, data: Partial<User>) => {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  },

  softDelete: async (id: string) => {
    return db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, id));
  },
};

// ============================================
// POST QUERIES
// ============================================

export const postQueries = {
  // Complex relational query with nested relations
  findById: async (id: string) => {
    return db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        comments: {
          where: eq(comments.isApproved, true),
          limit: 10,
          orderBy: [desc(comments.createdAt)],
          with: {
            author: {
              columns: { id: true, name: true, avatar: true },
            },
          },
        },
        postTags: {
          with: {
            tag: true,
          },
        },
      },
    });
  },

  findBySlug: async (slug: string) => {
    return db.query.posts.findFirst({
      where: and(
        eq(posts.slug, slug),
        isNull(posts.deletedAt)
      ),
      with: {
        author: {
          columns: { id: true, name: true, avatar: true },
        },
        postTags: {
          with: { tag: true },
        },
      },
    });
  },

  findPublished: async (params: {
    page?: number;
    limit?: number;
    authorId?: string;
    tagSlug?: string;
  }) => {
    const { page = 1, limit = 10, authorId, tagSlug } = params;
    const offset = (page - 1) * limit;

    // Using raw SQL for complex join queries
    if (tagSlug) {
      const result = await db.execute(sql`
        SELECT 
          p.*,
          u.name as author_name,
          u.avatar as author_avatar,
          array_agg(t.name) as tags
        FROM ${posts} p
        INNER JOIN ${users} u ON p.author_id = u.id
        INNER JOIN ${postTags} pt ON p.id = pt.post_id
        INNER JOIN ${tags} t ON pt.tag_id = t.id
        WHERE p.status = 'published'
          AND p.deleted_at IS NULL
          AND t.slug = ${tagSlug}
        GROUP BY p.id, u.name, u.avatar
        ORDER BY p.published_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `);
      
      return result.rows;
    }

    // Relational query for simpler cases
    const conditions = [
      eq(posts.status, 'published'),
      isNull(posts.deletedAt),
    ];

    if (authorId) {
      conditions.push(eq(posts.authorId, authorId));
    }

    return db.query.posts.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(posts.publishedAt)],
      with: {
        author: {
          columns: { id: true, name: true, avatar: true },
        },
        postTags: {
          with: { tag: true },
        },
      },
    });
  },

  create: async (data: NewPost, tagIds?: string[]) => {
    return db.transaction(async (tx) => {
      const [post] = await tx.insert(posts).values(data).returning();

      if (tagIds?.length) {
        await tx.insert(postTags).values(
          tagIds.map(tagId => ({
            postId: post.id,
            tagId,
          }))
        );
      }

      return post;
    });
  },

  update: async (id: string, data: Partial<Post>, tagIds?: string[]) => {
    return db.transaction(async (tx) => {
      const [post] = await tx
        .update(posts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(posts.id, id))
        .returning();

      if (tagIds !== undefined) {
        await tx.delete(postTags).where(eq(postTags.postId, id));
        
        if (tagIds.length) {
          await tx.insert(postTags).values(
            tagIds.map(tagId => ({
              postId: id,
              tagId,
            }))
          );
        }
      }

      return post;
    });
  },

  incrementViewCount: async (id: string) => {
    await db
      .update(posts)
      .set({ viewCount: sql`${posts.viewCount} + 1` })
      .where(eq(posts.id, id));
  },

  publish: async (id: string) => {
    return db
      .update(posts)
      .set({ 
        status: 'published', 
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id))
      .returning();
  },
};

// ============================================
// COMMENT QUERIES
// ============================================

export const commentQueries = {
  findByPost: async (postId: string, params: { approved?: boolean } = {}) => {
    const conditions = [
      eq(comments.postId, postId),
      isNull(comments.deletedAt),
      isNull(comments.parentId), // Only top-level comments
    ];

    if (params.approved !== undefined) {
      conditions.push(eq(comments.isApproved, params.approved));
    }

    return db.query.comments.findMany({
      where: and(...conditions),
      orderBy: [desc(comments.createdAt)],
      with: {
        author: {
          columns: { id: true, name: true, avatar: true },
        },
        replies: {
          where: params.approved !== undefined 
            ? eq(comments.isApproved, params.approved)
            : undefined,
          with: {
            author: {
              columns: { id: true, name: true, avatar: true },
            },
          },
        },
      },
    });
  },

  create: async (data: NewComment) => {
    const [comment] = await db.insert(comments).values(data).returning();
    return comment;
  },

  approve: async (id: string) => {
    return db
      .update(comments)
      .set({ isApproved: true, updatedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();
  },
};

// ============================================
// RAW SQL PATTERNS
// ============================================

export const rawQueries = {
  // Full-text search
  searchPosts: async (query: string) => {
    return db.execute(sql`
      SELECT 
        p.id,
        p.title,
        p.excerpt,
        p.slug,
        ts_rank(
          to_tsvector('turkish', p.title || ' ' || p.content),
          plainto_tsquery('turkish', ${query})
        ) as rank
      FROM ${posts} p
      WHERE p.status = 'published'
        AND p.deleted_at IS NULL
        AND to_tsvector('turkish', p.title || ' ' || p.content) 
            @@ plainto_tsquery('turkish', ${query})
      ORDER BY rank DESC
      LIMIT 20
    `);
  },

  // Analytics query
  getPostStats: async (postId: string) => {
    return db.execute(sql`
      SELECT 
        p.id,
        p.title,
        p.view_count,
        COUNT(DISTINCT c.id) as comment_count,
        COUNT(DISTINCT c.author_id) as unique_commenters
      FROM ${posts} p
      LEFT JOIN ${comments} c ON p.id = c.post_id AND c.deleted_at IS NULL
      WHERE p.id = ${postId}
      GROUP BY p.id, p.title, p.view_count
    `);
  },

  // Aggregation with window functions
  getAuthorLeaderboard: async (limit = 10) => {
    return db.execute(sql`
      SELECT 
        u.id,
        u.name,
        u.avatar,
        COUNT(p.id) as post_count,
        SUM(p.view_count) as total_views,
        RANK() OVER (ORDER BY SUM(p.view_count) DESC) as rank
      FROM ${users} u
      LEFT JOIN ${posts} p ON u.id = p.author_id 
        AND p.status = 'published'
        AND p.deleted_at IS NULL
      WHERE u.deleted_at IS NULL
      GROUP BY u.id, u.name, u.avatar
      HAVING COUNT(p.id) > 0
      ORDER BY total_views DESC
      LIMIT ${limit}
    `);
  },

  // Bulk operations
  bulkUpdateStatus: async (postIds: string[], status: string) => {
    return db
      .update(posts)
      .set({ status, updatedAt: new Date() })
      .where(inArray(posts.id, postIds));
  },

  // Date range query
  getPostsByDateRange: async (startDate: Date, endDate: Date) => {
    return db.query.posts.findMany({
      where: and(
        gte(posts.publishedAt, startDate),
        lte(posts.publishedAt, endDate),
        eq(posts.status, 'published')
      ),
      orderBy: [desc(posts.publishedAt)],
    });
  },
};

// ============================================
// PREPARED STATEMENTS
// ============================================

export const preparedQueries = {
  getUserById: db.query.users
    .findFirst({
      where: eq(users.id, sql.placeholder('id')),
    })
    .prepare('get_user_by_id'),

  getPostsByAuthor: db.query.posts
    .findMany({
      where: eq(posts.authorId, sql.placeholder('authorId')),
      orderBy: [desc(posts.createdAt)],
      limit: sql.placeholder('limit'),
    })
    .prepare('get_posts_by_author'),
};

// Usage: await preparedQueries.getUserById.execute({ id: 'user-123' });
