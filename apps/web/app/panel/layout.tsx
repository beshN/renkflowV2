import { PanelShell } from "@/components/panel-shell";
import { requireOrganization } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, membership } = await requireOrganization();
  const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
  const name = organization?.name ?? "RenkFlow";
  return (
    <PanelShell organizationName={name} userName={user.user_metadata.full_name || user.email || "Kullanıcı"} role={membership.role}>
      {children}
    </PanelShell>
  );
}
