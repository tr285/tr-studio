import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Film,
  Layers,
  Mic2,
  Music,
  Palette,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const PLATFORM_PILLARS = [
  {
    icon: Wand2,
    title: "AI Story & Screenplay Studio",
    description:
      "Transform a single premise into structured episodic arcs, scene breakdowns, and cinematic dialogue.",
    phase: "Step 2 Roadmap",
  },
  {
    icon: Users,
    title: "Character Creation & Rigging",
    description:
      "Design consistent anime and stylized characters with customizable expressions, outfits, and turnarounds.",
    phase: "Step 3 Roadmap",
  },
  {
    icon: Palette,
    title: "Backgrounds & Environments",
    description:
      "Generate multi-layered parallax worlds, atmospheric lighting, and reusable studio sets.",
    phase: "Step 3 Roadmap",
  },
  {
    icon: Layers,
    title: "Scene & Storyboard Canvas",
    description:
      "Compose shots, camera framing, and visual continuity before committing to timeline animation.",
    phase: "Step 4 Roadmap",
  },
  {
    icon: Film,
    title: "2D Animation & Timeline Editor",
    description:
      "Precision keyframe control paired with AI-assisted motion interpolation and camera movement.",
    phase: "Step 5 Roadmap",
  },
  {
    icon: Mic2,
    title: "Voice, Music & MP4 Export",
    description:
      "Synthesize expressive character dialogue, layer soundscapes, preview in real time, and render MP4.",
    phase: "Step 6 Roadmap",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07070a] text-zinc-100 selection:bg-violet-500/30">
      {/* Ambient Background Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.22),transparent)]"
      />

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#07070a]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg shadow-violet-950/60">
              <Clapperboard className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold tracking-wider text-white">
                TR STUDIO
              </span>
              <span className="block text-[10px] text-zinc-400">
                Imagine Anything. Create Everything.
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
            <a href="#vision" className="transition-colors hover:text-white">
              Platform Vision
            </a>
            <a href="#architecture" className="transition-colors hover:text-white">
              Architecture
            </a>
            <Link href="/dashboard" className="transition-colors hover:text-white">
              Studio Workspace
            </Link>
            <Link href="/projects" className="transition-colors hover:text-white">
              Projects
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="default" className="mb-6 gap-1.5 px-3.5 py-1 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            TR STUDIO — AI-Powered Animated Story Creation Platform
          </Badge>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:leading-[1.1]">
            Imagine Anything.{" "}
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              Create Everything.
            </span>
          </h1>

          <p className="mt-6 text-base leading-relaxed text-zinc-300 sm:text-lg">
            TR STUDIO unifies screenplay writing, character design, environment
            art, storyboarding, 2D timeline animation, and voice synthesis inside
            one cohesive dark-room creative suite.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Open Studio Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/register">Create Director Account</Link>
            </Button>
          </div>
        </div>

        {/* Studio Preview Frame */}
        <div className="mt-16 rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/90 to-[#09090d] p-4 shadow-2xl shadow-violet-950/20 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-zinc-700" />
              <span className="h-3 w-3 rounded-full bg-zinc-700" />
              <span className="h-3 w-3 rounded-full bg-violet-500" />
              <span className="ml-2 text-xs font-medium text-zinc-400">
                tr-studio://workspace/foundation-v1
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Step 1 Foundation Active: Auth + PostgreSQL Project Vault</span>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            {/* Left Mock Scene Panel */}
            <div className="space-y-3 lg:col-span-4">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                  Production Pipeline
                </p>
                <h2 className="mt-1 text-base font-semibold text-white">
                  End-to-End Story Architecture
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Manage multi-episode story projects with strict ownership
                  isolation, instant state persistence, and modular packages for
                  scenes, timeline keyframes, and rendering.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">Next.js App Router</Badge>
                  <Badge variant="secondary">FastAPI + SQLAlchemy</Badge>
                  <Badge variant="secondary">PostgreSQL UUIDs</Badge>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">
                    Audio & Timeline Engine
                  </span>
                  <Music className="h-4 w-4 text-purple-400" />
                </div>
                <p className="mt-1.5 text-xs text-zinc-400">
                  Prepared monorepo packages (`@tr-studio/editor-engine`,
                  `@tr-studio/scene-schema`, `@tr-studio/animation-engine`) ready
                  for upcoming milestones.
                </p>
              </div>
            </div>

            {/* Right Interactive Preview Viewport */}
            <div className="flex flex-col justify-between rounded-xl border border-violet-500/20 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),rgba(9,9,13,0.95))] p-6 lg:col-span-8">
              <div className="flex items-center justify-between">
                <Badge variant="default">16:9 Cinema Canvas • 24 FPS</Badge>
                <span className="font-mono text-xs text-zinc-400">
                  TC 00:00:14:08
                </span>
              </div>

              <div className="my-10 flex flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/40 bg-violet-500/15 text-violet-300 shadow-lg shadow-violet-950/50">
                  <Play className="h-7 w-7 fill-current" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  Your Animated Worlds Start in the Project Vault
                </h3>
                <p className="mt-1 max-w-md text-xs text-zinc-400">
                  Sign in or register a director account to create, organize, and
                  manage your story projects backed by PostgreSQL.
                </p>
              </div>

              {/* Stylized Timeline Bar */}
              <div className="space-y-2 rounded-lg border border-zinc-800/90 bg-zinc-950/90 p-3">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>SCENE_01_STORYBOARD</span>
                  <span>VOICE_TRACK_A</span>
                  <span>CAMERA_RIG</span>
                </div>
                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-5 h-2 rounded bg-violet-500/70" />
                  <div className="col-span-4 h-2 rounded bg-purple-500/50" />
                  <div className="col-span-3 h-2 rounded bg-fuchsia-500/40" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Vision Grid */}
      <section
        id="vision"
        className="mx-auto max-w-7xl border-t border-zinc-900 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
            Platform Roadmap
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
            Designed for Complete Animated Storytelling
          </h2>
          <p className="mt-3 text-sm text-zinc-400">
            Step 1 establishes the core authentication, project management, and
            monorepo foundation. Here is the full creative pipeline being built on
            top of this architecture:
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_PILLARS.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.title}
                className="border-zinc-800/80 bg-zinc-900/40 hover:border-violet-500/40"
              >
                <CardHeader>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-[11px]">
                      {item.phase}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription className="pt-1 leading-relaxed">
                    {item.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Architecture & CTA */}
      <section
        id="architecture"
        className="mx-auto max-w-7xl border-t border-zinc-900 px-4 py-16 sm:px-6 lg:px-8"
      >
        <Card className="border-violet-500/30 bg-gradient-to-r from-violet-950/40 via-zinc-900/80 to-purple-950/30">
          <CardContent className="flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <Badge variant="default">Step 1 Foundation Ready</Badge>
              <h2 className="text-2xl font-bold text-white">
                Ready to launch your first story project?
              </h2>
              <p className="max-w-xl text-sm text-zinc-300">
                Create an account to access the TR STUDIO Dashboard, initialize
                new animated projects, and verify live FastAPI + PostgreSQL
                persistence.
              </p>
            </div>
            <div className="flex shrink-0 gap-3">
              <Button asChild size="lg">
                <Link href="/register">Create Account</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-10 text-center text-xs text-zinc-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} TR STUDIO. Imagine Anything. Create Everything.</p>
          <div className="flex gap-6">
            <Link href="/dashboard" className="hover:text-zinc-300">
              Dashboard
            </Link>
            <Link href="/projects" className="hover:text-zinc-300">
              Projects
            </Link>
            <Link href="/settings" className="hover:text-zinc-300">
              Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
