'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const FullLandingContent: React.FC = () => {
  return (
    <>
      <main className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="text-center md:text-left relative z-10">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white leading-tight">
                Zirveye Ulaşın: İş Akışınızı <span className="text-blue-600">Renkflow</span> ile Dönüştürün.
              </h1>
              <p className="mt-6 text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-xl mx-auto md:mx-0">
                Ekibinizin en iyi işlerini, baştan sona güçlendiren görsel iş birliği aracı. Karmaşayı netliğe, fikirleri gerçeğe dönüştürün.
              </p>
              <div className="mt-10 flex items-center justify-center md:justify-start space-x-4">
                <a className="bg-blue-600 text-white font-bold py-4 px-10 rounded-full transition-transform hover:scale-105 shadow-[0_0_40px_0px_rgba(67,97,238,0.3)] hover:shadow-[0_0_50px_0px_rgba(67,97,238,0.4)] text-lg" href="#">
                  Ücretsiz Deneyin
                </a>
                <a className="font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-600 transition-colors" href="#">
                  Demo Talep Et
                </a>
              </div>
            </div>
            <div className="relative flex justify-center items-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(67,97,238,0.1),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(67,97,238,0.2),transparent_70%)]"></div>
              <div className="relative bg-white dark:bg-slate-800/50 p-4 rounded-3xl shadow-[0_0_40px_0px_rgba(67,97,238,0.3)] transform rotate-3 border border-gray-200 dark:border-gray-700">
                <img alt="Renkflow application interface" className="rounded-2xl w-full h-auto max-w-md" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAFfzrk7dJqlT6bazlRwmXT_B6j9QdrYZQ2iampSvdIoulZFBPwNI2LE7sS7LNYd9f8H4pW1T6fIuQ3jmMJbKO4przUketLaZz7MeWxo4007MRSah3eCtJ10qhbMFHFJrVZdlhpAn6nQ7CxAKs1gO84FD5jt7BkVfMWAoZPLmXKJmZj_UETVCVK9AcIbAFVHwkbTaIRmLrFelZzWJts1ZkXGSwaPt96TpiimQ1Ed0CRIB0rctEnZqCkOo1ymR5o_rN3Q0WRmSKt1KWv"/>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section className="py-12 text-center">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-slate-600 dark:text-slate-400 mb-8 font-medium">Sektör liderlerinin güvendiği platform:</p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 sm:gap-x-16 gap-y-8">
            <img alt="Microsoft logo" className="h-6 opacity-60 dark:opacity-50 grayscale hover:grayscale-0 hover:opacity-100 dark:hover:opacity-100 transition-all" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCiw0VMSNb9yVK1KIGATSQH16FbdWQ594sjuduD9_GVMBfjYrve2xsIsx1nC_osoa4NDdeQFkmBMlf2LSUiJjUviZOMWgPqaak1WvN_RsRGYC1fheuqBVkL19hVEdQjcUyoHAmyFO8m9rkQHaYmQL4Al9AE9Y2vfNW-Bci1s8ZNXWLzWHdE5YSOAJ9GPOVuhSB7EwhY11luGPVWUh_-_bnF4qoGYUaAccZnQyoO7_5nIUQiHB6tsuW_U81_mB0qPHXCvBKfoOxOnBxs"/>
            <img alt="IBM logo" className="h-6 opacity-60 dark:opacity-50 grayscale hover:grayscale-0 hover:opacity-100 dark:hover:opacity-100 transition-all" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCCwWOG2v4gmAladMf3xDgdOUo3akAt3x0WSVoQoXi1OTKcV1V7nIOUQkosXZE7yVrXgvGL6BFdK0EI0PF26WxhOgJaPlZiF5zytp4Rk3wbO26QA6NwL_Jge4CQQchfZHsJRkPABUBwS1RLa0QEhXqkBJCT31gKIvNoAIxOWMGb6gq0HDzfSl-qwkjhrueCI9V6Ve-qZY1Y4V0NFLxDcjIhHuJKwmSom52IEgp6b3lGKmTIDvZooUJ3NiGBnyUD1rdDObM_Y8rrzmpq"/>
            <img alt="Spotify logo" className="h-6 opacity-60 dark:opacity-50 grayscale hover:grayscale-0 hover:opacity-100 dark:hover:opacity-100 transition-all" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCusWGvk2B2lh8n9WfBOnvOJIAjlzrv0NCLMVwkXlLypndIUyTPY90lPkuFonJbrCZT2oLKd38a1LWQh8aqBDlQeiXfI37IkY4ZEWdzdwpalDUKuPNYy_4pX0w-SNXYBVLDj2hZyLlJDmUUZGBzEEZQ-YZao8u33OtYws7sonopGkTNI7FonRyaO0vHYUGYVdoOXhoNF77Xu3puG4setR0hw0Dz7r4HEj0xH7rwy2-QXq2eVASCgBI9fr7EWbU6DMwjVBmSJAsGLKqm"/>
            <img alt="ACME logo" className="h-6 opacity-60 dark:opacity-50 grayscale hover:grayscale-0 hover:opacity-100 dark:hover:opacity-100 transition-all" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQ0X23v0Wgfqys209SSQiiN3Yyg1q-Kerqk_PF43PrGHfOQa69xv6ferrw7rZ5j6pKrUQQNxpoZ11KK0GNa0sgdONGD_G-bxBtx36Oq3XrVAqA92MpuIM6odJJcuU0ilpN_aa63f70RaDmbC6ZHjSEVX4Cjdc8WmZZKqzFRKbUJxQsMTncGmEHpmFFv9fB6VpXERWYxEaZq6OT2CtJKPsVfQOCcfljoqM1Y2j_tB4_r8ZKhRcV5hrRZ295kd2gdLEJXwrxaJpGXH4N"/>
            <img alt="Samsung logo" className="h-7 opacity-60 dark:opacity-50 grayscale hover:grayscale-0 hover:opacity-100 dark:hover:opacity-100 transition-all" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBj_x4Okmf5Wg4kjpryZOlScD7eL3vBKLnVFa_SgQIygSJBTRnIpnnqbEd75uXZThtVnf_m4xDcBPd8BhfmAOknTA0tdo1yumEUI3HU7ZGc8gDMQoqCUqaXhuN6FWsIRGYmHny31BYyXOQXDISGzAVMFH206gs_416g7yiiyYPoIc3y15KBu5leR5zZnx4oBMZUNdiRsEnqnWYvQUzWxDmr7r2odhqivBnC5CkUsXeHToAWBngdOAzRpi-Mz9-4qFZIpEpaEJiuUAQV"/>
            <img alt="Sonegan logo" className="h-6 opacity-60 dark:opacity-50 grayscale hover:grayscale-0 hover:opacity-100 dark:hover:opacity-100 transition-all" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAs91PcHWGwRdWeaxfGahyE8p6bgVMdtNCqyhXk998dJU33DzyE5Wv3DIUraeqvra9BxvClqsEOv9xp8xtdf5Qr89gMwCJBJued-xobIDIBORELxaGoICMV5wpmfKO8siXeeaNl3OucK4ARFxQwdivoQp4AcEYaWF1vwnHErYqZFzcTnMbdeFCzAxgeFaBjJqWqrfVxL-MFgZZ0Qtkv-bJXwlJAQbPtsYiVdCFfXMkgtDhtYZ7TiCoVM1XgmjMTIA6TZygUOR_KBUoH"/>
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">Her Ekip İçin Güçlü Çözümler</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">Renkflow, iş akışınızı ne olursa olsun, ekibinizin potansiyelini en üst düzeye çıkarmak için tasarlanmıştır. Sizin için nasıl çalıştığını keşfedin.</p>
          </div>
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-gray-100 dark:border-gray-800">
              <div className="bg-blue-50 dark:bg-blue-600/10 text-blue-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined !text-3xl">stacks</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Proje Yönetimi</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">Görevleri atayın, son tarihleri belirleyin ve projelerinizin ilerlemesini tek bir yerden görsel olarak takip edin.</p>
              <a className="font-semibold text-blue-600 hover:underline flex items-center group" href="#">Daha Fazla Bilgi <span className="material-symbols-outlined ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span></a>
            </div>
            <div className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-gray-100 dark:border-gray-800">
              <div className="bg-blue-50 dark:bg-blue-600/10 text-blue-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined !text-3xl">cycle</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Çevik Geliştirme</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">Sprint planlaması, backlog yönetimi ve Kanban panoları ile çevik metodolojileri kolayca uygulayın.</p>
              <a className="font-semibold text-blue-600 hover:underline flex items-center group" href="#">Daha Fazla Bilgi <span className="material-symbols-outlined ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span></a>
            </div>
            <div className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-gray-100 dark:border-gray-800">
              <div className="bg-blue-50 dark:bg-blue-600/10 text-blue-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined !text-3xl">palette</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Yaratıcı Süreçler</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">Fikir aşamasından son tasarıma kadar tüm yaratıcı projelerinizi ve geri bildirim döngülerini yönetin.</p>
              <a className="font-semibold text-blue-600 hover:underline flex items-center group" href="#">Daha Fazla Bilgi <span className="material-symbols-outlined ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span></a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="flex items-start space-x-6">
                <div className="bg-blue-50 dark:bg-blue-600/10 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined">grid_view</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Özelleştirilebilir Panolar</h3>
                  <p className="text-slate-600 dark:text-slate-400">İş akışınıza mükemmel şekilde uyan panolar, listeler ve kartlarla her projeyi kendinize göre şekillendirin.</p>
                </div>
              </div>
              <div className="flex items-start space-x-6">
                <div className="bg-blue-50 dark:bg-blue-600/10 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined">bolt</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Güçlü Otomasyon</h3>
                  <p className="text-slate-600 dark:text-slate-400">Tekrarlayan görevleri otomatize ederek zaman kazanın ve ekibinizin önemli işlere odaklanmasını sağlayın.</p>
                </div>
              </div>
              <div className="flex items-start space-x-6">
                <div className="bg-blue-50 dark:bg-blue-600/10 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined">insights</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Gelişmiş Raporlama</h3>
                  <p className="text-slate-600 dark:text-slate-400">Proje performansını ve ekip verimliliğini anlamak için derinlemesine analizler ve görsel raporlar alın.</p>
                </div>
              </div>
            </div>
            <div className="p-2 bg-white dark:bg-slate-800/50 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700">
              <img alt="Detailed dashboard view" className="rounded-2xl" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvJDrdlgOwZq0gD7XOVJlVf69Yhqk1lgjeiswgVQL5vBhXrQHTlo4p2Fp6lgonsyyhu0msF395XtqB0dj16AYx2PfBLSCydbhkmeZ7EBmjFksFmZEf-knvrvQwVTF-wW0FC5RxljmSwxq7AfJG7itxY9maEtkUgEaSoKleKvV1ACFzjj_frI0PeHeWhzPtzIBM1mm_MEeoEouMozdyNp3tQcjIRwRRr28krjTo1lpwEyvwOJs75xaynmcCN1DZYrHnpNwnvT2W5me0"/>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">İş Akışınızı Optimize Edin</h2>
            <p className="mt-4 text-xl text-blue-600 font-semibold">Verimliliği %50'ye Kadar Artırın</p>
          </div>
          <div className="mt-16 bg-blue-50 dark:bg-blue-600/10 p-8 md:p-12 rounded-3xl border border-blue-100 dark:border-blue-600/20">
            <img alt="Optimization diagram" className="w-full h-auto rounded-xl" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8xcb_5ay_Dg7O_K8tRw9sIy4zkyfjB1B7FDu7iEydQ7AuOWqP8UXjZ5rmELVbveOOUwx3aPnlv0IugOdKickucfBH7hlXtxAjzYVHI6cUFl9bMrxhe2YoDfJN2ZVkA1kE-bOcvQBVgLNtqbwhvIpJ5NgIE3G01K9crbl8zrxp9XB38F3GSqyxPiDTam76hMwU7GkyZP9qVPcYTakG_DVDMehfSrRKeAG286_Op4BruH5raEKq1H3wRD0TaB28qalc1MTZxBXcNijY"/>
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">Müşterilerimiz Ne Diyor?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
              <p className="text-lg mb-6 text-slate-800 dark:text-slate-200">"Renkflow, ekibimizin proje teslim hızını iki katına çıkardı. Artık her şey daha organize ve şeffaf."</p>
              <div className="flex items-center mt-auto">
                <img alt="Azse V." className="w-12 h-12 rounded-full mr-4" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1S9jX-TdsC7AweEsQIAIlwd7SS9E9o8ELcswwsnm3NNYOLTgLryYuH7h7iuWtyDQtz-Qa-Uo3nlaooX4mhhTTaJaCkjsrEXbgQXMVzAwfOIX6rYVOBosMYeil7IUHXoqitL3tdS9cvMOa2hU_OQ0Ovz6eAWcWNTVhYhuSxu5fFS9cuOS5Irx0m1A0V0QX4nD8lkoymoZHxdkBdOw9LqVifeLHiOdCvwnEh0dOztSXUrTOOWfRt26cgksvcu4D9DUJOfkt9Rl5w9hy"/>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Azse V.</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Proje Müdürü, X97 Corp.</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-600 text-white p-8 rounded-3xl shadow-xl flex flex-col justify-between scale-105">
              <p className="text-lg mb-6">"Daha önce kullandığımız tüm araçları tek bir platformda birleştirdi. Verimliliğimizdeki artış inanılmaz."</p>
              <div className="flex items-center mt-auto">
                <img alt="Soma N." className="w-12 h-12 rounded-full mr-4 border-2 border-white/50" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqWt0rPEBfw_OXnOP_ceUmb1vsqpQDOGRwCoHWs_RmALRQVnhPGYE1NzQk2UrKlthjXfFhYTWHtpYX7jHsVDe4w5hJCU9Z9Nxo2C0C0oOWYlVitZgsrUVo-QWMnzPCYkZ7_DXgZt6XMhYEBe8EJfIMjtfDT9zV5bPAyZrK-IdnWReWfpUmCZek-wZ55c1O-7kN4loPwWXC6y_N1qmTLuJWCopjjOXh-D_NvRDYzuL23t2e7s-L3aIWqxkUPpmXBa73XpqhpJSr4fHI"/>
                <div>
                  <p className="font-bold">Soma N.</p>
                  <p className="text-sm opacity-80">CEO, S12 Corp.</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
              <p className="text-lg mb-6 text-slate-800 dark:text-slate-200">"Yaratıcı ekibimiz için mükemmel bir araç. Fikir paylaşımı ve geri bildirim süreci hiç bu kadar kolay olmamıştı."</p>
              <div className="flex items-center mt-auto">
                <img alt="Lama L." className="w-12 h-12 rounded-full mr-4" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAhGgQYzKp3TZ3okUTzmFtaeV-YhXEx4GFx_Ct6_F9C22mRIPihL-EHgOzuVW33pbHS0ZjserIxMOTCSiYNTcWgWLNLAbURckBEB7c9LjA8c4ox3xOx2tU95TbpRYsQhffridw1c4sG1C__qycg5rFffrm1Wvj69QVLavxN0Km7Wg2Gwoc9GF4nVdlQJLrs_DJyeesu-07_ak5OIId3GLs7f2X8hPrnbbhV9xYhQoDa2lUSP-UUXGEKCKyygYoGf-hsUAADm_xI9faO"/>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Lama L.</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Tasarım Lideri, 017 Companies</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-blue-50 dark:bg-slate-800/50 rounded-3xl my-24 md:my-32 py-20 px-8 text-center max-w-[1400px] mx-auto">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">Verimliliğinizi Bugün Artırın</h2>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">
            Binlerce ekibe katılın ve iş akışınızı Renkflow ile bir sonraki seviyeye taşıyın. Kredi kartı gerekmez.
          </p>
          <a className="mt-10 inline-block bg-blue-600 text-white font-bold py-4 px-10 rounded-full transition-transform hover:scale-105 shadow-[0_0_40px_0px_rgba(67,97,238,0.3)] text-lg" href="#">
            Hemen Ücretsiz Başlayın
          </a>
        </div>
      </section>
    </>
  );
};
