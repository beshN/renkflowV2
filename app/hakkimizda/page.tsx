import { Building2, Users, Award, Target } from "lucide-react"
import Image from "next/image"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">Hakkımızda</h1>
          <p className="text-xl text-blue-100 max-w-3xl text-pretty">
            Alüminyum sektöründe teknoloji odaklı üretim anlayışı ile kaliteli çözümler sunuyoruz
          </p>
        </div>
      </div>

      {/* Company Info */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Renk Alüminyum</h2>
            <div className="space-y-4 text-slate-700 leading-relaxed">
              <p>
                İstanbul merkezli olarak faaliyet gösteren Renk Alüminyum, teknoloji odaklı üretim modeliyle alüminyum
                sektöründe öncü firmalardan biridir. Modern tesislerimizde, otomatik tente sistemleri, pergola tenteler,
                ısı yalıtımlı veranda sistemleri ve alüminyum doğrama ürünleri üretmekteyiz.
              </p>
              <p>
                Müşteri memnuniyetini ön planda tutan anlayışımız, kaliteli üretim süreçlerimiz ve deneyimli ekibimizle
                sektörde güvenilir bir marka haline geldik. Her projede mükemmeliyeti hedefliyor, estetik ve
                fonksiyonelliği bir araya getiren çözümler sunuyoruz.
              </p>
              <p>
                Sürekli gelişen teknolojiye ayak uydurarak, yenilikçi ürünler geliştiriyor ve müşterilerimize en iyi
                hizmeti sunmak için çalışıyoruz.
              </p>
            </div>
          </div>
          <div className="relative h-96 rounded-2xl overflow-hidden shadow-2xl">
            <Image src="/metal-door-manufacturing.jpg" alt="Renk Alüminyum Fabrika" fill className="object-cover" />
          </div>
        </div>

        {/* Values */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Building2 className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Modern Tesis</h3>
            <p className="text-slate-600 leading-relaxed">
              Son teknoloji ekipmanlarla donatılmış üretim tesisimizde kaliteli üretim yapıyoruz.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Uzman Kadro</h3>
            <p className="text-slate-600 leading-relaxed">
              Alanında deneyimli ve sürekli gelişen profesyonel ekibimizle hizmet veriyoruz.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <Award className="w-7 h-7 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Kalite Garantisi</h3>
            <p className="text-slate-600 leading-relaxed">
              Tüm ürünlerimizde yüksek kalite standartlarını uygulayarak garanti sunuyoruz.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Target className="w-7 h-7 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Müşteri Odaklı</h3>
            <p className="text-slate-600 leading-relaxed">
              Müşteri memnuniyetini önceliğimiz olarak görüyor, özel çözümler üretiyoruz.
            </p>
          </div>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-10 rounded-2xl">
            <h3 className="text-2xl font-bold text-blue-900 mb-4">Misyonumuz</h3>
            <p className="text-blue-800 leading-relaxed">
              Alüminyum sektöründe teknoloji ve kaliteyi bir araya getirerek, müşterilerimize estetik ve fonksiyonel
              çözümler sunmak. Sürdürülebilir üretim anlayışıyla çevreye duyarlı, uzun ömürlü ürünler geliştirmek.
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-10 rounded-2xl">
            <h3 className="text-2xl font-bold text-orange-900 mb-4">Vizyonumuz</h3>
            <p className="text-orange-800 leading-relaxed">
              Türkiye'nin önde gelen alüminyum üreticilerinden biri olarak, uluslararası pazarda tanınan, yenilikçi
              çözümleriyle sektöre yön veren bir marka olmak. Sürekli gelişim ve müşteri memnuniyeti odaklı
              yaklaşımımızla lider konumumuzu güçlendirmek.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
