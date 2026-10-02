import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface AppleCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "glass-dark" | "outline";
  noPadding?: boolean;
}

export const AppleCard = forwardRef<HTMLDivElement, AppleCardProps>(
  ({ className, variant = "default", noPadding = false, children, ...props }, ref) => {
    const variants = {
      default: "bg-card text-card-foreground shadow-sm border border-border",
      glass: "bg-card text-card-foreground border border-border shadow-sm",
      "glass-dark": "bg-black/60 backdrop-blur-xl border border-white/10 shadow-glass text-white",
      outline: "bg-transparent border border-border",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl transition-colors duration-150",
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
