"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  Clock,
  FileEdit,
  Globe,
  Layers,
  Loader2,
  Sparkles,
  Users,
  Wand2,
  XCircle,
} from "lucide-react";
import {
  ANIMATION_STYLES,
  STORY_COMPLEXITIES,
  STORY_DURATIONS,
  STORY_ENDINGS,
  STORY_GENRES,
  STORY_LANGUAGES,
  STORY_TONES,
  TARGET_AUDIENCES,
} from "@tr-studio/scene-schema";
import type { AIProviderStatusResponse } from "@tr-studio/shared-types";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type GenerationState =
  | "idle"
  | "waiting"
  | "generating"
  | "validating"
  | "completed"
  | "failed";

interface StoryCreationFormProps {
  projectId?: string;
  onStoryCreated?: (projectId: string, storyId: string) => void;
}

const selectClass =
  "flex min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus-visible:border-indigo-400";

export function StoryCreationForm({
  projectId,
  onStoryCreated,
}: StoryCreationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [idea, setIdea] = useState(
    searchParams.get("idea") ||
      "A young apprentice clockmaker in an abandoned sky citadel discovers an ancient astral grimoire that reconnects fractured floating islands."
  );
  const [title, setTitle] = useState(searchParams.get("title") || "");
  const [genre, setGenre] = useState<string>("Fantasy");
  const [customGenre, setCustomGenre] = useState("");
  const [animationStyle, setAnimationStyle] = useState<string>("Anime");
  const [customAnimationStyle, setCustomAnimationStyle] = useState("");
  const [targetAudience, setTargetAudience] = useState<string>("Everyone");
  const [durationSelection, setDurationSelection] = useState<string>("5");
  const [customDuration, setCustomDuration] = useState<number>(8);
  const [language, setLanguage] = useState<string>("English");
  const [customLanguage, setCustomLanguage] = useState("");
  const [mainCharacterCount, setMainCharacterCount] = useState<number>(3);
  const [tone, setTone] = useState<string>("Emotional");
  const [complexity, setComplexity] = useState<string>("Detailed");
  const [endingType, setEndingType] = useState<string>("AI decides");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  const [aiStatus, setAiStatus] = useState<AIProviderStatusResponse | null>(null);
  const [generationState, setGenerationState] = useState<GenerationState>("idle");
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.stories
      .aiStatus()
      .then(setAiStatus)
      .catch(() => setAiStatus(null));
  }, []);

  const resolvedDurationMinutes =
    durationSelection === "custom"
      ? Math.max(1, Math.min(120, Number(customDuration) || 5))
      : Number(durationSelection) || 5;

  const isBusy = generationState === "waiting" || generationState === "generating" || generationState === "validating" || isCreatingManual;

  const handleGenerateWithAI = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isBusy) return; // Prevent duplicate submissions

    if (idea.trim().length < 10) {
      setError("Please enter a story idea of at least 10 characters.");
      return;
    }

    setGenerationState("waiting");
    setError(null);

    try {
      // Transition to actual generating state as request is dispatched
      setGenerationState("generating");

      const created = await api.stories.generate({
        project_id: projectId,
        idea: idea.trim(),
        title: title.trim() || undefined,
        genre,
        custom_genre: genre === "Custom" ? customGenre.trim() : undefined,
        animation_style: animationStyle,
        custom_animation_style:
          animationStyle === "Custom" ? customAnimationStyle.trim() : undefined,
        target_audience: targetAudience,
        duration_minutes: resolvedDurationMinutes,
        language,
        custom_language:
          language === "Other supported languages"
            ? customLanguage.trim()
            : undefined,
        main_character_count: mainCharacterCount,
        tone,
        complexity,
        ending_type: endingType,
        additional_instructions: additionalInstructions.trim() || undefined,
      });

      // Validating and finalizing state
      setGenerationState("validating");

      // Short delay to let state render before redirecting
      setTimeout(() => {
        setGenerationState("completed");
        if (onStoryCreated) {
          onStoryCreated(created.project_id, created.id);
        } else {
          router.push(`/studio/${created.project_id}`);
        }
      }, 300);
    } catch (err) {
      setGenerationState("failed");
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to generate story. Please check backend connection or AI API key configuration.");
      }
    }
  };

  const handleStartManualStory = async () => {
    if (isBusy) return;
    if (idea.trim().length < 5) {
      setError("Please enter a brief story idea before starting manual mode.");
      return;
    }

    setIsCreatingManual(true);
    setError(null);

    try {
      const resolvedGenre =
        genre === "Custom" && customGenre.trim() ? customGenre.trim() : genre;
      const resolvedStyle =
        animationStyle === "Custom" && customAnimationStyle.trim()
          ? customAnimationStyle.trim()
          : animationStyle;
      const resolvedLang =
        language === "Other supported languages" && customLanguage.trim()
          ? customLanguage.trim()
          : language;

      const created = await api.stories.createManual({
        project_id: projectId,
        idea: idea.trim(),
        title: title.trim() || "Untitled Animated Story",
        genre: resolvedGenre,
        animation_style: resolvedStyle,
        target_audience: targetAudience,
        duration_minutes: resolvedDurationMinutes,
        language: resolvedLang,
        main_character_count: mainCharacterCount,
        tone,
        complexity,
        ending_type: endingType,
        additional_instructions: additionalInstructions.trim() || undefined,
      });

      if (onStoryCreated) {
        onStoryCreated(created.project_id, created.id);
      } else {
        router.push(`/studio/${created.project_id}`);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Could not initialize manual story workspace.");
      }
    } finally {
      setIsCreatingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Provider Status Banner */}
      {aiStatus && (
        <div
          className={`flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
            aiStatus.configured
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {aiStatus.configured ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div className="space-y-0.5 text-xs">
              <p className="font-semibold text-zinc-900 dark:text-white">
                {aiStatus.configured
                  ? `AI Story Provider Connected (${aiStatus.provider.toUpperCase()} • ${aiStatus.model})`
                  : "AI Provider API Key Not Configured — Manual Mode & Config Check Ready"}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">{aiStatus.message}</p>
            </div>
          </div>
          <Badge variant={aiStatus.configured ? "success" : "warning"}>
            {aiStatus.configured ? "Live AI Ready" : "Manual Mode Active"}
          </Badge>
        </div>
      )}

      {/* Honest Actual Generation State Banner */}
      {generationState !== "idle" && (
        <div
          className={`rounded-xl border p-4 text-xs transition-all ${
            generationState === "failed"
              ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
              : generationState === "completed"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {generationState === "failed" ? (
              <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : generationState === "completed" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
            )}
            <div>
              <p className="font-bold text-sm">
                {generationState === "waiting" && "Waiting: Submitting generation request to backend..."}
                {generationState === "generating" && "Generating: AI is crafting 3-act narrative, characters, scenes & screenplay..."}
                {generationState === "validating" && "Validating: Verifying schema v1.0 and persisting to project vault..."}
                {generationState === "completed" && "Completed: Story created successfully! Redirecting to studio workspace..."}
                {generationState === "failed" && "Failed: Generation could not be completed."}
              </p>
              <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                {generationState === "generating" && "Calling Gemini model generateContent with structured story instructions."}
                {generationState === "validating" && "Ensuring UUID normalization and relational consistency."}
                {generationState === "failed" && (error || "Check your network connection and backend AI credentials.")}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && generationState !== "failed" && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
        >
          <p className="font-bold">Story Creation Notice</p>
          <p className="mt-1 leading-relaxed">{error}</p>
        </div>
      )}

      <form onSubmit={handleGenerateWithAI} className="space-y-6">
        {/* 1 & 2: Core Story Idea & Title */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Wand2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base">
                1. Core Premise & Story Concept
              </CardTitle>
            </div>
            <CardDescription>
              Describe your animated story idea. The engine expands it into a complete 3-act narrative, character motivations, and screenplay beats.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="story-idea">
                Story Idea <span aria-hidden="true" className="text-indigo-600 dark:text-indigo-400">*</span>
              </Label>
              <Textarea
                id="story-idea"
                name="idea"
                required
                minLength={10}
                rows={4}
                placeholder="e.g., A young apprentice clockmaker in an abandoned sky citadel discovers an ancient astral grimoire that reconnects fractured floating islands..."
                value={idea}
                onChange={(e) => {
                  setIdea(e.target.value);
                  if (error) setError(null);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="story-title">
                Story Title{" "}
                <span className="text-xs font-normal text-zinc-400">
                  (Optional — AI will suggest one if left blank)
                </span>
              </Label>
              <Input
                id="story-title"
                name="title"
                maxLength={255}
                placeholder="e.g., The Astral Clocktower"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 3, 4, 5: Genre, Animation Style, Target Audience */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Clapperboard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base">
                2. Genre, Visual Style & Audience
              </CardTitle>
            </div>
            <CardDescription>
              Configure visual aesthetics and audience framing for your animated production.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="story-genre">3. Genre</Label>
              <select
                id="story-genre"
                name="genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className={selectClass}
              >
                {STORY_GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {genre === "Custom" && (
                <Input
                  aria-label="Custom genre"
                  placeholder="Enter custom genre..."
                  value={customGenre}
                  onChange={(e) => setCustomGenre(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="story-style">4. Animation Style</Label>
              <select
                id="story-style"
                name="animation_style"
                value={animationStyle}
                onChange={(e) => setAnimationStyle(e.target.value)}
                className={selectClass}
              >
                {ANIMATION_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
              {animationStyle === "Custom" && (
                <Input
                  aria-label="Custom animation style"
                  placeholder="Enter custom animation style..."
                  value={customAnimationStyle}
                  onChange={(e) => setCustomAnimationStyle(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="story-audience">5. Target Audience</Label>
              <select
                id="story-audience"
                name="target_audience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className={selectClass}
              >
                {TARGET_AUDIENCES.map((aud) => (
                  <option key={aud} value={aud}>
                    {aud}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* 6, 7, 8: Duration, Language, Number of Main Characters */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base">
                3. Runtime, Language & Cast Size
              </CardTitle>
            </div>
            <CardDescription>
              Control episode pacing, dialogue language, and main character cast size.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="story-duration">6. Story Duration</Label>
              <select
                id="story-duration"
                name="duration"
                value={durationSelection}
                onChange={(e) => setDurationSelection(e.target.value)}
                className={selectClass}
              >
                {STORY_DURATIONS.map((mins) => (
                  <option key={mins} value={String(mins)}>
                    {mins} {mins === 1 ? "minute" : "minutes"}
                  </option>
                ))}
                <option value="custom">Custom Duration</option>
              </select>
              {durationSelection === "custom" && (
                <Input
                  type="number"
                  min={1}
                  max={120}
                  aria-label="Custom duration in minutes"
                  placeholder="Minutes (1–120)"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(Number(e.target.value))}
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="story-language" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                7. Language
              </Label>
              <select
                id="story-language"
                name="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={selectClass}
              >
                {STORY_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              {language === "Other supported languages" && (
                <Input
                  aria-label="Custom language"
                  placeholder="e.g., French, Korean, German..."
                  value={customLanguage}
                  onChange={(e) => setCustomLanguage(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="story-char-count" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                8. Number of Main Characters ({mainCharacterCount})
              </Label>
              <Input
                id="story-char-count"
                name="main_character_count"
                type="number"
                min={1}
                max={12}
                value={mainCharacterCount}
                onChange={(e) =>
                  setMainCharacterCount(
                    Math.max(1, Math.min(12, Number(e.target.value) || 1))
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* 9, 10, 11, 12: Tone, Complexity, Ending, Additional Instructions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base">
                4. Narrative Tone, Complexity & Ending Direction
              </CardTitle>
            </div>
            <CardDescription>
              Shape emotional resonance, plot intricacy, and how the story concludes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="story-tone">9. Story Tone</Label>
                <select
                  id="story-tone"
                  name="tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className={selectClass}
                >
                  {STORY_TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="story-complexity">10. Story Complexity</Label>
                <select
                  id="story-complexity"
                  name="complexity"
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value)}
                  className={selectClass}
                >
                  {STORY_COMPLEXITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="story-ending">11. Ending Preference</Label>
                <select
                  id="story-ending"
                  name="ending_type"
                  value={endingType}
                  onChange={(e) => setEndingType(e.target.value)}
                  className={selectClass}
                >
                  {STORY_ENDINGS.map((end) => (
                    <option key={end} value={end}>
                      {end}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additional-instructions">
                12. Additional Instructions{" "}
                <span className="text-xs font-normal text-zinc-400">
                  (Optional camera motifs, character quirks, cultural notes, or specific plot beats)
                </span>
              </Label>
              <Textarea
                id="additional-instructions"
                name="additional_instructions"
                rows={3}
                placeholder="e.g., Include a wise talking companion, emphasize golden hour lighting in Act I, and end Scene 2 on a cliffhanger..."
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Bar */}
        <div className="flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 sm:flex-row sm:items-center shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/70">
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-zinc-900 dark:text-white">
              Ready to generate your screenplay?
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Generate with AI or initialize an empty structured screenplay workspace to write manually.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="default"
              disabled={isBusy}
              onClick={handleStartManualStory}
              className="gap-2"
            >
              {isCreatingManual ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Initializing...</span>
                </>
              ) : (
                <>
                  <FileEdit className="h-4 w-4" />
                  <span>Create Manually in Editor</span>
                </>
              )}
            </Button>

            <Button
              type="submit"
              size="default"
              disabled={isBusy}
              className="gap-2 shadow-xs"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {generationState === "waiting" && "Waiting..."}
                    {generationState === "generating" && "Generating Story..."}
                    {generationState === "validating" && "Validating..."}
                    {generationState === "completed" && "Completed!"}
                    {generationState === "idle" && "Working..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Story with AI</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
