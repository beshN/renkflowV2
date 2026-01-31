import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Tailwind,
  Font,
} from "@react-email/components";
import * as React from "react";

interface EmailLayoutProps {
  preview?: string;
  children: React.ReactNode;
}

const baseUrl = "https://renkflow.com";

export const EmailLayout = ({ preview, children }: EmailLayoutProps) => {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Roboto"
          fallbackFontFamily="Verdana"
          webFont={{
            url: "https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxK.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview || ""}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                background: "#f0f1f5",
                container: "#f6f5f1",
                text: "#000000",
                subtle: "#737373",
              },
            },
          },
        }}
      >
        <Body className="bg-background my-auto mx-auto font-sans">
          <Container className="bg-container border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[600px]">
            {/* Header Logo */}
            <Section className="mt-[10px] mb-[20px]">
              <Img
                src={`${baseUrl}/email-assets/header-logo.png`}
                width="222"
                height="44"
                alt="RenkFlow"
                className="my-0 mx-auto"
              />
            </Section>

            {/* Gradient Line */}
            <Section className="my-[16px] mx-auto max-w-[560px]">
               <div style={{
                 height: '2px',
                 background: 'linear-gradient(45deg, #1a1054, #255ff1)',
                 borderRadius: '999px',
                 lineHeight: '2px',
                 fontSize: '0'
               }}>&nbsp;</div>
            </Section>

            {/* Content */}
            <Section className="px-[20px]">
              {children}
            </Section>
            
            <Section className="h-[16px]">&nbsp;</Section>

            {/* Footer Brand Image */}
            <Section className="mx-auto max-w-[560px]">
               <Img
                src={`${baseUrl}/email-assets/footer-brand.png`}
                width="560"
                height="129"
                alt="RenkFlow Footer"
                className="w-full max-w-full block"
              />
            </Section>

            {/* Copyright */}
            <Section className="text-center mt-[17px]">
              <Text className="text-[13px] leading-[1.1] text-subtle text-center">
                © 2026 RenkFlow tüm hakları saklıdır.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EmailLayout;
