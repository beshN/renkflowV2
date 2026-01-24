import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface PasswordResetEmailProps {
  userName?: string;
  resetUrl: string;
}

export default function PasswordResetEmail({ 
  userName = 'Kullanıcı',
  resetUrl 
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Renkflow şifre sıfırlama talebi</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Text style={logo}>Renkflow</Text>
          </Section>

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

          <Text style={footer}>
            Bu talebi siz yapmadıysanız, bu e-postayı güvenle silebilirsiniz. Hesabınız güvende.
          </Text>

          <Text style={footer}>
            © {new Date().getFullYear()} Renkflow. Tüm hakları saklıdır.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  borderRadius: '8px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
};

const headerSection = {
  padding: '24px 48px',
  borderBottom: '1px solid #e6e6e6',
};

const logo = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#6366f1',
  margin: '0',
};

const heading = {
  fontSize: '28px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#484848',
  padding: '32px 48px 0',
  margin: '0',
};

const text = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#484848',
  padding: '0 48px',
  margin: '16px 0',
};

const buttonContainer = {
  padding: '27px 48px',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#6366f1',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
};

const link = {
  fontSize: '14px',
  color: '#6366f1',
  padding: '0 48px',
  wordBreak: 'break-all' as const,
  margin: '8px 0',
};

const warningSection = {
  backgroundColor: '#fff8e6',
  margin: '24px 48px',
  padding: '16px',
  borderRadius: '8px',
  border: '1px solid #f5e6cc',
};

const warningText = {
  fontSize: '14px',
  color: '#8a6914',
  margin: '0',
  padding: '0',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  padding: '0 48px',
  marginTop: '16px',
};
