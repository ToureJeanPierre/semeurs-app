import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  prefix?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, prefix, id, className = "", ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-bold text-night">
        {label}
      </label>
      <div
        className={[
"flex min-h-13 items-center rounded-2xl border-2 bg-[#f4f8ff] px-4 shadow-[inset_0_1px_2px_rgb(21_70_184/0.06)] transition-colors",
          "focus-within:border-royal focus-within:bg-white focus-within:ring-4 focus-within:ring-royal/10",
          error ? "border-alert-ring" : "border-[#c9daf6]",
        ].join(" ")}
      >
        {prefix && (
          <span className="mr-2 border-r border-[#c9daf6] pr-3 font-semibold text-royal" aria-hidden>
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="w-full bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted/60"
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-sm font-medium text-alert-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
