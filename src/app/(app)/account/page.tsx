"use client";

import React, { useRef, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { useToast } from "@/components/ui/Toast";
import { roleLabel } from "@/lib/format";
import { resizeToSquareDataUrl } from "@/lib/image";
import { Button } from "@/components/ui/Button";
import { HelpTip } from "@/components/ui/HelpTip";
import { IconUpload, IconTrash } from "@/components/ui/icons";

export default function AccountPage() {
  const { currentUser, setAvatar } = useAuth();
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!currentUser) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      push("error", "Please choose an image file.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await resizeToSquareDataUrl(file);
      await setAvatar(dataUrl);
      push("success", "Profile picture updated.");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Couldn't update your picture.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    await setAvatar(null);
    push("info", "Profile picture removed.");
  };

  return (
    <div className="space-y-6 animate-slideUp max-w-lg">
      <HelpTip id="account">
        Your picture is only stored on this device for now — it won&apos;t follow you to another
        computer yet.
      </HelpTip>

      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">My Account</h2>
        <p className="text-xs text-slate-400">Your profile on this device.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {currentUser.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUser.avatar} alt={currentUser.name} className="h-20 w-20 rounded-full object-cover border border-slate-700" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl font-bold text-slate-400">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                <IconUpload width={14} height={14} /> Upload Picture
              </Button>
              {currentUser.avatar && (
                <button onClick={handleRemove} className="text-[10px] bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-900/40 px-2.5 py-1.5 rounded font-mono transition-all duration-150 flex items-center gap-1">
                  <IconTrash width={11} height={11} /> Remove
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500">JPG or PNG, any size — it&apos;ll be resized automatically.</p>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-4 space-y-3">
          <Field label="Name" value={currentUser.name} />
          <Field label="Email" value={currentUser.email} />
          <Field label="Role" value={roleLabel(currentUser.role)} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500 font-mono uppercase text-[10px]">{label}</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  );
}
