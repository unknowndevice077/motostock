"use client";

import React from "react";

const baseInputClass = "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 transition-all duration-200 placeholder-slate-600";

interface BaseProps {
  label: string;
  required?: boolean;
}

interface TextFieldProps extends BaseProps {
  type?: "text" | "number" | "password" | "email" | "tel";
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: string;
}

export function TextField({ label, required, type = "text", value, onChange, placeholder, step }: TextFieldProps) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        step={step}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={baseInputClass}
      />
    </div>
  );
}

type SelectOption = string | { value: string; label: string };

interface SelectFieldProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
}

export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${baseInputClass} py-1.5`}>
        {options.map((opt) => {
          const optValue = typeof opt === "string" ? opt : opt.value;
          const optLabel = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
}

interface TextAreaFieldProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function TextAreaField({ label, value, onChange, placeholder, rows = 3 }: TextAreaFieldProps) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">{label}</label>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseInputClass} resize-none`}
      />
    </div>
  );
}
