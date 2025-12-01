import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10 text-center space-y-8 px-4">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary animate-in fade-in slide-in-from-bottom-4 duration-1000">
            RenkFlow
          </h1>
          <p className="text-xl text-muted-foreground max-w-md mx-auto animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-200">
            Modern, fast, and efficient order management system for your business.
          </p>
        </div>

        <div className="flex gap-4 justify-center animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
          <Link href="/login">
            <Button size="lg" variant="primary" spotlight>
              Get Started
            </Button>
          </Link>
          <Link href="/orders">
            <Button size="lg" variant="outline">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-sm text-muted-foreground animate-in fade-in duration-1000 delay-500">
        © {new Date().getFullYear()} RenkFlow. All rights reserved.
      </div>
    </div>
  );
}
