import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

const roleNames = {
  admin: "Yönetici",
  office: "Ofis",
  production: "Üretim",
} as const;

export default function InviteEmail({
  organizationName,
  acceptUrl,
  role,
}: {
  organizationName: string;
  acceptUrl: string;
  role: keyof typeof roleNames;
}) {
  return (
    <Html lang="tr">
      <Head />
      <Preview>{organizationName} ekibine davet edildiniz</Preview>
      <Body style={{ margin: 0, background: "#f5f3ed", fontFamily: "Arial, sans-serif", color: "#17261f" }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", padding: 36, background: "#fff", borderRadius: 18 }}>
          <Text style={{ color: "#157347", fontSize: 12, fontWeight: 700 }}>RENKFLOW EKİP DAVETİ</Text>
          <Heading style={{ fontSize: 30, lineHeight: 1.15 }}>{organizationName} ekibine katılın.</Heading>
          <Text style={{ color: "#65746d", lineHeight: 1.65 }}>
            {roleNames[role]} rolüyle sipariş ve üretim çalışma alanına davet edildiniz.
            Bu bağlantı 7 gün boyunca geçerlidir.
          </Text>
          <Button href={acceptUrl} style={{ marginTop: 18, padding: "13px 20px", color: "#fff", background: "#0f4f34", borderRadius: 10 }}>
            Daveti kabul et
          </Button>
          <Text style={{ marginTop: 28, color: "#87928c", fontSize: 12 }}>
            Bu daveti beklemiyorsanız e-postayı yok sayabilirsiniz.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
