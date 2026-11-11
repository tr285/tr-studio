"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  Server,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { StudioShell } from "@/components/layout/studio-shell";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    database: string;
    api_version: string;
    app_version: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
    }
  }, [user]);

  useEffect(() => {
    api.health
      .checkV1()
      .then((res) => setHealthStatus(res))
      .catch(() => setHealthStatus(null));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      await api.auth.updateProfile({
        username: username.trim(),
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      });
      await refreshUser();
      setCurrentPassword("");
      setNewPassword("");
      setFeedback({
        type: "success",
        message: "Studio profile settings updated successfully.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof ApiClientError
            ? err.message
            : "Failed to update settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StudioShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Studio Settings</h1>
          <p className="text-sm text-zinc-400">
            Manage your director profile, security credentials, and inspect
            system health
          </p>
        </div>

        {/* System & Backend Connection Status */}
        <Card className="border-zinc-800/90 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Server className="h-5 w-5 text-violet-400" />
                <CardTitle className="text-base">
                  TR STUDIO Infrastructure Diagnostics
                </CardTitle>
              </div>
              <Badge
                variant={
                  healthStatus?.status === "healthy" ? "success" : "warning"
                }
              >
                {healthStatus?.status === "healthy"
                  ? "All Systems Operational"
                  : "Checking Backend"}
              </Badge>
            </div>
            <CardDescription>
              Live connection status to FastAPI (`/api/v1/health`) and
              PostgreSQL
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Server className="h-3.5 w-3.5 text-violet-400" />
                <span>FastAPI Service</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-white">
                {healthStatus
                  ? `Online (${healthStatus.api_version} • v${healthStatus.app_version})`
                  : "Unreachable"}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Database className="h-3.5 w-3.5 text-emerald-400" />
                <span>PostgreSQL Database</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-white capitalize">
                {healthStatus?.database || "Unknown"}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Shield className="h-3.5 w-3.5 text-purple-400" />
                <span>Auth Session</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-white">
                {user ? "JWT Bearer Active" : "Not Signed In"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Profile & Security Form */}
        {user ? (
          <Card className="border-zinc-800/90 bg-zinc-900/50">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <UserIcon className="h-5 w-5 text-violet-400" />
                <CardTitle className="text-base">
                  Director Profile & Security
                </CardTitle>
              </div>
              <CardDescription>
                Update your studio handle or rotate your account password
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-5">
                {feedback && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${
                      feedback.type === "success"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-red-500/40 bg-red-500/10 text-red-200"
                    }`}
                  >
                    {feedback.type === "success" && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-email">Account Email</Label>
                    <Input
                      id="settings-email"
                      type="email"
                      value={user.email}
                      disabled
                      className="opacity-70"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="settings-username">Studio Handle</Label>
                    <Input
                      id="settings-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      spellCheck={false}
                      minLength={3}
                      maxLength={64}
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-800/80 pt-5">
                  <div className="mb-4 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-violet-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Change Password (Optional)
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        name="current_password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Required only if changing password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        name="new_password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        placeholder="At least 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800/80 pt-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={logout}
                    className="text-red-300 hover:text-red-200"
                  >
                    Sign Out of Studio
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-zinc-800 bg-zinc-900/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-zinc-300">
                Sign in to manage your director profile and password settings.
              </p>
              <div className="mt-4 flex gap-3">
                <Button asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/register">Create Account</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </StudioShell>
  );
}
