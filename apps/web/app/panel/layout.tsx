import { PanelShell } from "@/components/panel-shell";
import { requireOrganization } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, membership, memberships } = await requireOrganization();
  const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
  const name = organization?.name ?? "RenkFlow";
  const workspaces = memberships.map((item) => {
    const itemOrganization = Array.isArray(item.organizations) ? item.organizations[0] : item.organizations;
    return { id: item.organization_id, name: itemOrganization?.name ?? "Çalışma alanı" };
  });
  return (
    <PanelShell
      organizationId={membership.organization_id}
      organizationName={name}
      workspaces={workspaces}
      userName={user.user_metadata.full_name || user.email || "Kullanıcı"}
      role={membership.role}
    >
      {children}
    </PanelShell>
  );
}
