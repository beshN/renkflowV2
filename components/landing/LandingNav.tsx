'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/context/ThemeContext';

interface LandingNavProps {
  largeLogo?: boolean;
}

export default function LandingNav({ largeLogo = false }: LandingNavProps) {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const rafId = useRef<number>();

  useEffect(() => {
    const handleScroll = () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
      
      rafId.current = requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 20);
      });
    };
    
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const navItems = [
    { label: 'Özellikler', href: '/features' },
    { label: 'Fiyatlandırma', href: '/pricing' },
    { label: 'Entegrasyonlar', href: '/integrations' },
    { label: 'İletişim', href: '/contact' },
  ];

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
          isScrolled 
            ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-lg' 
            : 'bg-transparent'
        }`}
        style={{ 
          willChange: 'background-color, backdrop-filter, box-shadow',
          transform: 'translateZ(0)',
        }}
      >
        <div className="w-full px-6 md:px-12">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center flex-shrink-0 cursor-pointer group">
              <div 
                className={`relative transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                  largeLogo ? 'h-64 w-[800px]' : 'h-40 w-144'
                }`} 
              >
                <Image
                  src="/logo.png"
                  alt="Renkflow"
                  fill
                  className="object-contain object-left"
                  priority
                />
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className={`hidden md:flex items-center space-x-8 px-6 py-2 rounded-full transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
              isScrolled 
                ? 'bg-transparent border-transparent' 
                : 'bg-white/70 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 shadow-sm'
            }`}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors duration-300 ${
                    pathname === item.href 
                      ? 'text-primary' 
                      : 'text-subtle-light dark:text-subtle-dark hover:text-primary dark:hover:text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center space-x-4 flex-shrink-0">
               {/* Theme Toggle */}
               <button
                  onClick={toggleTheme}
                  className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Temayı Değiştir"
                >
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

              <Link href="/auth/login" className="text-sm font-semibold text-subtle-light dark:text-subtle-dark hover:text-primary dark:hover:text-primary transition-colors duration-300 hidden sm:block">
                Giriş Yap
              </Link>
              <Link href="/signup" className="hidden sm:block">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="bg-primary text-white font-semibold py-2.5 px-6 rounded-full shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2"
                >
                  <span>Ücretsiz Başlayın</span>
                  <span className="material-symbols-outlined !text-xl">arrow_forward</span>
                </motion.button>
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Menüyü aç"
              >
                <span className="material-symbols-outlined text-2xl text-text-light dark:text-text-dark">
                  {isMobileMenuOpen ? 'close' : 'menu'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-gray-900 z-50 md:hidden shadow-2xl"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark">
                  <span className="text-lg font-bold text-text-light dark:text-text-dark">Menü</span>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-text-light dark:text-text-dark">close</span>
                  </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 p-6 space-y-2">
                  {navItems.map((item, index) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        href={item.href}
                        className={`flex items-center px-4 py-3 rounded-xl font-medium transition-colors ${
                          pathname === item.href
                            ? 'bg-primary/10 text-primary'
                            : 'text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </motion.div>
                  ))}
                  
                  <div className="pt-4 border-t border-border-light dark:border-border-dark mt-4">
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Link
                        href="/faq"
                        className="flex items-center px-4 py-3 rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        SSS
                      </Link>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      <Link
                        href="/blog"
                        className="flex items-center px-4 py-3 rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        Blog
                      </Link>
                    </motion.div>
                  </div>
                </nav>

                {/* Footer Actions */}
                <div className="p-6 border-t border-border-light dark:border-border-dark space-y-3">
                  <Link href="/auth/login" className="block">
                    <button className="w-full py-3 px-6 rounded-xl border border-border-light dark:border-border-dark font-semibold text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      Giriş Yap
                    </button>
                  </Link>
                  <Link href="/signup" className="block">
                    <button className="w-full py-3 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors">
                      Ücretsiz Başlayın
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
