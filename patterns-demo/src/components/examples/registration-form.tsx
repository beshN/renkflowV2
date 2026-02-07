// ============================================
// EXAMPLE: MULTI-STEP REGISTRATION FORM
// Demonstrates Form Validation Pattern
// ============================================

'use client';

import { 
  MultiStepFormProvider, 
  Step, 
  FormField,
} from '@/lib/forms/multi-step-form';
import { registrationSchema } from '@/lib/forms/schemas';
import { useAppStore } from '@/lib/store';

export function RegistrationForm() {
  const addNotification = useAppStore((s) => s.addNotification);

  const handleSubmit = async (data: unknown) => {
    console.log('Form submitted:', data);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    addNotification({
      type: 'success',
      message: 'Kayıt başarıyla tamamlandı!',
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Kayıt Formu</h1>
      
      <MultiStepFormProvider
        schema={registrationSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          country: 'TR',
          language: 'tr',
          theme: 'system',
          newsletter: false,
          notifications: {
            email: true,
            sms: false,
            push: true,
          },
        }}
      >
        {/* Step 1: Personal Info */}
        <Step stepId="personal">
          <div className="grid grid-cols-2 gap-4">
            <FormField name="firstName" label="Ad" placeholder="Adınız" />
            <FormField name="lastName" label="Soyad" placeholder="Soyadınız" />
          </div>
          <FormField 
            name="email" 
            label="E-posta" 
            type="email" 
            placeholder="ornek@email.com" 
          />
          <FormField 
            name="phone" 
            label="Telefon" 
            type="tel" 
            placeholder="0 (5XX) XXX XX XX" 
          />
          <FormField 
            name="birthDate" 
            label="Doğum Tarihi" 
            type="date" 
          />
        </Step>

        {/* Step 2: Address */}
        <Step stepId="address">
          <FormField 
            name="street" 
            label="Adres" 
            type="textarea" 
            placeholder="Mahalle, sokak, bina no..." 
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField 
              name="city" 
              label="Şehir" 
              type="select"
              options={[
                { value: 'istanbul', label: 'İstanbul' },
                { value: 'ankara', label: 'Ankara' },
                { value: 'izmir', label: 'İzmir' },
                { value: 'bursa', label: 'Bursa' },
                { value: 'antalya', label: 'Antalya' },
              ]}
            />
            <FormField 
              name="district" 
              label="İlçe" 
              placeholder="İlçe adı" 
            />
          </div>
          <FormField 
            name="postalCode" 
            label="Posta Kodu" 
            placeholder="34000" 
          />
        </Step>

        {/* Step 3: Account */}
        <Step stepId="account">
          <FormField 
            name="username" 
            label="Kullanıcı Adı" 
            placeholder="kullanici_adi" 
          />
          <FormField 
            name="password" 
            label="Şifre" 
            type="password" 
            placeholder="••••••••" 
          />
          <FormField 
            name="confirmPassword" 
            label="Şifre Tekrar" 
            type="password" 
            placeholder="••••••••" 
          />
          <FormField 
            name="termsAccepted" 
            label="" 
            type="checkbox" 
            placeholder="Kullanım koşullarını okudum ve kabul ediyorum" 
          />
        </Step>

        {/* Step 4: Preferences */}
        <Step stepId="preferences">
          <FormField 
            name="language" 
            label="Dil" 
            type="select"
            options={[
              { value: 'tr', label: 'Türkçe' },
              { value: 'en', label: 'English' },
              { value: 'de', label: 'Deutsch' },
            ]}
          />
          <FormField 
            name="theme" 
            label="Tema" 
            type="select"
            options={[
              { value: 'light', label: 'Açık' },
              { value: 'dark', label: 'Koyu' },
              { value: 'system', label: 'Sistem' },
            ]}
          />
          <FormField 
            name="newsletter" 
            label="" 
            type="checkbox" 
            placeholder="Bülten e-postalarını almak istiyorum" 
          />
          
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-700 mb-3">Bildirimler</p>
            <div className="space-y-2">
              <FormField 
                name="notifications.email" 
                label="" 
                type="checkbox" 
                placeholder="E-posta bildirimleri" 
              />
              <FormField 
                name="notifications.sms" 
                label="" 
                type="checkbox" 
                placeholder="SMS bildirimleri" 
              />
              <FormField 
                name="notifications.push" 
                label="" 
                type="checkbox" 
                placeholder="Push bildirimleri" 
              />
            </div>
          </div>
        </Step>
      </MultiStepFormProvider>
    </div>
  );
}
