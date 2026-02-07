import {
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/EmailLayout";

interface PasswordResetProps {
  resetLink?: string;
}

const baseUrl = "https://renkflow.com";

export const PasswordReset = ({
  resetLink = "https://renkflow.com/auth/reset-password?token=example",
}: PasswordResetProps) => {
  return (
    <EmailLayout preview="Şifrenizi mi Unuttunuz?">
      <Text className="text-[42px] font-bold font-sans text-left leading-tight my-0">
        Şifrenizi mi Unuttunuz?
      </Text>
      
      <Text className="text-[33px] font-normal font-sans text-left leading-tight mt-[40px] mb-[10px]">
        Şifrenizi sıfırlamak için bir talep aldık, yeni şifre oluşturmak için aşağıdaki butona tıklayın.
      </Text>

      {/* Action Button */}
      <Section className="my-[40px]">
        <Link href={resetLink}>
          <Img
            src={`${baseUrl}/email-assets/reset-button.png`}
            width="221"
            height="60"
            alt="Şifremi Sıfırla"
            className="block"
          />
        </Link>
      </Section>
      
      <Text className="text-[16px] text-center mt-[40px]">
        Eğer buton çalışmazsa aşağıdaki linke tıklayabilirsiniz.<br/>
        <Link href={resetLink} className="text-blue-600 underline">
          {resetLink}
        </Link>
      </Text>
    </EmailLayout>
  );
};

export default PasswordReset;
