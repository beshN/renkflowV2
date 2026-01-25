import {
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/EmailLayout";

const baseUrl = "https://renkflow.com";

export const WaitlistConfirmationEmail = () => {
  return (
    <EmailLayout preview="RenkFlow'a Hoşgeldiniz">
      <Text className="text-[41px] font-bold font-sans text-left leading-tight my-0">
        RenkFlow’a Hoşgeldiniz.
      </Text>
      
      <Text className="text-[21px] font-normal font-sans text-left leading-tight mt-[40px] mb-[40px]">
        RenkFlow bekleme listesine katıldığınız için teşekkür ederiz. Üretim yönetiminin geleceğini inşa ederken sizi aramızda görmekten büyük mutluluk duyuyoruz.
      </Text>

      {/* Bordered Box */}
      <Section className="border-[2px] border-solid border-[#dbdbdb] p-[12px] my-[26px]">
        <Text className="text-[18px] font-bold text-[#334155] font-sans text-center m-0">
          Platformumuz hazır olduğunda ilk sizin haberiniz olacak.
        </Text>
      </Section>
      
      <Text className="text-[17px] font-sans text-justify leading-normal mt-[30px]">
        Bu süreçte, işletmenizin verimliliğini artıracak araçlar üzerinde titizlikle çalışıyoruz. Erken erişim avantajlarından faydalanmanız için size özel duyurularımız olacak.
      </Text>

      <Text className="text-[17px] font-sans text-justify leading-normal mt-[20px]">
        Sorularınız veya önerileriniz olursa, bu e-postaya yanıt vererek doğrudan ekibimize ulaşabilirsiniz.
      </Text>

      <Text className="text-[17px] font-sans text-justify leading-normal mt-[20px]">
        Sevgiler,<br/>
        RenkFlow Ekibi
      </Text>
    </EmailLayout>
  );
};

export default WaitlistConfirmationEmail;
