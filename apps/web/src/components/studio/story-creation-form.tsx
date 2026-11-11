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

const WORKFLOW_STEPS = [
  "Step 1–2: Validating story idea & studio parameters",
  "Step 3: Generating structured 3-act story plan & themes",
  "Step 4–5: Designing characters, relationships & world locations",
  "Step 6–8: Writing scene breakdowns, screenplay dialogue & camera directions",
  "Step 9–10: Validating schema v1.0 & saving to PostgreSQL project vault",
];

interface StoryCreationFormProps {
  projectId?: string;
  onStoryCreated?: (projectId: string, storyId: string) => void;
}

export function StoryCreationForm({
  projectId,
  onStoryCreated,
}: StoryCreationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [idea, setIdea] = useState(
    searchParams.get("idea") ||
      "A young boy discovers a magical book in an abandoned village and gets transported into a fantasy world."
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [activeWorkflowIdx, setActiveWorkflowIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.stories
      .aiStatus()
      .then(setAiStatus)
      .catch(() => setAiStatus(null));
  }, []);

  useEffect(() => {
    if (!isGenerating) {
      setActiveWorkflowIdx(0);
      return;
    }
    const timer = window.setInterval(() => {
      setActiveWorkflowIdx((prev) =>
        prev < WORKFLOW_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 2400);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  const resolvedDurationMinutes =
    durationSelection === "custom"
      ? Math.max(1, Math.min(120, Number(customDuration) || 5))
      : Number(durationSelection) || 5;

  const handleGenerateWithAI = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (idea.trim().length < 10) {
      setError("Please enter a story idea of at least 10 characters.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
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

      if (onStoryCreated) {
        onStoryCreated(created.project_id, created.id);
      } else {
        router.push(`/studio/${created.project_id}`);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to generate story. Check backend connection.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartManualStory = async () => {
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
        setError("Could not initialize manual story.");
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
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {aiStatus.configured ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            )}
            <div className="space-y-0.5 text-xs">
              <p className="font-semibold text-white">
                {aiStatus.configured
                  ? `AI Story Provider Connected (${aiStatus.provider.toUpperCase()} • ${aiStatus.model})`
                  : "AI Provider API Key Not Configured — Honest Manual Mode Ready"}
              </p>
              <p className="text-zinc-300">{aiStatus.message}</p>
            </div>
          </div>
          <Badge variant={aiStatus.configured ? "success" : "warning"}>
            {aiStatus.configured ? "Live AI Ready" : "Manual & Config Check"}
          </Badge>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
        >
          <p className="font-semibold text-red-100">Story Creation Notice</p>
          <p className="mt-1 text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {/* 10-Step Progress Tracker when Generating */}
      {isGenerating && (
        <Card className="border-violet-500/40 bg-violet-950/20">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
              <div>
                <p className="text-sm font-semibold text-white">
                  AI Story Creation Engine Running...
                </p>
                <p className="text-xs text-violet-300">
                  {WORKFLOW_STEPS[activeWorkflowIdx]}
                </p>
              </div>
            </div>
            <progress
              value={(activeWorkflowIdx + 1) * 20}
              max={100}
              className="h-2 w-full overflow-hidden rounded-full bg-zinc-800 accent-violet-500"
            />
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleGenerateWithAI} className="space-y-6">
        {/* 1 & 2: Core Story Idea & Title */}
        <Card className="border-zinc-800/90 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Wand2 className="h-5 w-5 text-violet-400" />
              <CardTitle className="text-base">
                1. Core Premise & Story Concept
              </CardTitle>
            </div>
            <CardDescription>
              Describe your animated story idea in a sentence or paragraph. TR
              STUDIO will expand it into a complete 3-act narrative, character
              bible, locations, and scene-by-scene screenplay.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="story-idea">
                Story Idea <span aria-hidden="true" className="text-violet-400">*</span>
              </Label>
              <Textarea
                id="story-idea"
                name="idea"
                required
                minLength={10}
                rows={4}
                placeholder="e.g., A young boy discovers a magical book in an abandoned village and gets transported into a fantasy world..."
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
                placeholder="e.g., The Chronicle of Emberfall"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 3, 4, 5: Genre, Animation Style, Target Audience */}
        <Card className="border-zinc-800/90 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Clapperboard className="h-5 w-5 text-violet-400" />
              <CardTitle className="text-base">
                2. Genre, Visual Style & Audience
              </CardTitle>
            </div>
            <CardDescription>
              Configure visual aesthetics and audience framing for your animated
              production.
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
                className="flex min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 focus-visible:border-violet-500 focus-visible:outline-none"
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
                className="flex min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 focus-visible:border-violet-500 focus-visible:outline-none"
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
                className="flex min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 focus-visible:border-violet-500 focus-visible:outline-none"
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
        <Card className="border-zinc-800/90 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Clock className="h-5 w-5 text-violet-400" />
              <CardTitle className="text-base">
                3. Runtime, Language & Cast Size
              </CardTitle>
            </div>
            <CardDescription>
              Control episode pacing, dialogue language, and main character cast
              size.
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
                className="flex min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 focus-visible:border-violet-500 focus-visible:outline-none"
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
                <Globe className="h-3.5 w-3.5 text-violet-400" />
                7. Language
              </Label>
              <select
                id="story-language"
                name="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="flex min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 focus-visible:border-violet-500 focus-visible:outline-none"
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
                <Users className="h-3.5 w-3.5 text-violet-400" />
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
        <Card className="border-zinc-800/90 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Layers className="h-5 w-5 text-violet-400" />
              <CardTitle className="text-base">
                4. Narrative Tone, Complexity & Ending Direction
              </CardTitle>
            </div>
            <CardDescription>
              Shape emotional resonance, plot intricacy, and how the story
              concludes.
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
                  className="flex min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 focus-visible:border-violet-500 focus-visible:outline-none"
                >
                  {STORY_TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-zinc-200">
                  10. Story Complexity
                </legend>
                <div className="grid grid-cols-3 gap-2 pt-0.5">
                  {STORY_COMPLEXITIES.map((comp) => {
                    const active = complexity === comp;
                    return (
                      <label
                        key={comp}
                        htmlFor={`comp-${comp}`}
                        className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-violet-500 bg-violet-500/20 text-white"
                            : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <input
                          type="radio"
                          id={`comp-${comp}`}
                          name="complexity"
                          value={comp}
                          checked={active}
                          onChange={() => setComplexity(comp)}
                          className="visually-hidden"
                        />
                        {comp}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="story-ending">11. Ending Preference</Label>
                <select
                  id="story-ending"
                  name="ending_type"
                  value={endingType}
                  onChange={(e) => setEndingType(e.target.value)}
                  className="flex min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 focus-visible:border-violet-500 focus-visible:outline-none"
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
                  (Optional camera motifs, character quirks, cultural notes, or
                  specific plot beats)
                </span>
              </Label>
              <Textarea
                id="additional-instructions"
                name="additional_instructions"
                rows={3}
                placeholder="e.g., Include a wise talking owl companion, emphasize warm sunset lighting in Act I, and end Scene 2 on a cliffhanger..."
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Bar */}
        <div className="flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-5 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              Ready to create your animated screenplay?
            </p>
            <p className="text-xs text-zinc-400">
              Generate with AI (when configured) or initialize a structured
              manual screenplay workspace immediately.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isGenerating || isCreatingManual}
              onClick={handleStartManualStory}
            >
              {isCreatingManual ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <FileEdit className="h-4 w-4" />
                  Create Manually in Editor
                </>
              )}
            </Button>

            <Button
              type="submit"
              size="lg"
              disabled={isGenerating || isCreatingManual}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Story...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Story with AI
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
