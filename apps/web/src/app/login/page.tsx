"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Clapperboard, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Unable to reach the TR STUDIO authentication server.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#07070a] px-4 py-12 text-zinc-100">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(139,92,246,0.18),transparent)]"
      />

      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to TR STUDIO
          </Link>
        </div>

        <Card className="border-zinc-800/90 bg-zinc-900/70 shadow-2xl shadow-violet-950/20">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-md">
                <Clapperboard className="h-5 w-5" />
              </div>
              <div>
                <CardTitle id="signin-heading" className="text-xl text-white">
                  Sign in to TR STUDIO
                </CardTitle>
                <CardDescription>
                  Imagine Anything. Create Everything.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form
              aria-labelledby="signin-heading"
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {error && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200"
                >
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">
                  Email Address <span aria-hidden="true" className="text-violet-400">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  enterKeyHint="next"
                  required
                  placeholder="director@trstudio.ai"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="current-password">
                    Password <span aria-hidden="true" className="text-violet-400">*</span>
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    id="current-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    enterKeyHint="done"
                    required
                    placeholder="Enter your password"
                    className="pr-11"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                  />
                  <button
                    type="button"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-describedby="login-pw-warning"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 hover:text-zinc-200"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <span id="login-pw-warning" className="visually-hidden">
                    Warning: this will display your password on the screen.
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col space-y-2 border-t border-zinc-800/80 pt-5 text-center text-xs text-zinc-400">
            <p>
              New to TR STUDIO?{" "}
              <Link
                href="/register"
                className="font-semibold text-violet-400 hover:text-violet-300 underline-offset-4 hover:underline"
              >
                Create a studio account
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
