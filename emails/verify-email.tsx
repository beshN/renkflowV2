import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface VerifyEmailProps {
  userName?: string;
  verificationUrl: string;
}

export default function VerifyEmail({ 
  userName = 'Kullanıcı',
  verificationUrl 
}: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Renkflow hesabınızı doğrulayın</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Img
            src="https://yourdomain.com/logo.png"
            width="150"
            height="40"
            alt="Renkflow"
            style={logo}
          />

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

          <Text style={footer}>
            Bu e-postayı siz talep etmediyseniz, güvenle silebilirsiniz.
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
};

const logo = {
  margin: '0 auto',
  marginBottom: '32px',
};

const heading = {
  fontSize: '32px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#484848',
  padding: '0 48px',
};

const text = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#484848',
  padding: '0 48px',
};

const buttonContainer = {
  padding: '27px 0 27px',
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
  display: 'block',
  padding: '12px 24px',
};

const link = {
  fontSize: '14px',
  color: '#6366f1',
  padding: '0 48px',
  wordBreak: 'break-all' as const,
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  padding: '0 48px',
  marginTop: '16px',
};
