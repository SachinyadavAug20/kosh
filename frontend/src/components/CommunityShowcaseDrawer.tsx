"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, X, ExternalLink, Box, Play, RefreshCw, GitFork } from "lucide-react";

export interface CommunityModelItem {
  id: string;
  title: string;
  description?: string;
  author?: string;
  assetUrl?: string;
  assetName?: string;
  snapshotUrl?: string;
  script?: string;
  format?: string;
  shareUrl?: string;
}

interface CommunityShowcaseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadModel: (item: CommunityModelItem) => void;
}

export function CommunityShowcaseDrawer({
  isOpen,
  onClose,
  onLoadModel,
}: CommunityShowcaseDrawerProps) {
  const [items, setItems] = useState<CommunityModelItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCommunityModels = () => {
    setLoading(true);
    fetch("http://localhost:8080/api/shares")
      .then((res) => res.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load community models:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      fetchCommunityModels();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-end z-50 select-none font-sans text-xs">
      <div className="w-full max-w-md h-full bg-[#18181b] border-l border-[#333338] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#333338] bg-[#1f1f23] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#ea580c]" />
            <span className="font-semibold text-sm text-[#f4f4f5]">Community Showcase & Gallery</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={fetchCommunityModels}
              title="Refresh models"
              className="p-1.5 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#2c2c32] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#2c2c32] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Guidance Subheader */}
        <div className="px-4 py-2 bg-[#141416] border-b border-[#333338] text-[11px] text-[#a1a1aa]">
          Click any model to load it instantly into your active 3D workstation viewport.
        </div>

        {/* Model Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && items.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#71717a]">
              <div className="w-6 h-6 border-2 border-[#ea580c] border-t-transparent rounded-full animate-spin mb-2" />
              <span>Loading showcase creations...</span>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="bg-[#202024] border border-[#333338] hover:border-[#ea580c] rounded p-3 transition-colors group flex flex-col justify-between space-y-2 cursor-pointer"
                onClick={() => {
                  onLoadModel(item);
                  onClose();
                }}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-1.5 font-semibold text-xs text-[#f4f4f5] group-hover:text-[#ea580c] transition-colors">
                      <Box className="w-3.5 h-3.5 shrink-0 text-[#ea580c]" />
                      <span>{item.title}</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[9px] font-mono bg-[#141416] border border-[#333338] text-[#a1a1aa] rounded uppercase">
                      {item.format || "GLB"}
                    </span>
                  </div>

                  {item.description && (
                    <p className="text-[11px] text-[#a1a1aa] mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#2c2c32] text-[10px]">
                  <span className="text-[#71717a] font-mono">
                    by {item.author || "Community"}
                  </span>

                  <div className="flex items-center space-x-2">
                    {item.shareUrl && (
                      <a
                        href={item.shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#a1a1aa] hover:text-[#f4f4f5] flex items-center space-x-1 hover:underline"
                        title="Open interactive 3D share card"
                      >
                        <span>Preview</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}

                    <span className="flex items-center space-x-1 text-[#ea580c] font-semibold">
                      <GitFork className="w-3 h-3" />
                      <span>Load in Studio</span>
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
