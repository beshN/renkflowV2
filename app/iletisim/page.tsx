import { Phone, Mail, MapPin, Clock, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">İletişim</h1>
          <p className="text-xl text-blue-100 max-w-3xl text-pretty">
            Sorularınız ve projeleriniz için bizimle iletişime geçin
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {/* Contact Info Cards */}
          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100">
            <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Phone className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Telefon</h3>
            <a href="tel:+902164210000" className="text-blue-600 hover:text-blue-700 font-medium block mb-2">
              +90 (216) 421 00 00
            </a>
            <a href="tel:+905321234567" className="text-blue-600 hover:text-blue-700 font-medium block">
              +90 (532) 123 45 67
            </a>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100">
            <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Mail className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">E-posta</h3>
            <a
              href="mailto:info@renkaluminyum.com"
              className="text-blue-600 hover:text-blue-700 font-medium block mb-2"
            >
              info@renkaluminyum.com
            </a>
            <a href="mailto:satis@renkaluminyum.com" className="text-blue-600 hover:text-blue-700 font-medium block">
              satis@renkaluminyum.com
            </a>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100">
            <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <Clock className="w-7 h-7 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Çalışma Saatleri</h3>
            <p className="text-slate-700 mb-2">Pazartesi - Cuma</p>
            <p className="text-slate-600 mb-3">09:00 - 18:30</p>
            <p className="text-slate-700 mb-2">Cumartesi</p>
            <p className="text-slate-600">09:00 - 13:00</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl border border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Bize Ulaşın</h2>
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Ad Soyad</label>
                  <Input placeholder="Adınız ve soyadınız" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Telefon</label>
                  <Input type="tel" placeholder="0532 123 45 67" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">E-posta</label>
                <Input type="email" placeholder="ornek@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Konu</label>
                <Input placeholder="Mesajınızın konusu" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mesajınız</label>
                <Textarea placeholder="Mesajınızı buraya yazın..." rows={6} className="resize-none" />
              </div>
              <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
                <Send className="w-4 h-4 mr-2" />
                Gönder
              </Button>
            </form>
          </div>

          {/* Address & Map */}
          <div>
            <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl border border-slate-100 mb-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Adres</h3>
                  <p className="text-slate-700 leading-relaxed">
                    Güngören Merkez Mahallesi
                    <br />
                    Mehmet Nesih Özmen Caddesi No: 24
                    <br />
                    Güngören / İstanbul
                    <br />
                    Türkiye
                  </p>
                </div>
              </div>
            </div>

            {/* Map Placeholder */}
            <div className="bg-slate-200 rounded-2xl h-80 flex items-center justify-center shadow-xl overflow-hidden">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3011.2573273145845!2d28.87!3d41.02!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDHCsDAxJzEyLjAiTiAyOMKwNTInMTIuMCJF!5e0!3m2!1str!2str!4v1234567890"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
