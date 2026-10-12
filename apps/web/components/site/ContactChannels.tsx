import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { COMPANY, telHref, whatsappHref } from '@/lib/core/company';

type Channel = { icon: typeof Mail; label: string; value: string; href?: string; external?: boolean };

/** Every way to reach the company; channels without a value are left out. */
export function contactChannels(): Channel[] {
  const channels: Channel[] = [{ icon: Mail, label: 'E-posta', value: COMPANY.email, href: `mailto:${COMPANY.email}` }];
  if (COMPANY.phone) channels.push({ icon: Phone, label: 'Telefon', value: COMPANY.phone, href: telHref(COMPANY.phone) });
  if (COMPANY.whatsapp) channels.push({ icon: MessageCircle, label: 'WhatsApp', value: COMPANY.whatsapp, href: whatsappHref(COMPANY.whatsapp), external: true });
  if (COMPANY.address) channels.push({ icon: MapPin, label: 'Adres', value: COMPANY.address });
  if (COMPANY.hours) channels.push({ icon: Clock, label: 'Çalışma saatleri', value: COMPANY.hours });
  return channels;
}

export function ContactChannels() {
  return (
    <div className="mt-16">
      <h2 className="text-[13px] font-medium text-muted-foreground">Bize ulaşın</h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contactChannels().map(({ icon: Icon, label, value, href, external }) => {
          const body = (
            <>
              <Icon size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[13px] text-muted-foreground">{label}</span>
                <span className="mt-1 block break-words text-[15px] font-medium">{value}</span>
              </span>
            </>
          );
          return (
            <li key={label}>
              {href ? (
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="flex h-full gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"
                >
                  {body}
                </a>
              ) : (
                <div className="flex h-full gap-3 rounded-xl border border-border bg-card p-5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
