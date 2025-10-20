import { Award, Shield, CheckCircle2, Target } from "lucide-react"

export default function QualityPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">Kalite Politikamız</h1>
          <p className="text-xl text-blue-100 max-w-3xl text-pretty">
            Müşteri memnuniyeti odaklı, sürekli gelişen kalite anlayışımız
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Main Policy */}
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-100 mb-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
              <Award className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Kalite Politikamız</h2>
          </div>
          <p className="text-lg text-slate-700 leading-relaxed mb-6">
            Renk Alüminyum olarak, müşteri memnuniyetini en üst düzeyde tutmak, kaliteli ürün ve hizmet sunmak temel
            prensiplerimizdir. Sektördeki gelişmeleri yakından takip ederek, teknolojik yenilikleri üretim süreçlerimize
            entegre ediyor ve sürekli iyileştirme anlayışıyla çalışıyoruz.
          </p>
          <p className="text-lg text-slate-700 leading-relaxed">
            Tüm çalışanlarımızın kalite bilincini geliştirmek, çevre ve iş güvenliği standartlarına uymak, yasal
            gereklilikleri yerine getirmek ve paydaşlarımızla güven ilişkisi kurmak önceliklerimiz arasındadır.
          </p>
        </div>

        {/* Quality Principles */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-xl">
            <div className="w-14 h-14 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
              <Target className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-blue-900 mb-4">Hedeflerimiz</h3>
            <ul className="space-y-3">
              {[
                "Müşteri memnuniyetini %100 sağlamak",
                "Hatasız üretim süreçleri oluşturmak",
                "Zamanında teslimat garantisi vermek",
                "Sürekli iyileştirme kültürü yaratmak",
                "Çevre dostu üretim yapmak",
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 text-blue-800">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-8 rounded-xl">
            <div className="w-14 h-14 bg-green-600 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-green-900 mb-4">Taahhütlerimiz</h3>
            <ul className="space-y-3">
              {[
                "Uluslararası kalite standartlarına uyum",
                "Düzenli kalite kontrol ve testler",
                "Eğitimli ve sertifikalı personel",
                "Modern üretim teknolojileri kullanımı",
                "Şeffaf ve güvenilir iş süreçleri",
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 text-green-800">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Certificates */}
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-100">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Sertifikalarımız</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-12 h-12 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">ISO 9001</h3>
              <p className="text-slate-600">Kalite Yönetim Sistemi</p>
            </div>
            <div className="text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">ISO 14001</h3>
              <p className="text-slate-600">Çevre Yönetim Sistemi</p>
            </div>
            <div className="text-center">
              <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-12 h-12 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">CE Belgesi</h3>
              <p className="text-slate-600">Avrupa Uygunluk Belgesi</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
