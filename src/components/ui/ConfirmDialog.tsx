"use client";

import React from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel} accent="danger" maxWidth="max-w-sm">
      <div className="text-center space-y-4">
        <div className="text-red-400 text-3xl">⚠️</div>
        <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="w-1/2" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" className="w-1/2 !bg-red-600 hover:!bg-red-500 !text-white !border-none" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
