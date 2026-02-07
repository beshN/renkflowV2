// ============================================
// TYPE-SAFE ENVIRONMENT VARIABLES
// Runtime validation with Zod
// ============================================

import { z } from 'zod';

// ============================================
// SCHEMA DEFINITIONS
// ============================================

const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  
  // Auth
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  
  // API
  API_URL: z.string().url().default('http://localhost:3000/api'),
  
  // WebSocket
  WS_URL: z.string().default('ws://localhost:3001'),
  
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Optional services
  REDIS_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  
  // Analytics
  ANALYTICS_ID: z.string().optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000/api'),
  NEXT_PUBLIC_WS_URL: z.string().default('ws://localhost:3001'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

// ============================================
// VALIDATION & PARSING
// ============================================

function validateEnv<T extends z.ZodType>(
  schema: T,
  env: Record<string, string | undefined>,
  prefix: string
): z.infer<T> {
  const result = schema.safeParse(env);
  
  if (!result.success) {
    const errors = result.error.issues.map(issue => {
      const path = issue.path.join('.');
      return `  - ${path}: ${issue.message}`;
    }).join('\n');
    
    throw new Error(
      `❌ Invalid ${prefix} environment variables:\n${errors}\n\n` +
      `Please check your .env file and ensure all required variables are set.`
    );
  }
  
  return result.data;
}

// ============================================
// SERVER ENVIRONMENT
// ============================================

let serverEnvCache: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv cannot be called on the client');
  }
  
  if (serverEnvCache) return serverEnvCache;
  
  serverEnvCache = validateEnv(serverEnvSchema, process.env, 'server');
  return serverEnvCache;
}

// ============================================
// CLIENT ENVIRONMENT
// ============================================

let clientEnvCache: ClientEnv | null = null;

export function getClientEnv(): ClientEnv {
  if (clientEnvCache) return clientEnvCache;
  
  // Only include NEXT_PUBLIC_ variables
  const clientEnv: Record<string, string | undefined> = {};
  
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('NEXT_PUBLIC_')) {
      clientEnv[key] = process.env[key];
    }
  });
  
  clientEnvCache = validateEnv(clientEnvSchema, clientEnv, 'client');
  return clientEnvCache;
}

// ============================================
// CONVENIENCE ACCESSORS
// ============================================

export const env = {
  get server() {
    return getServerEnv();
  },
  get client() {
    return getClientEnv();
  },
  get isDev() {
    return process.env.NODE_ENV === 'development';
  },
  get isProd() {
    return process.env.NODE_ENV === 'production';
  },
  get isTest() {
    return process.env.NODE_ENV === 'test';
  },
};

// ============================================
// ENV FILE TEMPLATE GENERATOR
// ============================================

export function generateEnvTemplate(): string {
  const serverKeys = serverEnvSchema.shape;
  const clientKeys = clientEnvSchema.shape;
  
  let template = '# Server Environment Variables\n';
  template += '# These are only available on the server\n\n';
  
  Object.entries(serverKeys).forEach(([key, schema]) => {
    const zodSchema = schema as z.ZodTypeAny;
    const isOptional = zodSchema.isOptional();
    const defaultValue = zodSchema._def.defaultValue?.();
    
    template += `${key}=${defaultValue ?? (isOptional ? '' : 'your-value-here')}\n`;
  });
  
  template += '\n# Client Environment Variables\n';
  template += '# These are exposed to the browser (prefix with NEXT_PUBLIC_)\n\n';
  
  Object.entries(clientKeys).forEach(([key, schema]) => {
    const zodSchema = schema as z.ZodTypeAny;
    const defaultValue = zodSchema._def.defaultValue?.();
    
    template += `${key}=${defaultValue ?? ''}\n`;
  });
  
  return template;
}
