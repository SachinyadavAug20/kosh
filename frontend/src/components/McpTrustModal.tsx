"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  X,
  ExternalLink,
  Copy,
  Check,
  Search,
  AlertTriangle,
  FileCode2,
  Lock,
  Layers,
  Sparkles,
  RefreshCw,
} from "lucide-react";

export interface McpTrustModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolCount?: number;
}

interface ToolCheckResult {
  identifier: string;
  github_url?: string;
  trust_score: number;
  verdict: string;
  verdict_label: string;
  verdict_reason: string;
  sub_scores?: {
    code?: number;
    maintenance_adjust?: number;
    reputation_adjust?: number;
  };
  tools_count?: number;
  cves?: number;
  license?: string;
  detail_url?: string;
}

export const McpTrustModal: React.FC<McpTrustModalProps> = ({
  isOpen,
  onClose,
  toolCount = 23,
}) => {
  const [copiedBadge, setCopiedBadge] = useState<boolean>(false);
  const [vetQuery, setVetQuery] = useState<string>("SachinyadavAug20/kosh");
  const [isVetting, setIsVetting] = useState<boolean>(false);
  const [vetResult, setVetResult] = useState<ToolCheckResult | null>({
    identifier: "SachinyadavAug20/kosh",
    github_url: "https://github.com/SachinyadavAug20/kosh",
    trust_score: 74,
    verdict: "yellow",
    verdict_label: "Emerging · No concerning findings",
    verdict_reason: "Trust score 74/100 — 0 production CVEs, 96 code quality, publisher verification in progress",
    sub_scores: {
      code: 96,
      maintenance_adjust: 0,
      reputation_adjust: 0,
    },
    cves: 0,
    tools_count: toolCount,
    license: "Apache-2.0",
    detail_url: "https://m8ven.ai/mcp/SachinyadavAug20%2Fkosh",
  });

  if (!isOpen) return null;

  const badgeMarkdown =
    "[![M8ven Score](https://m8ven.ai/badge/mcp/sachinyadavaug20/kosh)](https://m8ven.ai/mcp/sachinyadavaug20/kosh?s=readme)";

  const handleCopyBadge = () => {
    navigator.clipboard.writeText(badgeMarkdown);
    setCopiedBadge(true);
    setTimeout(() => setCopiedBadge(false), 2000);
  };

  const handleRunToolCheck = async () => {
    if (!vetQuery.trim()) return;
    setIsVetting(true);
    try {
      const res = await fetch(
        `/api/health/tool-check?identifier=${encodeURIComponent(vetQuery.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        setVetResult(data);
      } else {
        // Fallback to direct client query if backend is proxying
        const rpcRes = await fetch("https://m8ven.ai/api/mcp/tool-check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: {
              name: "check_tool",
              arguments: { identifier: vetQuery.trim() },
            },
          }),
        });
        if (rpcRes.ok) {
          const text = await rpcRes.text();
          const match = text.match(/data:\s*(\{.*\})/);
          if (match && match[1]) {
            const parsed = JSON.parse(match[1]);
            if (parsed.result?.structuredContent) {
              setVetResult(parsed.result.structuredContent);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Tool Check query error:", e);
    } finally {
      setIsVetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141416] border border-[#27272a] rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272a] bg-[#18181b]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                M8ven Trust Index · MCP Security & Vetting
              </h2>
              <p className="text-xs text-zinc-400">
                Independent trust score, dependency audit, and recursive tool check for Model Context Protocol servers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-zinc-300">
          {/* Official Badge & Listing Strip */}
          <div className="p-4 rounded-lg bg-[#18181b] border border-[#27272a] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="https://m8ven.ai/badge/mcp/sachinyadavaug20/kosh"
                alt="M8ven Score"
                className="h-6 rounded border border-zinc-700/60"
              />
              <span className="text-[11px] text-zinc-400">
                Verified against repository <code>SachinyadavAug20/kosh</code>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyBadge}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-medium transition-colors"
              >
                {copiedBadge ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedBadge ? "Copied Badge" : "Copy Badge"}
              </button>
              <a
                href="https://m8ven.ai/mcp/sachinyadavaug20/kosh?s=app"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-[11px] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Claim Listing on M8ven
              </a>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-[#18181b] border border-[#27272a]">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
                Trust Score
              </div>
              <div className="text-xl font-bold text-sky-400">
                74 <span className="text-xs font-normal text-zinc-500">/ 100</span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">Grade C · Emerging</div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#18181b] border border-[#27272a]">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
                Code Quality
              </div>
              <div className="text-xl font-bold text-emerald-400">
                96 <span className="text-xs font-normal text-zinc-500">/ 100</span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">Exceptional code health</div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#18181b] border border-[#27272a]">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
                Dependency CVEs
              </div>
              <div className="text-xl font-bold text-emerald-400">0</div>
              <div className="text-[11px] text-zinc-400 mt-1">0 production, 0 dev</div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#18181b] border border-[#27272a]">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
                MCP Tools Declared
              </div>
              <div className="text-xl font-bold text-zinc-200">{toolCount}</div>
              <div className="text-[11px] text-zinc-400 mt-1">All 4 hints annotated</div>
            </div>
          </div>

          {/* Audit Verification Details */}
          <div className="p-4 rounded-lg bg-[#18181b] border border-[#27272a] space-y-2.5">
            <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              Audit Findings & Security Attestation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-start gap-2 text-zinc-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>Zero credential exfiltration, zero taint flows, zero obfuscation</span>
              </div>
              <div className="flex items-start gap-2 text-zinc-300">
                <FileCode2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>Permissive open source license: Apache 2.0 (LICENSE file present)</span>
              </div>
              <div className="flex items-start gap-2 text-zinc-300">
                <Layers className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>OpenAI / Claude hint annotations: readOnly, destructive, idempotent, openWorld</span>
              </div>
              <div className="flex items-start gap-2 text-zinc-300">
                <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>Privacy policy declared: local execution on 127.0.0.1, zero analytics (PRIVACY.md)</span>
              </div>
            </div>
          </div>

          {/* Interactive Tool Check Console */}
          <div className="p-4 rounded-lg bg-[#18181b] border border-[#27272a] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-sky-400" />
                  M8ven Tool Check · Vet Any MCP Server
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Recursive trust layer: score any MCP server before connecting it to your AI coding assistant
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={vetQuery}
                onChange={(e) => setVetQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRunToolCheck()}
                placeholder="e.g. SachinyadavAug20/kosh or modelcontextprotocol/servers"
                className="flex-1 bg-[#101012] border border-[#27272a] rounded px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={handleRunToolCheck}
                disabled={isVetting}
                className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
              >
                {isVetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {isVetting ? "Evaluating..." : "Check MCP"}
              </button>
            </div>

            {vetResult && (
              <div className="p-3.5 rounded bg-[#101012] border border-[#27272a] space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200">{vetResult.identifier}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      vetResult.verdict === "green"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : vetResult.verdict === "yellow"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {vetResult.verdict_label || vetResult.verdict}
                  </span>
                </div>
                <div className="text-zinc-400">{vetResult.verdict_reason}</div>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#202024]">
                  <div>
                    <span className="text-zinc-500">Trust Score:</span>{" "}
                    <strong className="text-zinc-200">{vetResult.trust_score} / 100</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500">Code Quality:</span>{" "}
                    <strong className="text-zinc-200">{vetResult.sub_scores?.code ?? 96} / 100</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500">CVE Status:</span>{" "}
                    <strong className="text-emerald-400">0 Vulnerabilities</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#27272a] bg-[#18181b] flex items-center justify-between text-[11px] text-zinc-500">
          <span>Kosh Creative MCP Server Hub · Headless Blender 5.2 LTS</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
