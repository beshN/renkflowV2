import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-8 text-center relative z-10 border-t border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-[#0B1120]/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} RenkFlow. Tüm hakları saklıdır.
        </p>
        
        <div className="flex space-x-6">
            <a href="#" className="text-gray-400 hover:text-primary-600 dark:hover:text-white transition-colors">
            <span className="sr-only">Twitter</span>
            <Twitter className="h-5 w-5" />
            </a>
            <a href="#" className="text-gray-400 hover:text-primary-600 dark:hover:text-white transition-colors">
            <span className="sr-only">LinkedIn</span>
            <Linkedin className="h-5 w-5" />
            </a>
            <a href="#" className="text-gray-400 hover:text-primary-600 dark:hover:text-white transition-colors">
            <span className="sr-only">GitHub</span>
            <Github className="h-5 w-5" />
            </a>
        </div>
      </div>
    </footer>
  );
};