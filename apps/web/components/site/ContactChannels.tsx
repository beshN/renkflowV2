import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { COMPANY, telHref, whatsappHref } from '@/lib/core/company';
import { CopyButton } from '@/components/site/v2/blocks';

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

/** Every channel as a row: the value is the link, and e-mail and phone copy in one click. */
export function ContactChannels() {
  return (
    <div className="mt-20">
      <h2 className="x-display text-[clamp(24px,2.6vw,32px)] leading-tight">Bize ulaşın</h2>
      <ul className="mt-6 border-t border-[var(--x-line)]">
        {contactChannels().map(({ icon: Icon, label, value, href, external }) => (
          <li key={label} className="group relative grid items-center gap-2 border-b border-[var(--x-line)] py-5 sm:grid-cols-[220px_1fr_auto] sm:gap-8">
            <span className="flex items-center gap-2.5 text-[14px] text-[var(--x-muted)]"><Icon size={16} aria-hidden />{label}</span>
            {href ? (
              <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="x-link w-fit break-words text-[17px] font-medium">{value}</a>
            ) : (
              <span className="break-words text-[17px] font-medium">{value}</span>
            )}
            {(label === 'E-posta' || label === 'Telefon') && <CopyButton value={value} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
