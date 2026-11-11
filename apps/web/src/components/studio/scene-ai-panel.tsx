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
  ProposedSceneItem,
  ProposedShotItem,
  SceneAIApplyProposalPayload,
  SceneAIGenerationAction,
  SceneAIGenerationProposalRecord,
} from "@tr-studio/shared-types";

export type SceneAIMode = "scenes" | "shots" | "scene-assist";

const ASSIST_ACTIONS: { value: SceneAIGenerationAction; label: string }[] = [
  { value: "rewrite_scene_tone", label: "Rewrite description in a tone" },
  { value: "suggest_visual_direction", label: "Suggest visual direction" },
  { value: "suggest_environments", label: "Suggest environments" },
  { value: "suggest_characters", label: "Suggest characters" },
];

/**
 * Review-first AI assistant. Nothing is saved until the user accepts individual
 * suggestions. Provider errors (missing key, timeout, rate limit, bad output)
 * are shown verbatim from the API.
 */
export function SceneAIPanel({
  projectId,
  mode,
  sceneId,
  onApplied,
  onClose,
}: {
  projectId: string;
  mode: SceneAIMode;
  sceneId?: string;
  onApplied: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [assistAction, setAssistAction] = useState<SceneAIGenerationAction>("rewrite_scene_tone");
  const [sectionText, setSectionText] = useState("");
  const [count, setCount] = useState(6);
  const [tone, setTone] = useState("Cinematic");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<SceneAIGenerationProposalRecord | null>(null);

  const [scenes, setScenes] = useState<ProposedSceneItem[]>([]);
  const [shots, setShots] = useState<ProposedShotItem[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [replaceShots, setReplaceShots] = useState(false);
  const [rewrite, setRewrite] = useState("");
  const [textChoices, setTextChoices] = useState<string[]>([]);

  const action: SceneAIGenerationAction =
    mode === "scenes" ? "convert_story_to_scenes" : mode === "shots" ? "generate_shot_list" : assistAction;

  const generate = async () => {
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const res = await api.sceneBuilder.generateAIProposal(projectId, {
        action,
        scene_id: sceneId ?? null,
        story_section_text: sectionText.trim() || undefined,
        target_tone: action === "rewrite_scene_tone" ? tone : undefined,
        desired_count: count,
        instructions: instructions.trim() || undefined,
        apply_immediately: false,
      });
      setProposal(res);
      setScenes(res.proposed_scenes);
      setShots(res.proposed_shots);
      setRewrite(res.rewritten_description ?? "");
      const choices =
        action === "suggest_visual_direction"
          ? res.suggested_visual_directions
          : action === "suggest_environments"
            ? res.suggested_environments
            : action === "suggest_characters"
              ? res.suggested_characters
              : [];
      setTextChoices(choices);
      setAccepted(
        new Set([
          ...res.proposed_scenes.map((s) => s.id),
          ...res.proposed_shots.map((s) => s.id),
          ...(action === "rewrite_scene_tone" && res.rewritten_description ? ["rewrite"] : []),
        ])
      );
    } catch (err) {
      setError(errorMessage(err, "AI generation failed."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload: SceneAIApplyProposalPayload = { action, scene_id: sceneId ?? null };
      if (mode === "scenes") {
        payload.accepted_scenes = scenes.filter((s) => accepted.has(s.id));
      } else if (mode === "shots") {
        payload.accepted_shots = shots.filter((s) => accepted.has(s.id));
        payload.replace_existing_shots = replaceShots;
      } else if (action === "rewrite_scene_tone") {
        if (accepted.has("rewrite")) payload.accepted_description = rewrite;
      } else if (action === "suggest_visual_direction") {
        payload.accepted_visual_directions = textChoices.filter((_, i) => accepted.has(`t${i}`));
      } else if (action === "suggest_environments") {
        payload.accepted_environment_name = textChoices.find((_, i) => accepted.has(`t${i}`));
      } else if (action === "suggest_characters") {
        payload.accepted_characters = textChoices.filter((_, i) => accepted.has(`t${i}`));
      }
      await api.sceneBuilder.applyAIProposal(projectId, payload);
      await onApplied();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Failed to apply suggestions."));
    } finally {
      setBusy(false);
    }
  };

  const nothingAccepted = accepted.size === 0;

  return (
    <section
      aria-label="AI scene assistant"
      className="space-y-4 rounded-xl border border-violet-500/30 bg-violet-950/10 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-violet-400" />
          AI{" "}
          {mode === "scenes" ? "Scene Breakdown" : mode === "shots" ? "Shot-List Generator" : "Scene Assistant"}
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close AI assistant">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-zinc-400">
        Suggestions are shown for review first. Nothing is saved until you accept and apply.
        Requires a configured AI provider key; manual editing works without one.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {mode === "scene-assist" && (
          <div>
            <label className={labelClass} htmlFor="ai-action">Assistant action</label>
            <select
              id="ai-action"
              className={fieldClass}
              value={assistAction}
              onChange={(e) => setAssistAction(e.target.value as SceneAIGenerationAction)}
            >
              {ASSIST_ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
        )}
        {action === "rewrite_scene_tone" && (
          <div>
            <label className={labelClass} htmlFor="ai-tone">Target tone</label>
            <input id="ai-tone" className={fieldClass} value={tone} onChange={(e) => setTone(e.target.value)} />
          </div>
        )}
        {(mode === "scenes" || mode === "shots") && (
          <div>
            <label className={labelClass} htmlFor="ai-count">
              {mode === "scenes" ? "Number of scenes" : "Number of shots"}
            </label>
            <input
              id="ai-count"
              type="number"
              min={1}
              max={20}
              className={fieldClass}
              value={count}
              onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
        )}
        {mode === "scenes" && (
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="ai-section">
              Story section (optional — leave empty to use the whole story)
            </label>
            <textarea id="ai-section" rows={3} className={fieldClass} value={sectionText} onChange={(e) => setSectionText(e.target.value)} />
          </div>
        )}
        <div className="md:col-span-2">
          <label className={labelClass} htmlFor="ai-instructions">Extra instructions (optional)</label>
          <input id="ai-instructions" className={fieldClass} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>
      </div>

      <Button type="button" size="sm" onClick={() => void generate()} disabled={busy}>
        {busy && !proposal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Generate suggestions
      </Button>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {proposal && (
        <div className="space-y-3 border-t border-zinc-800 pt-3">
          <p className="text-xs text-zinc-300">{proposal.summary_of_suggestions}</p>

          {scenes.map((s) => (
            <div key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={accepted.has(s.id)} onChange={() => toggle(s.id)} />
                Accept scene {s.scene_number}
              </label>
              <input
                aria-label={`Title for proposed scene ${s.scene_number}`}
                className={`${fieldClass} mt-2`}
                value={s.title}
                onChange={(e) => setScenes((prev) => prev.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
              />
              <textarea
                aria-label={`Summary for proposed scene ${s.scene_number}`}
                rows={2}
                className={`${fieldClass} mt-2`}
                value={s.summary}
                onChange={(e) => setScenes((prev) => prev.map((x) => (x.id === s.id ? { ...x, summary: e.target.value } : x)))}
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                {s.location_name || "No location"} · {s.duration_seconds}s · {s.transition_type || "Cut"}
                {s.suggested_characters.length > 0 && ` · ${s.suggested_characters.join(", ")}`}
              </p>
            </div>
          ))}

          {shots.map((s) => (
            <div key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={accepted.has(s.id)} onChange={() => toggle(s.id)} />
                Accept shot {s.shot_number} ({s.shot_type})
              </label>
              <input
                aria-label={`Title for proposed shot ${s.shot_number}`}
                className={`${fieldClass} mt-2`}
                value={s.title}
                onChange={(e) => setShots((prev) => prev.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
              />
              <textarea
                aria-label={`Description for proposed shot ${s.shot_number}`}
                rows={2}
                className={`${fieldClass} mt-2`}
                value={s.description}
                onChange={(e) => setShots((prev) => prev.map((x) => (x.id === s.id ? { ...x, description: e.target.value } : x)))}
              />
            </div>
          ))}
          {mode === "shots" && shots.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-amber-300">
              <input type="checkbox" checked={replaceShots} onChange={(e) => setReplaceShots(e.target.checked)} />
              Replace existing shots (otherwise accepted shots are appended)
            </label>
          )}

          {action === "rewrite_scene_tone" && proposal.rewritten_description && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={accepted.has("rewrite")} onChange={() => toggle("rewrite")} />
                Replace scene description with this rewrite
              </label>
              <textarea
                aria-label="Rewritten description"
                rows={4}
                className={`${fieldClass} mt-2`}
                value={rewrite}
                onChange={(e) => setRewrite(e.target.value)}
              />
            </div>
          )}

          {textChoices.map((t, i) => (
            <label key={`${t}-${i}`} className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200">
              <input type="checkbox" checked={accepted.has(`t${i}`)} onChange={() => toggle(`t${i}`)} />
              <span>{t}</span>
            </label>
          ))}

          {proposal.suggested_transition && (
            <p className="text-xs text-zinc-400">Suggested transition: {proposal.suggested_transition}</p>
          )}

          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void apply()} disabled={busy || nothingAccepted}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Apply accepted ({accepted.size})
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setProposal(null)} disabled={busy}>
              Reject all
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
