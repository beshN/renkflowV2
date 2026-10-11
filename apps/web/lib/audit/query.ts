import { z } from 'zod';

/** Who may read the firm's audit trail (the proxy also checks the role's audit cell). */
export const AUDIT_ROLES = ['owner', 'admin'];

export const QuerySchema = z.object({
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().trim().max(80).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});
