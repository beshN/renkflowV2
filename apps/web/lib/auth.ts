import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationRole } from "@/lib/types";

export const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect("/giris");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { supabase, user, membership };
});

export async function requireOrganization() {
  const context = await getAuthContext();
  if (!context.membership) redirect("/kurulum");
  return context as typeof context & { membership: NonNullable<typeof context.membership> };
}

export async function requireMembership(
  organizationId: string,
  roles?: OrganizationRole[],
) {
  const { supabase, user } = await getAuthContext();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || (roles && !roles.includes(membership.role as OrganizationRole))) {
    throw new Error("Bu işlem için yetkiniz yok.");
  }

  return { supabase, user, membership };
}
