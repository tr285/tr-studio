"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Compass,
  Cpu,
  Eye,
  Film,
  Globe,
  Headphones,
  Layers,
  Mic,
  Maximize2,
  Music,
  Palette,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Video,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Describe your idea",
    desc: "Type a premise, logline or rough thought in any genre or tone.",
    tag: "Ideation",
  },
  {
    step: "02",
    title: "Create your story",
    desc: "Generate structured 3-act arcs, screenplay scenes and character dialogue.",
    tag: "Screenplay",
  },
  {
    step: "03",
    title: "Design characters",
    desc: "Establish visual turnarounds, personalities, facial expressions and outfits.",
    tag: "Character Studio",
  },
  {
    step: "04",
    title: "Build worlds",
    desc: "Generate layered parallax environments with day/dusk/night lighting.",
    tag: "Environments",
  },
  {
    step: "05",
    title: "Create scenes",
    desc: "Block camera angles, shot compositions, action staging and emotional beats.",
    tag: "Storyboard",
  },
  {
    step: "06",
    title: "Animate",
    desc: "Interpolate keyframes, bezier motion paths and camera movements smoothly.",
    tag: "2D Engine",
  },
  {
    step: "07",
    title: "Add voices and music",
    desc: "Synthesize character dialogue, generate sound effects and layer music.",
    tag: "Audio Studio",
  },
  {
    step: "08",
    title: "Export your film",
    desc: "Render broadcast-ready MP4 videos via hardware-accelerated FFmpeg.",
    tag: "Render Pipeline",
  },
];

const STUDIO_FEATURES = [
  {
    icon: Wand2,
    title: "AI Story & Screenplay Engine",
    desc: "Architect complete 3-act narrative arcs, scene breakdowns, character relationships, and cinematic screenplay dialogue conforming to versioned schemas.",
    badge: "Step 2 Engine",
  },
  {
    icon: Users,
    title: "Character Creation Studio",
    desc: "Design characters with multiple facial expressions, outfits, pose variations, and relational dynamics saved directly into your project vault.",
    badge: "Step 3 Engine",
  },
  {
    icon: Globe,
    title: "World & Environment Studio",
    desc: "Create immersive multi-layered environments with weather effects, atmospheric lighting, and parallax coordinates ready for timeline staging.",
    badge: "Step 4 Engine",
  },
  {
    icon: Layers,
    title: "Scene Builder & Storyboard",
    desc: "Arrange camera framing, camera pans, actor staging, and shot continuity with automatic sync between screenplay text and visual scenes.",
    badge: "Step 5 Engine",
  },
  {
    icon: Film,
    title: "Professional 2D Animation",
    desc: "Precision timeline with deterministic bezier interpolation, keyframe manipulation, easing presets, and camera target tracking at 24/30/60 FPS.",
    badge: "Step 6 & 7 Engine",
  },
  {
    icon: Headphones,
    title: "Dialogue, Voice & Audio Studio",
    desc: "Synthesize character voices, align subtitles with timecode accuracy, and mix background audio tracks with volume envelope curves.",
    badge: "Step 8 Engine",
  },
];

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="min-h-screen bg-white text-zinc-900 transition-colors dark:bg-[#0c0c0e] dark:text-zinc-100">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#0c0c0e]/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs transition-transform group-hover:scale-105">
              <Clapperboard className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold tracking-tight text-zinc-900 dark:text-white">
                TR STUDIO
              </span>
              <span className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                Imagine Anything. Create Everything.
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-600 dark:text-zinc-300 md:flex">
            <a href="#workflow" className="transition-colors hover:text-zinc-900 dark:hover:text-white">
              Workflow
            </a>
            <a href="#showcase" className="transition-colors hover:text-zinc-900 dark:hover:text-white">
              Studio Workspace
            </a>
            <a href="#features" className="transition-colors hover:text-zinc-900 dark:hover:text-white">
              Features
            </a>
            <a href="#pricing" className="transition-colors hover:text-zinc-900 dark:hover:text-white">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle className="h-9 w-9" />
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard" className="gap-1.5">
                <span>Start Creating</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
        {/* Subtle radial ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        >
          <div className="relative left-[calc(50%-11rem)] aspect-1155/678 w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-200 to-purple-100 opacity-60 dark:from-indigo-900/30 dark:to-purple-900/20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/70 px-3.5 py-1 text-xs font-semibold text-indigo-700 shadow-2xs dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            <span>The Professional Animated Story Studio</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-6xl md:text-7xl max-w-4xl mx-auto leading-[1.08]">
            Your imagination. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              Your animated universe.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Turn your ideas into stories, characters, animated scenes and cinematic videos — all inside one creative studio.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Button size="lg" asChild className="w-full sm:w-auto text-base gap-2 px-7">
              <Link href="/dashboard">
                <span>Start Creating</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto text-base">
              <a href="#showcase">
                <Compass className="h-4 w-4 mr-2 text-zinc-500" />
                Explore Studio
              </a>
            </Button>
          </div>

          {/* Trust points */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Deterministic 2D Keyframing
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Multi-Track Synchronized Audio
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Hardware-Accelerated FFmpeg MP4
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Google Gemini API Native Integration
            </span>
          </div>
        </div>
      </section>

      {/* 3. Creative Studio Showcase (Linearity 4-Pane Studio Layout Visualizer) */}
      <section id="showcase" className="py-12 border-y border-zinc-200/80 bg-zinc-50/70 dark:border-zinc-800/80 dark:bg-zinc-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <Badge variant="outline" className="mb-2">
              Next-Gen Studio Workspace
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              A studio engineered for visual storytellers
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Left sidebar navigation, center stage preview with zoom & playback, right inspector properties, and bottom multi-track timeline.
            </p>
          </div>

          {/* Studio Simulation Container */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900/90">
            {/* Top Workspace Header */}
            <div className="flex h-11 items-center justify-between border-b border-zinc-200/80 px-4 text-xs dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-950/60">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  The Astral Clocktower • Scene 04 (Climax)
                </span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Autosaved
                </span>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500">
                <span>00:04.12 / 00:15.00</span>
                <span>24 FPS</span>
                <span>1920 × 1080</span>
                <Button size="sm" variant="default" className="h-7 text-xs px-2.5 gap-1">
                  <Play className="h-3 w-3 fill-current" />
                  <span>Preview</span>
                </Button>
              </div>
            </div>

            {/* Studio Body: Left Sidebar + Center Stage + Right Inspector */}
            <div className="grid grid-cols-12 min-h-[420px]">
              {/* Left Toolbar */}
              <div className="hidden sm:flex col-span-2 flex-col border-r border-zinc-200/80 p-3 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-1">
                {[
                  { name: "Story & Script", icon: Wand2, active: false },
                  { name: "Characters", icon: Users, active: false },
                  { name: "Environments", icon: Globe, active: false },
                  { name: "Scenes & Board", icon: Layers, active: false },
                  { name: "2D Animation", icon: Film, active: true },
                  { name: "Voice & Audio", icon: Headphones, active: false },
                  { name: "Render & Export", icon: Video, active: false },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.name}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer transition-colors ${
                        item.active
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{item.name}</span>
                    </div>
                  );
                })}
              </div>

              {/* Center Canvas */}
              <div className="col-span-12 sm:col-span-7 relative flex flex-col items-center justify-center p-6 bg-zinc-100/70 dark:bg-[#0a0a0c]">
                {/* Canvas viewport */}
                <div className="relative aspect-video w-full max-w-[540px] rounded-lg border border-zinc-300/80 bg-zinc-950 shadow-md overflow-hidden dark:border-zinc-700">
                  {/* Visual mockup of anime scene */}
                  <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/80 via-purple-900/40 to-black/90 flex flex-col justify-between p-4">
                    {/* Scene camera safe zone guide */}
                    <div className="border border-dashed border-white/20 rounded h-full w-full relative flex items-center justify-center">
                      {/* Character avatar staging representation */}
                      <div className="text-center space-y-2">
                        <div className="inline-block p-3 rounded-full bg-indigo-500/20 border border-indigo-400/40 shadow-lg animate-pulse">
                          <Users className="h-10 w-10 text-indigo-300" />
                        </div>
                        <div className="text-xs font-semibold text-white tracking-wide">
                          Kael • Casts Astral Seal
                        </div>
                        <div className="text-[10px] text-indigo-300/80 font-mono">
                          X: 960 • Y: 540 • Bezier Eased
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Canvas HUD Overlay */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-[10px] text-zinc-300 backdrop-blur-xs font-mono">
                    <span>100% Fit</span>
                    <span>•</span>
                    <span>HD 1080p</span>
                  </div>
                </div>

                {/* Scrubber Playback Controls */}
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 text-xs">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="default" className="h-7 w-7 p-0">
                    <Play className="h-3 w-3 fill-current" />
                  </Button>
                  <div className="h-1.5 w-48 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div className="h-full w-2/5 bg-indigo-600 rounded-full" />
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">04:12</span>
                </div>
              </div>

              {/* Right Inspector */}
              <div className="hidden sm:flex col-span-3 flex-col border-l border-zinc-200/80 p-3 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40 text-xs space-y-3">
                <div className="font-semibold text-zinc-900 dark:text-white border-b border-zinc-200 pb-1.5 dark:border-zinc-800">
                  Object Properties
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-zinc-500">Selected: Character Rig #01</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                      <span className="text-[10px] text-zinc-400 block">Pos X</span>
                      <span className="font-mono font-medium">960 px</span>
                    </div>
                    <div className="rounded border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                      <span className="text-[10px] text-zinc-400 block">Pos Y</span>
                      <span className="font-mono font-medium">540 px</span>
                    </div>
                  </div>

                  <div className="rounded border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                    <span className="text-[10px] text-zinc-400 block">Interpolation</span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">Cubic Bezier (Ease In-Out)</span>
                  </div>

                  <div className="rounded border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                    <span className="text-[10px] text-zinc-400 block">Layer Stacking</span>
                    <span className="font-medium">Foreground (Z-Index: 3)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Multi-Track Timeline Simulation */}
            <div className="border-t border-zinc-200/80 bg-zinc-100/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/80">
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 mb-2">
                <div className="flex items-center gap-2">
                  <Film className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Timeline Tracks (3 Synchronized Layers)</span>
                </div>
                <span>Zoom: 100%</span>
              </div>

              <div className="space-y-1.5 font-mono text-[10px]">
                {/* Track 1: Video */}
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-zinc-500">Video 01</span>
                  <div className="h-6 flex-1 rounded bg-indigo-100 border border-indigo-300 dark:bg-indigo-950/60 dark:border-indigo-800 flex items-center px-2 text-indigo-700 dark:text-indigo-300 font-medium">
                    Kael Astral Seal (Keyframes: 0, 24, 48, 96)
                  </div>
                </div>
                {/* Track 2: Dialogue */}
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-zinc-500">Dialogue</span>
                  <div className="h-6 flex-1 rounded bg-purple-100 border border-purple-300 dark:bg-purple-950/60 dark:border-purple-800 flex items-center px-2 text-purple-700 dark:text-purple-300 font-medium">
                    &quot;The ancient seal is breaking! Hold fast!&quot; (Voice Synthesized)
                  </div>
                </div>
                {/* Track 3: Audio Music */}
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-zinc-500">BGM Score</span>
                  <div className="h-6 flex-1 rounded bg-emerald-100 border border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800 flex items-center px-2 text-emerald-700 dark:text-emerald-300 font-medium">
                    Orchestral Climax Swell • Volume: 0.85
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Eight-Step Workflow Explanation */}
      <section id="workflow" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <Badge variant="outline" className="mb-2">
              End-to-End Creative Pipeline
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              From Concept to Cinema in 8 Unified Steps
            </h2>
            <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
              TR STUDIO integrates every discipline of animated filmmaking into one unified application with no external conversions required.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {WORKFLOW_STEPS.map((wf, idx) => (
              <div
                key={wf.step}
                onClick={() => setActiveStep(idx)}
                className={`linearity-card cursor-pointer border transition-all ${
                  activeStep === idx
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/10"
                    : "hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {wf.step}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {wf.tag}
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  {wf.title}
                </h3>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {wf.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Feature Showcase */}
      <section id="features" className="py-20 bg-zinc-50/60 dark:bg-zinc-950/30 border-y border-zinc-200/80 dark:border-zinc-800/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <Badge variant="outline" className="mb-2">
              Production Architecture
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Professional Tools. Zero Compromises.
            </h2>
            <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
              Each studio module works as a standalone pro editor while remaining deeply connected to your project story graph.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {STUDIO_FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="linearity-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200/60 text-indigo-600 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-medium text-zinc-500 font-mono">
                        {feat.badge}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                      {feat.title}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <span>Explore module</span>
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Pricing & Access Tiers */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <Badge variant="outline" className="mb-2">
              Accessible Creative Studio
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Start free. Create without bounds.
            </h2>
            <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
              Bring your own Google AI Studio key on the generous free tier, or create stories completely by hand with full studio tools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="linearity-card relative">
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                Creator Community
              </div>
              <div className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-2">
                $0 <span className="text-sm font-normal text-zinc-500">/ forever</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6">
                Full studio functionality with your own Google Gemini free-tier API key or complete manual editing.
              </p>
              <ul className="space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300 mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Unlimited manual stories, screenplays & scenes</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Full 2D Animation & Timeline Keyframe Engine</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>FFmpeg MP4 video rendering</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Character Studio turnarounds & World Hierarchy</span>
                </li>
              </ul>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard">Open Studio</Link>
              </Button>
            </div>

            {/* Studio Pro */}
            <div className="linearity-card border-indigo-500 ring-2 ring-indigo-500/20 relative">
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                Studio Suite Pro
              </div>
              <div className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-2">
                Production Ready
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6">
                Designed for animated film production, dedicated cloud GPU rendering, and team collaboration.
              </p>
              <ul className="space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300 mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                  <span>Everything in Creator Community</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                  <span>4K Ultra-HD MP4 & WebM Rendering</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                  <span>Multi-Track High-Fidelity Audio Mixing</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                  <span>Project version history branching & snapshots</span>
                </li>
              </ul>
              <Button asChild className="w-full">
                <Link href="/dashboard">Launch Studio Suite</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="border-t border-zinc-200/80 bg-zinc-50/60 dark:border-zinc-800/80 dark:bg-zinc-950 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Clapperboard className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-xs font-bold text-zinc-900 dark:text-white">
                TR STUDIO
              </span>
              <span className="block text-[10px] text-zinc-500 dark:text-zinc-400">
                Imagine Anything. Create Everything.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Studio
            </Link>
            <Link href="/characters" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Characters
            </Link>
            <Link href="/environments" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Worlds
            </Link>
            <Link href="/projects" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Projects
            </Link>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>All Studio Engines Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
