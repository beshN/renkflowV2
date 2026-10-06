import { MarketingShell } from '@/components/app-core/MarketingShell';

export default function CareersPage() {
  return (
    <MarketingShell
      badge="Kariyer"
      title="Şu anda açık pozisyonumuz yok."
      description="RenkFlow, Renk Alüminyum bünyesinde küçük bir ekiple geliştiriliyor. Üretim yazılımına ilgi duyuyorsanız yine de tanışmak isteriz."
      actions={[
        { href: 'mailto:info@renkflow.com?subject=Kariyer', label: 'Bize yazın' },
        { href: '/about', label: 'Hakkımızda', variant: 'secondary' },
      ]}
      hideClosing
    />
  );
}
