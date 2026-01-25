import {
  Button,
  Heading,
  Section,
  Text,
  Link,
} from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';

interface PasswordResetEmailProps {
  userName?: string;
  resetUrl: string;
}

export default function PasswordResetEmail({ 
  userName = 'Kullanıcı',
  resetUrl 
}: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Renkflow şifre sıfırlama talebi">
      <Heading style={heading}>Şifre Sıfırlama Talebi</Heading>

      <Text style={text}>
        Merhaba {userName},
      </Text>

      <Text style={text}>
        Hesabınız için bir şifre sıfırlama talebi aldık. Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:
      </Text>

      <Section style={buttonContainer}>
        <Button style={button} href={resetUrl}>
          Şifremi Sıfırla
        </Button>
      </Section>

      <Text style={text}>
        Veya bu linki kopyalayarak tarayıcınıza yapıştırın:
      </Text>
      <Text style={link}>
        <Link href={resetUrl}>{resetUrl}</Link>
      </Text>

      <Section style={warningSection}>
        <Text style={warningText}>
          ⚠️ Bu link 1 saat içinde geçerliliğini yitirecektir.
        </Text>
      </Section>

      <Text style={text}>
        Bu talebi siz yapmadıysanız, bu e-postayı güvenle silebilirsiniz. Hesabınız güvende.
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

const warningSection = {
  backgroundColor: '#fef2f2', // Lighter red/orange for warning
  margin: '24px 40px',
  padding: '16px',
  borderRadius: '12px',
  border: '1px solid #fee2e2',
};

const warningText = {
  fontSize: '14px',
  color: '#991b1b', // Darker red text
  margin: '0',
  padding: '0',
  textAlign: 'center' as const,
};
