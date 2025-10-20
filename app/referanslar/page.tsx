import { Building2, CheckCircle2 } from "lucide-react"
import Image from "next/image"

export default function ReferencesPage() {
  const references = [
    {
      category: "Konut Projeleri",
      projects: [
        "Ataşehir Lüks Rezidans - 120 Daire Cam Balkon",
        "Kadıköy Modern Yaşam - Pergola Tente Sistemleri",
        "Beşiktaş Premium Konutlar - Alüminyum Doğrama",
        "Sarıyer Villa Projeleri - Özel Tasarım Tenteler",
      ],
    },
    {
      category: "Ticari Projeler",
      projects: [
        "Zorlu Center AVM - Otomatik Tente Sistemleri",
        "İstanbul Havalimanı - Alüminyum Cephe Kaplama",
        "Maslak Ofis Kuleleri - Cam Balkon Sistemleri",
        "Nişantaşı Butik Oteller - Pergola ve Tente",
      ],
    },
    {
      category: "Kamu Projeleri",
      projects: [
        "İstanbul Büyükşehir Belediyesi - Sosyal Tesisler",
        "Milli Eğitim Bakanlığı - Okul Binaları",
        "Sağlık Bakanlığı - Hastane Projeleri",
        "Gençlik ve Spor Bakanlığı - Spor Tesisleri",
      ],
    },
    {
      category: "Özel Sektör",
      projects: [
        "Koç Holding - Fabrika Tesisleri",
        "Sabancı Holding - Ofis Binaları",
        "Eczacıbaşı - Üretim Tesisleri",
        "Doğuş Grubu - Otel Projeleri",
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">Referanslarımız</h1>
          <p className="text-xl text-blue-100 max-w-3xl text-pretty">
            Yıllardır güvenle çalıştığımız kurumlar ve başarıyla tamamladığımız projeler
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">500+</div>
            <div className="text-slate-600">Tamamlanan Proje</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">15+</div>
            <div className="text-slate-600">Yıllık Tecrübe</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 text-center">
            <div className="text-4xl font-bold text-orange-600 mb-2">200+</div>
            <div className="text-slate-600">Kurumsal Müşteri</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">%98</div>
            <div className="text-slate-600">Müşteri Memnuniyeti</div>
          </div>
        </div>

        {/* Reference Categories */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {references.map((ref, index) => (
            <div key={index} className="bg-white p-8 rounded-xl shadow-lg border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{ref.category}</h2>
              </div>
              <ul className="space-y-3">
                {ref.projects.map((project, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{project}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Gallery */}
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Projelerimizden Görüntüler</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              "/metal-door-manufacturing.jpg",
              "/balcony-railing-black-steel.jpg",
              "/balcony-railing-installation.jpg",
              "/wooden-stair-railing.jpg",
              "/automatic-garage-door.jpg",
              "/metal-door-manufacturing.jpg",
            ].map((img, idx) => (
              <div
                key={idx}
                className="relative h-64 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow"
              >
                <Image
                  src={img || "/placeholder.svg"}
                  alt={`Proje ${idx + 1}`}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
