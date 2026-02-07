import {
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/EmailLayout";

interface InviteUserEmailProps {
  inviteLink?: string;
}

const baseUrl = "https://renkflow.com";

export const InviteUserEmail = ({
  inviteLink = "https://renkflow.com/invite/accept",
}: InviteUserEmailProps) => {
  return (
    <EmailLayout preview="Bir RenkFlow Daveti Aldınız!">
      <Text className="text-[41px] font-bold font-sans text-left leading-tight my-0">
        Bir RenkFlow Daveti Aldınız!
      </Text>
      
      <Text className="text-[26px] font-normal font-sans text-left leading-tight mt-[40px] mb-[40px]">
        Bir RenkFlow projesine davet aldınız, alttaki butona tıklayarak hemen projeyi düzenlemeye başlayabilirsiniz.
      </Text>

      {/* Action Button */}
      <Section className="my-[40px]">
        <Link href={inviteLink}>
          <Img
            src={`${baseUrl}/email-assets/invite-button.png`}
            width="221"
            height="60"
            alt="Daveti Kabul Et"
            className="block"
          />
        </Link>
      </Section>
      
      <Text className="text-[16px] text-center mt-[40px]">
        Eğer buton çalışmazsa aşağıdaki linke tıklayabilirsiniz.<br/>
        <Link href={inviteLink} className="text-blue-600 underline">
          {inviteLink}
        </Link>
      </Text>
    </EmailLayout>
  );
};

export default InviteUserEmail;
