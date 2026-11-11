"use client";

import React, { useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  ErrorBanner,
  errorMessage,
  fieldClass,
  labelClass,
} from "@/components/studio/scene-studio-common";
import type {
  AnimationAIAction,
  AnimationAIAssistProposalRecord,
  AnimationProposedTrackRecord,
} from "@tr-studio/shared-types";

const ACTIONS: { value: AnimationAIAction; label: string }[] = [
  { value: "suggest_animation_sequence", label: "Suggest Full Scene Animation Sequence" },
  { value: "suggest_character_movement", label: "Suggest Character Motion & Gestures" },
  { value: "suggest_camera_movement", label: "Suggest Camera Pan / Push-In / Zoom" },
  { value: "convert_action_to_keyframes", label: "Convert Scene Action Beats to Keyframes" },
];

export function AnimationAIPanel({
  projectId,
  sceneId,
  selectedObjectId,
  onApplied,
  onClose,
}: {
  projectId: string;
  sceneId: string;
  selectedObjectId?: string | null;
  onApplied: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [action, setAction] = useState<AnimationAIAction>("suggest_animation_sequence");
  const [targetTone, setTargetTone] = useState("Cinematic");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AnimationAIAssistProposalRecord | null>(null);

  const [acceptedTrackIds, setAcceptedTrackIds] = useState<Set<string>>(new Set());
  const [overwrite, setOverwrite] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const res = await api.animation.generateAIProposal(projectId, {
        action,
        scene_id: sceneId,
        object_id: selectedObjectId || undefined,
        target_tone: targetTone,
        instructions: instructions.trim() || undefined,
        apply_immediately: false,
      });
      setProposal(res);
      const allIds = [
        ...res.proposed_tracks.map((t) => t.id),
        ...res.proposed_camera_tracks.map((t) => t.id),
      ];
      setAcceptedTrackIds(new Set(allIds));
    } catch (err) {
      setError(errorMessage(err, "AI animation assist failed."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    setAcceptedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = async () => {
    if (!proposal) return;
    setBusy(true);
    setError(null);
    try {
      const acceptedTracks = proposal.proposed_tracks.filter((t) =>
        acceptedTrackIds.has(t.id)
      );
      const acceptedCamTracks = proposal.proposed_camera_tracks.filter((t) =>
        acceptedTrackIds.has(t.id)
      );

      await api.animation.applyAIProposal(projectId, {
        action: proposal.action,
        scene_id: sceneId,
        accepted_tracks: acceptedTracks,
        accepted_camera_tracks: acceptedCamTracks,
        overwrite_existing: overwrite,
      });

      await onApplied();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Failed to apply AI animation suggestions."));
    } finally {
      setBusy(false);
    }
  };

  const renderTrackItem = (t: AnimationProposedTrackRecord, isCamera = false) => {
    const kfs = t.keyframes || [];
    return (
      <label
        key={t.id}
        className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200"
      >
        <input
          type="checkbox"
          checked={acceptedTrackIds.has(t.id)}
          onChange={() => toggle(t.id)}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">
            <span className="rounded bg-violet-600/30 px-1.5 py-0.5 text-[10px] text-violet-200 mr-1.5">
              {isCamera ? "Camera" : t.target_id}
            </span>
            Property: <span className="font-mono text-violet-300">{t.property}</span>
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            {kfs.length} keyframe(s):{" "}
            {kfs.map((k) => `${k.time_ms}ms (${k.value})`).join(" -> ")}
          </p>
        </div>
      </label>
    );
  };

  return (
    <section
      aria-label="AI animation assistant"
      className="space-y-4 rounded-xl border border-violet-500/30 bg-violet-950/10 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-violet-400" />
          AI Animation Assistant
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close AI assistant"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-zinc-400">
        Review-first animation assistant. Suggests editable keyframe tracks based on your scene action description.
        Manual animation editing works without AI credentials.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="ai-anim-action">
            Animation Directive
          </label>
          <select
            id="ai-anim-action"
            className={fieldClass}
            value={action}
            onChange={(e) => setAction(e.target.value as AnimationAIAction)}
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="ai-anim-tone">
            Target Tone / Emotion
          </label>
          <input
            id="ai-anim-tone"
            className={fieldClass}
            value={targetTone}
            onChange={(e) => setTargetTone(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass} htmlFor="ai-anim-instructions">
            Additional Instructions (Optional)
          </label>
          <input
            id="ai-anim-instructions"
            className={fieldClass}
            placeholder="e.g. Keep movements subtle, start from center and pan towards right"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={() => void generate()}
        disabled={busy}
      >
        {busy && !proposal ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Generate Suggestions
      </Button>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {proposal && (
        <div className="space-y-3 border-t border-zinc-800 pt-3">
          <div className="rounded-lg bg-zinc-950/80 p-3">
            <p className="text-xs font-semibold text-violet-300">
              {proposal.summary_of_suggestions}
            </p>
            {proposal.explanation && (
              <p className="mt-1 text-[11px] text-zinc-400">
                {proposal.explanation}
              </p>
            )}
            {proposal.suggested_preset_id && (
              <p className="mt-1 text-[11px] text-amber-300">
                Suggested motion preset:{" "}
                <span className="font-semibold">{proposal.suggested_preset_id}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Proposed Object Tracks ({proposal.proposed_tracks.length})
            </h3>
            {proposal.proposed_tracks.map((t) => renderTrackItem(t, false))}

            {proposal.proposed_camera_tracks.length > 0 && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 pt-2">
                  Proposed Camera Tracks ({proposal.proposed_camera_tracks.length})
                </h3>
                {proposal.proposed_camera_tracks.map((t) => renderTrackItem(t, true))}
              </>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-amber-300 pt-1">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            Overwrite existing keyframes on colliding properties
          </label>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void apply()}
              disabled={busy || acceptedTrackIds.size === 0}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Apply Accepted Tracks ({acceptedTrackIds.size})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setProposal(null)}
              disabled={busy}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
