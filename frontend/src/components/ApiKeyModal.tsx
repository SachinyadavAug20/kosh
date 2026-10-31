"use client";

import React, { useState } from "react";
import { Key, X, ExternalLink, Check, ShieldCheck } from "lucide-react";

export interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSaveToken: (token: string) => void;
  onClearToken: () => void;
}

export function ApiKeyModal({
  isOpen,
  onClose,
  token,
  onSaveToken,
  onClearToken,
}: ApiKeyModalProps) {
  const [inputVal, setInputVal] = useState(token);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveToken(inputVal.trim());
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleClear = () => {
    setInputVal("");
    onClearToken();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="w-full max-w-md bg-[#18181b] border border-[#27272a] shadow-2xl rounded font-mono text-xs text-[#f4f4f5] overflow-hidden">
        {/* Header */}
        <div className="h-10 px-4 bg-[#141416] border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#ea580c] font-bold">
            <Key className="w-4 h-4" />
            <span className="text-white uppercase tracking-wider text-[11px]">
              API Key
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#71717a] hover:text-[#f4f4f5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4">
          <div className="text-[11px] text-[#a1a1aa] leading-relaxed">
            Enter your Google Gemini API key to enable AI model generation, or use Demo mode. Your key stays local to your browser.
          </div>

          {/* Input: API Key */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider flex justify-between">
              <span>Google Gemini API Key</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[#ea580c] hover:underline flex items-center space-x-1"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </label>

            <input
              type="password"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Paste AIzaSy... API key"
              className="w-full bg-[#141416] border border-[#27272a] focus:border-[#ea580c] rounded px-3 py-2 text-xs text-[#f4f4f5] placeholder-[#52525b] outline-none font-mono"
            />
          </div>

          {/* Key Status Pill */}
          <div className="flex items-center justify-between p-2.5 bg-[#141416] border border-[#27272a] rounded text-[11px]">
            <span className="text-[#71717a]">Status:</span>
            {token ? (
              <span className="text-emerald-400 font-bold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Connected (BYOK)</span>
              </span>
            ) : (
              <span className="text-[#71717a]">No key configured</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-[#27272a]">
            <div className="flex items-center space-x-2">
              {token && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2.5 py-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[11px] transition-colors"
                >
                  Clear Key
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!inputVal.trim()}
              className="px-4 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold rounded text-[11px] flex items-center space-x-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{isSaved ? "Saved!" : "Save & Connect"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
