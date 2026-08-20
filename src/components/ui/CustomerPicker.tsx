"use client";

import React, { useEffect, useState } from "react";
import { searchCustomers, getOrCreateCustomer } from "@/lib/db/customers";
import type { Customer } from "@/types";

const inputClass = "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 transition-all duration-200 placeholder-slate-600";

interface CustomerPickerProps {
  shopId: string;
  label?: string;
  required?: boolean;
  /** Selected customer, or null for "no customer picked yet" (walk-in). */
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
}

/**
 * Type-a-name-and-go customer picker: shows matching existing customers as
 * you type, or resolves to a brand-new one on blur/Enter via
 * `getOrCreateCustomer` — no separate "create customer" screen. Optional
 * phone number can be added once a customer is picked.
 */
export function CustomerPicker({ shopId, label = "Customer", required, value, onChange }: CustomerPickerProps) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [phone, setPhone] = useState(value?.phone ?? "");
  const [matches, setMatches] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value?.name ?? "");
    setPhone(value?.phone ?? "");
  }, [value]);

  useEffect(() => {
    if (!open || value) return;
    const q = query.trim();
    if (!q) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      searchCustomers(shopId, q).then(setMatches);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open, shopId, value]);

  const pick = (customer: Customer) => {
    onChange(customer);
    setQuery(customer.name);
    setPhone(customer.phone ?? "");
    setOpen(false);
  };

  const resolveTyped = async () => {
    setOpen(false);
    const name = query.trim();
    if (!name) {
      onChange(null);
      return;
    }
    if (value && value.name === name) return; // unchanged
    const customer = await getOrCreateCustomer(shopId, name, phone.trim() || null);
    onChange(customer);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
          {label} {!required && <span className="text-slate-600 normal-case">(optional)</span>}
        </label>
        <input
          type="text"
          required={required}
          value={query}
          placeholder="Type a customer name..."
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(resolveTyped, 120)}
          className={inputClass}
        />
        {open && matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg shadow-2xl overflow-hidden">
            {matches.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-slate-200 truncate">{c.name}</span>
                {c.phone && <span className="text-slate-500 font-mono shrink-0">{c.phone}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {query.trim() && (
        <input
          type="tel"
          value={phone}
          placeholder="Phone (optional)"
          onChange={(e) => setPhone(e.target.value)}
          onBlur={resolveTyped}
          className={inputClass}
        />
      )}
    </div>
  );
}
