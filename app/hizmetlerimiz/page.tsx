import { Wrench, Home, Shield, Sparkles, Wind, Sun } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function ServicesPage() {
  const services = [
    {
      icon: Sun,
      title: "Otomatik Tente Sistemleri",
      description: "Modern ve fonksiyonel otomatik tente sistemleri ile dış mekanlarınızı konforlu hale getirin.",
      features: ["Uzaktan kumanda", "Rüzgar sensörü", "Dayanıklı kumaş", "Özel ölçü"],
      image: "/automatic-garage-door.jpg",
    },
    {
      icon: Home,
      title: "Pergola Tente",
      description: "Estetik ve şık pergola tente sistemleri ile bahçe ve teraslarınızı gölgeleyin.",
      features: ["Alüminyum konstrüksiyon", "Su geçirmez", "LED aydınlatma", "Yan perde seçeneği"],
      image: "/balcony-railing-black-steel.jpg",
    },
    {
      icon: Wind,
      title: "Cam Balkon Sistemleri",
      description: "Isı yalıtımlı cam balkon sistemleri ile mekanlarınızı genişletin.",
      features: ["Sürme sistem", "Isı yalıtımı", "Ses yalıtımı", "Kolay temizlik"],
      image: "/balcony-railing-installation.jpg",
    },
    {
      icon: Shield,
      title: "Alüminyum Doğrama",
      description: "Yüksek kaliteli alüminyum kapı ve pencere sistemleri.",
      features: ["Termal kesim", "Hava geçirmez", "Uzun ömürlü", "Çeşitli renk seçenekleri"],
      image: "/metal-door-manufacturing.jpg",
    },
    {
      icon: Wrench,
      title: "Özel Projeler",
      description: "İhtiyaçlarınıza özel tasarım ve üretim hizmetleri.",
      features: ["Özel tasarım", "Teknik destek", "Profesyonel montaj", "Garanti"],
      image: "/wooden-stair-railing.jpg",
    },
    {
      icon: Sparkles,
      title: "Bakım ve Onarım",
      description: "Tüm ürünlerimiz için profesyonel bakım ve onarım hizmetleri.",
      features: ["Periyodik bakım", "Hızlı servis", "Orijinal yedek parça", "Uzman ekip"],
      image: "/balcony-railing-installation.jpg",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">Hizmetlerimiz</h1>
          <p className="text-xl text-blue-100 max-w-3xl text-pretty">
            Alüminyum sektöründe geniş ürün yelpazesi ve profesyonel hizmet anlayışı
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid gap-12">
          {services.map((service, index) => (
            <div
              key={index}
              className={`grid md:grid-cols-2 gap-8 items-center ${index % 2 === 1 ? "md:flex-row-reverse" : ""}`}
            >
              <div className={index % 2 === 1 ? "md:order-2" : ""}>
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <service.icon className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">{service.title}</h2>
                <p className="text-lg text-slate-600 mb-6 leading-relaxed">{service.description}</p>
                <ul className="space-y-3 mb-8">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-slate-700">
                      <div className="w-2 h-2 bg-blue-600 rounded-full" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/iletisim">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                    Teklif Al
                  </Button>
                </Link>
              </div>
              <div
                className={`relative h-80 rounded-2xl overflow-hidden shadow-xl ${index % 2 === 1 ? "md:order-1" : ""}`}
              >
                <Image src={service.image || "/placeholder.svg"} alt={service.title} fill className="object-cover" />
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-20 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Projeniz İçin Özel Çözümler</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            İhtiyaçlarınıza özel tasarım ve üretim hizmetleri için bizimle iletişime geçin
          </p>
          <Link href="/iletisim">
            <Button size="lg" variant="secondary" className="bg-white text-blue-600 hover:bg-blue-50">
              İletişime Geç
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
