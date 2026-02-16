import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface AppleCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "glass-dark" | "outline";
  noPadding?: boolean;
}

export const AppleCard = forwardRef<HTMLDivElement, AppleCardProps>(
  ({ className, variant = "default", noPadding = false, children, ...props }, ref) => {
    const variants = {
      default: "bg-card text-card-foreground shadow-apple-card border border-border/50",
      glass: "bg-white/70 dark:bg-black/50 backdrop-blur-xl border border-white/20 shadow-glass",
      "glass-dark": "bg-black/60 backdrop-blur-xl border border-white/10 shadow-glass text-white",
      outline: "bg-transparent border border-border",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-3xl transition-all duration-300",
          variants[variant],
          noPadding ? "p-0" : "p-6",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

AppleCard.displayName = "AppleCard";
