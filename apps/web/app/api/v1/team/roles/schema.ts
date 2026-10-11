import { z } from 'zod';
import { ASSIGNABLE_ROLES } from '@/lib/security/team-rules';

/** A custom role as sent by the matrix editor; the server trims it to the base role. */
export const RoleBody = z.object({
  name: z.string().trim().min(2).max(60),
  base: z.enum(ASSIGNABLE_ROLES),
  permissions: z.record(z.string(), z.array(z.string()).max(10)),
  hidden: z.array(z.string()).max(10),
}).strict();
