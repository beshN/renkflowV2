'use client';

import React from 'react';
import { Twitter, Linkedin, Github } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-8 text-center relative z-10 border-t border-border bg-background/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} RenkFlow. Tüm hakları saklıdır.
        </p>
        

      </div>
    </footer>
  );
};
