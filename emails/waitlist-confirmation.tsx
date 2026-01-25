import {
  Heading,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';

export default function WaitlistConfirmationEmail() {
  return (
    <EmailLayout preview="Renkflow bekleme listesine hoş geldiniz!">
      <Heading style={h1}>Hoş Geldiniz! 👋</Heading>

      <Text style={text}>
        Merhaba,
      </Text>

      <Text style={text}>
        Renkflow bekleme listesine katıldığınız için teşekkür ederiz. Üretim yönetiminin geleceğini inşa ederken sizi aramızda görmekten büyük mutluluk duyuyoruz.
      </Text>

      <Section style={highlightSection}>
        <Text style={highlightText}>
          🚀 Platformumuz hazır olduğunda ilk sizin haberiniz olacak.
        </Text>
      </Section>

      <Text style={text}>
        Bu süreçte, işletmenizin verimliliğini artıracak araçlar üzerinde titizlikle çalışıyoruz. Erken erişim avantajlarından faydalanmanız için size özel duyurularımız olacak.
      </Text>

      <Text style={text}>
        Sorularınız veya önerileriniz olursa, bu e-postaya yanıt vererek doğrudan ekibimize ulaşabilirsiniz.
      </Text>

      <Text style={signOff}>
        Sevgiler,<br />
        Renkflow Ekibi
      </Text>
    </EmailLayout>
  );
}

// Local Content Styles
const h1 = {
  fontSize: '28px',
  lineHeight: '1.2',
  fontWeight: '700',
  color: '#0f172a',
  textAlign: 'center' as const,
  marginBottom: '24px',
  padding: '0 40px',
  letterSpacing: '-0.5px',
};

const text = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#475569',
  padding: '0 40px',
  margin: '16px 0',
};

const highlightSection = {
  backgroundColor: '#f1f5f9',
  borderRadius: '12px',
  padding: '24px',
  margin: '32px 40px',
  textAlign: 'center' as const,
  border: '1px solid #e2e8f0',
};

const highlightText = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#334155',
  margin: '0',
};

const signOff = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#475569',
  padding: '0 40px',
  marginTop: '32px',
  fontWeight: '500',
};

