import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Button,
} from '@react-email/components';
import * as React from 'react';

interface VerifyEmailCustomProps {
  userName?: string;
  verificationUrl: string;
}

// Always use production URL for email images (they need to be publicly accessible)
const emailAssetsUrl = 'https://renkflow.com';

export default function VerifyEmailCustom({ 
  userName = 'Kullanıcı', 
  verificationUrl = 'https://renkflow.com/auth/verify?token=example' 
}: VerifyEmailCustomProps) {
  return (
    <Html>
      <Head>
        <title>RenkFlow Hesabınızı Doğrulayın</title>
        <style>{`
          @media only screen and (max-width: 600px) {
            .mobile-hide { display: none !important; }
            .mobile-center { text-align: center !important; }
          }
        `}</style>
      </Head>
      <Body style={main}>
        <Container style={container}>
          {/* Header / Logo */}
          <Section style={logoSection}>
            <Img
              src={`${emailAssetsUrl}/email-assets/logo-full.png`} // User needs to ensure this exists or update path
              width="222"
              height="44"
              alt="RenkFlow"
              style={logo}
            />
          </Section>

          <Section style={spacing} />

          {/* Gradient Divider */}
          <Section>
             <div style={gradientDivider} />
          </Section>

          <Section style={spacing} />

          {/* Main Content */}
          <Section style={contentSection}>
            <Heading style={mainHeading}>RenkFlow’a Hoşgeldiniz.</Heading>
            <Text style={subHeading}>
              Hesabınızı doğrulamak için alttaki butona tıklayın.
            </Text>
          </Section>

          <Section style={spacing} />

          {/* Button */}
          <Section style={{ textAlign: 'center' }}>
            <Button
              style={buttonStyle}
              href={verificationUrl}
            >
              Hesabımı Doğrula
            </Button>
          </Section>

          <Section style={spacing} />

          {/* Fallback Link Text */}
          <Section style={textCenter}>
            <Text style={fallbackText}>
              Eğer buton çalışmazsa aşağıdaki linke tıklayabilirsiniz.
            </Text>
            <Link href={verificationUrl} style={link}>
              {verificationUrl}
            </Link>
          </Section>

          <Section style={spacing} />

          {/* Footer Image/Content */}
          <Section style={centerSection}>
             <Img
              src={`${emailAssetsUrl}/email-assets/footer-graphic.png`} // Placeholder for the footer image user had
              width="560"
              height="129"
              alt="Footer Graphic"
              style={fluidImg}
            />
          </Section>

          {/* Divider */}
          <Section>
             <div style={gradientDivider} />
          </Section>
          
          {/* Footer Copyright */}
           <Section style={footer}>
            <Text style={footerText}>
              © 2026 RenkFlow tüm hakları saklıdır.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// Styles based on the user's HTML and general best practices
const main = {
  backgroundColor: '#f0f1f5',
  fontFamily: 'Arial, Helvetica, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0',
  maxWidth: '600px',
  backgroundColor: '#f6f5f1',
};

const logoSection = {
  padding: '20px',
  textAlign: 'center' as const,
};

const logo = {
  display: 'block',
  margin: '0 auto',
};

const spacing = {
  height: '16px',
};

const gradientDivider = {
  height: '2px',
  background: 'linear-gradient(45deg, #1a1054, #255ff1)',
  borderRadius: '999px',
  width: '100%',
  maxWidth: '560px',
  margin: '0 auto',
};

const contentSection = {
  padding: '0 20px',
  textAlign: 'center' as const,
};

const mainHeading = {
  fontSize: '42px',
  fontWeight: 'normal',
  fontFamily: 'Georgia, serif',
  marginBottom: '10px',
  color: '#000',
};

const subHeading = {
  fontSize: '24px',
  fontFamily: 'Georgia, serif',
  color: '#000',
};

const buttonStyle = {
  backgroundColor: '#8c5e40',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '18px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 36px',
  fontFamily: 'Arial, sans-serif',
};

const textCenter = {
  textAlign: 'center' as const,
  padding: '0 20px',
};

const fallbackText = {
  fontSize: '16px',
  color: '#000',
  marginBottom: '10px',
};

const link = {
  fontSize: '14px',
  color: '#8c5e40',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
};

const centerSection = {
  textAlign: 'center' as const,
  padding: '0 20px',
};

const fluidImg = {
  maxWidth: '100%',
  height: 'auto',
  margin: '0 auto',
  display: 'block',
};

const footer = {
  textAlign: 'center' as const,
  padding: '20px',
  backgroundColor: '#f6f5f1',
};

const footerText = {
  fontSize: '13px',
  color: '#737373',
};
