import {
  Button,
  Heading,
  Section,
  Text,
  Link,
} from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';

interface VerifyEmailProps {
  userName?: string;
  verificationUrl: string;
}

export default function VerifyEmail({ 
  userName = 'Kullanıcı',
  verificationUrl 
}: VerifyEmailProps) {
  return (
    <EmailLayout preview="Renkflow hesabınızı doğrulayın">
      <Heading style={heading}>Hoş Geldiniz, {userName}!</Heading>

      <Text style={text}>
        Renkflow hesabınızı oluşturduğunuz için teşekkür ederiz.
        Hesabınızı aktifleştirmek için aşağıdaki butona tıklayın:
      </Text>

      <Section style={buttonContainer}>
        <Button style={button} href={verificationUrl}>
          Hesabımı Doğrula
        </Button>
      </Section>

      <Text style={text}>
        Veya bu linki kopyalayarak tarayıcınıza yapıştırın:
      </Text>
      <Text style={link}>
        <Link href={verificationUrl}>{verificationUrl}</Link>
      </Text>

      <Text style={text}>
        Bu e-postayı siz talep etmediyseniz, güvenle silebilirsiniz.
      </Text>
    </EmailLayout>
  );
}

// Local Content Styles
const heading = {
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

const buttonContainer = {
  padding: '24px 0 24px',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#4361ee', // RenkFlow Primary Blue
  borderRadius: '12px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
  boxShadow: '0 4px 12px rgba(67, 97, 238, 0.3)',
};

const link = {
  fontSize: '14px',
  color: '#4361ee',
  padding: '0 40px',
  wordBreak: 'break-all' as const,
  textDecoration: 'underline',
};
