"use client";

import React, { useState } from "react";
import { Check, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PRESETS, type PresetCategory, type PresetDefinition } from "@tr-studio/animation-engine";
import { fieldClass, labelClass } from "@/components/studio/scene-studio-common";

export function AnimationPresetDialog({
  targetId,
  targetLabel,
  currentTimeMs,
  maxDurationMs,
  onApply,
  onClose,
}: {
  targetId: string;
  targetLabel: string;
  currentTimeMs: number;
  maxDurationMs: number;
  onApply: (presetId: string, opts: { startMs: number; durationMs: number; distance?: number; amount?: number }) => void | Promise<void>;
  onClose: () => void;
}) {
  const isCamera = targetId === "camera";
  const [selectedCat, setSelectedCat] = useState<PresetCategory>(isCamera ? "camera" : "motion");
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    isCamera ? "camera-pan" : "slide-right"
  );

  const activePreset = PRESETS.find((p) => p.id === selectedPresetId) || PRESETS[0];

  const [startMs, setStartMs] = useState(Math.min(currentTimeMs, Math.max(0, maxDurationMs - 1000)));
  const [durationMs, setDurationMs] = useState(activePreset.defaultDurationMs);
  const [distance, setDistance] = useState(activePreset.defaultDistance ?? 300);
  const [amount, setAmount] = useState(activePreset.defaultAmount ?? 0.5);
  const [busy, setBusy] = useState(false);

  const filteredPresets = PRESETS.filter((p) => p.category === selectedCat);

  const handleSelectPreset = (p: PresetDefinition) => {
    setSelectedPresetId(p.id);
    setDurationMs(p.defaultDurationMs);
    if (p.defaultDistance !== undefined) setDistance(p.defaultDistance);
    if (p.defaultAmount !== undefined) setAmount(p.defaultAmount);
  };

  const handleApply = async () => {
    setBusy(true);
    try {
      await onApply(selectedPresetId, {
        startMs,
        durationMs,
        distance: activePreset.params.includes("distance") ? distance : undefined,
        amount: activePreset.params.includes("amount") ? amount : undefined,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-[#0d0d12] p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h2 id="preset-dialog-title" className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              Apply Animation Preset
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Target: <span className="font-semibold text-violet-300">{targetLabel}</span>
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Categories */}
        <div className="flex gap-1.5 pt-3 pb-2 border-b border-zinc-800/80">
          {(["transition", "motion", "character", "camera"] as PresetCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCat(cat);
                const firstInCat = PRESETS.find((p) => p.category === cat);
                if (firstInCat) handleSelectPreset(firstInCat);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                selectedCat === cat
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Presets List */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-3 max-h-48 overflow-y-auto">
          {filteredPresets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className={`rounded-xl border p-2.5 text-left text-xs transition-all ${
                selectedPresetId === p.id
                  ? "border-violet-500 bg-violet-950/30 text-white ring-1 ring-violet-500"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
              }`}
            >
              <p className="font-semibold">{p.label}</p>
              <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{p.description}</p>
            </button>
          ))}
        </div>

        {/* Preset Parameters */}
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 mt-2">
          <p className="text-xs font-medium text-white">{activePreset.description}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="ps-start">
                Start Time (ms)
              </label>
              <input
                id="ps-start"
                type="number"
                min={0}
                max={maxDurationMs}
                step={50}
                className={fieldClass}
                value={startMs}
                onChange={(e) => setStartMs(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ps-duration">
                Duration (ms)
              </label>
              <input
                id="ps-duration"
                type="number"
                min={50}
                max={60000}
                step={50}
                className={fieldClass}
                value={durationMs}
                onChange={(e) => setDurationMs(Math.max(50, Number(e.target.value) || 50))}
              />
            </div>

            {activePreset.params.includes("distance") && (
              <div>
                <label className={labelClass} htmlFor="ps-dist">
                  Distance (px)
                </label>
                <input
                  id="ps-dist"
                  type="number"
                  className={fieldClass}
                  value={distance}
                  onChange={(e) => setDistance(Number(e.target.value) || 0)}
                />
              </div>
            )}

            {activePreset.params.includes("amount") && (
              <div>
                <label className={labelClass} htmlFor="ps-amount">
                  Amount / Multiplier
                </label>
                <input
                  id="ps-amount"
                  type="number"
                  step={0.05}
                  className={fieldClass}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800 mt-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void handleApply()} disabled={busy}>
            <Check className="h-4 w-4 mr-1.5" />
            Apply Preset Keyframes
          </Button>
        </div>
      </div>
    </div>
  );
}
