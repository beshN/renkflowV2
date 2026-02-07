import {
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/EmailLayout";

interface VerifyEmailProps {
  confirmationLink?: string;
}

const baseUrl = "https://renkflow.com";

export const VerifyEmail = ({
  confirmationLink = "https://renkflow.com/auth/verify",
}: VerifyEmailProps) => {
  return (
    <EmailLayout preview="RenkFlow'a Hoşgeldiniz">
      <Text className="text-[42px] font-bold font-sans text-center leading-tight my-0">
        RenkFlow’a Hoşgeldiniz.
      </Text>
      
      <Text className="text-[37px] font-normal font-sans text-center leading-tight mt-[40px] mb-[40px]">
        Hesabınızı doğrulamak için alttaki butona tıklayın.
      </Text>

      {/* Action Button */}
      <Section className="my-[40px] mx-auto text-center">
        <Link href={confirmationLink} className="inline-block">
          <Img
            src={`${baseUrl}/email-assets/verify-button.png`}
            width="262"
            height="88"
            alt="Hesabımı Doğrula"
            className="block mx-auto"
          />
        </Link>
      </Section>
      
      <Text className="text-[16px] text-center mt-[40px]">
        Eğer buton çalışmazsa aşağıdaki linke tıklayabilirsiniz.<br/>
        <Link href={confirmationLink} className="text-blue-600 underline">
          {confirmationLink}
        </Link>
      </Text>
    </EmailLayout>
  );
};

export default VerifyEmail;
