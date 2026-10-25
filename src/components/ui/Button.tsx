import { forwardRef, type ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "gold";

const variants: Record<Variant, string> = {
  primary: "bg-royal text-white hover:bg-night disabled:bg-royal/50",
  secondary:
    "bg-surface text-royal border-2 border-royal/20 hover:border-royal/50 disabled:opacity-50",
  ghost: "bg-transparent text-royal hover:bg-royal/5 disabled:opacity-50",
  // L'or ne porte jamais de texte sur blanc : texte bleu nuit sur fond or.
  gold: "bg-gold text-night shadow-float hover:brightness-105 disabled:opacity-60",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading = false, fullWidth = false, className = "", children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6",
        "text-base font-semibold transition-colors disabled:cursor-not-allowed",
        fullWidth ? "w-full" : "",
        variants[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
      {children}
    </button>
  );
});
