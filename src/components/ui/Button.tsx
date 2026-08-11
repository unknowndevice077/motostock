"use client";

import React from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white",
  secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
  danger: "bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40",
  ghost: "bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-[11px] px-2.5 py-1.5",
  md: "text-xs px-4 py-2.5",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, disabled, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 active:opacity-90 disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {loading && <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full" />}
      {children}
    </button>
  );
}
