import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Link,
  Hr,
  Font,
} from '@react-email/components';

interface EmailLayoutProps {
  preview?: string;
  children: React.ReactNode;
}

export const EmailLayout = ({ preview, children }: EmailLayoutProps) => {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Roboto"
          fallbackFontFamily="Verdana"
          webFont={{
            url: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      {preview && <Preview>{preview}</Preview>}
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
             <Img
                src={`https://documents.yourdomain.com/public/logo-full.png`}
                width="170" // Adjusted width for the full logo (approx 3.5:1 ratio)
                height="48"
                alt="Renkflow"
                style={logo}
              />
          </Section>

          {children}

          <Hr style={hr} />

          <Text style={footer}>
            © {new Date().getFullYear()} Renkflow. Tüm hakları saklıdır.
          </Text>
          
          <Section style={socialContainer}>
            <Link href="https://renkflow.com" style={footerLink}>Web Sitemiz</Link>
            <span style={{ margin: '0 8px', color: '#cbd5e1' }}>•</span>
            <Link href="https://twitter.com/renkflow" style={footerLink}>Twitter</Link>
            <span style={{ margin: '0 8px', color: '#cbd5e1' }}>•</span>
            <Link href="https://linkedin.com/company/renkflow" style={footerLink}>LinkedIn</Link>
          </Section>

          <Text style={unsubText}>
            Bu e-postayı almak istemiyorsanız <Link href="#" style={link}>abonelikten ayrılabilirsiniz</Link>.
          </Text>

        </Container>
      </Body>
    </Html>
  );
};

// Shared Styles
const main = {
  backgroundColor: '#f8fafc',
  fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '40px auto',
  padding: '40px 0',
  borderRadius: '16px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
  maxWidth: '600px',
  border: '1px solid #e2e8f0',
};

const logoContainer = {
  marginBottom: '32px',
  textAlign: 'center' as const,
};

const logo = {
  margin: '0 auto',
  display: 'block',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '40px 0 24px',
  borderWidth: '1px',
};

const footer = {
  color: '#94a3b8',
  fontSize: '13px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  marginBottom: '12px',
};

const socialContainer = {
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const footerLink = {
  fontSize: '13px',
  color: '#64748b',
  textDecoration: 'none',
  fontWeight: '500',
};

const unsubText = {
  fontSize: '12px',
  color: '#cbd5e1',
  textAlign: 'center' as const,
  padding: '0 40px',
};

const link = {
  color: '#94a3b8',
  textDecoration: 'underline',
};
