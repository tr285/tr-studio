"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import type { Project, ProjectStatus } from "@tr-studio/shared-types";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
  editingProject?: Project | null;
  initialTitle?: string;
  initialDescription?: string;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string; hint: string }[] = [
  { value: "draft", label: "Draft", hint: "Concept & screenplay outline" },
  { value: "in_progress", label: "In Progress", hint: "Active storyboarding & scenes" },
  { value: "completed", label: "Completed", hint: "Ready for final review" },
  { value: "archived", label: "Archived", hint: "Stored in vault" },
];

export function ProjectDialog({
  open,
  onClose,
  onSuccess,
  editingProject,
  initialTitle = "",
  initialDescription = "",
}: ProjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("draft");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingProject) {
      setTitle(editingProject.title);
      setDescription(editingProject.description || "");
      setStatus(editingProject.status);
    } else {
      setTitle(initialTitle);
      setDescription(initialDescription);
      setStatus("draft");
    }
    setError(null);
  }, [editingProject, initialTitle, initialDescription, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Fallback for browsers without native <dialog closedby="any"> support
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleNativeClose);

    let cleanupFallback: (() => void) | undefined;
    if (
      typeof HTMLDialogElement !== "undefined" &&
      !("closedBy" in HTMLDialogElement.prototype)
    ) {
      let pressedOutside = false;
      const isOutside = (e: PointerEvent) => {
        const rect = dialog.getBoundingClientRect();
        return (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        );
      };
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e)) {
          dialog.close();
        }
      };
      dialog.addEventListener("pointerdown", onPointerDown);
      dialog.addEventListener("pointerup", onPointerUp);
      cleanupFallback = () => {
        dialog.removeEventListener("pointerdown", onPointerDown);
        dialog.removeEventListener("pointerup", onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleNativeClose);
      cleanupFallback?.();
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a project title.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let saved: Project;
      if (editingProject) {
        saved = await api.projects.update(editingProject.id, {
          title: title.trim(),
          description: description.trim() || null,
          status,
        });
      } else {
        saved = await api.projects.create({
          title: title.trim(),
          description: description.trim() || null,
          status,
        });
      }
      onSuccess(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Unable to save project. Please check your connection.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      aria-labelledby={titleId}
      className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl shadow-violet-950/40 open:flex open:flex-col"
    >
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 id={titleId} className="text-base font-semibold text-white">
              {editingProject ? "Edit Story Project" : "Create New Story Project"}
            </h2>
            <p className="text-xs text-zinc-400">
              {editingProject
                ? "Update metadata and workflow status for your story."
                : "Initialize a new animated story workspace in TR STUDIO."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close dialog"
          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-6">
        {error && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="project-title">
            Story Title <span aria-hidden="true" className="text-violet-400">*</span>
          </Label>
          <Input
            id="project-title"
            name="title"
            required
            autoFocus
            maxLength={200}
            placeholder="e.g., Chronicles of Aethelgard — Episode 1"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-description">Logline / Story Synopsis</Label>
          <Textarea
            id="project-description"
            name="description"
            maxLength={5000}
            placeholder="Describe the core premise, world setting, or visual direction for this animated story..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <fieldset className="space-y-2.5">
          <legend className="text-sm font-medium text-zinc-200">
            Production Stage
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            {STATUS_OPTIONS.map((option) => {
              const checked = status === option.value;
              return (
                <label
                  key={option.value}
                  htmlFor={`status-${option.value}`}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-all ${
                    checked
                      ? "border-violet-500 bg-violet-500/10 text-white"
                      : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  <input
                    type="radio"
                    id={`status-${option.value}`}
                    name="status"
                    value={option.value}
                    checked={checked}
                    onChange={() => setStatus(option.value)}
                    className="mt-0.5 h-4 w-4 accent-violet-500"
                  />
                  <span className="flex flex-col">
                    <span className="text-xs font-semibold">{option.label}</span>
                    <span className="text-[11px] text-zinc-400">{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-800/80 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => dialogRef.current?.close()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : editingProject ? (
              "Save Changes"
            ) : (
              "Create Story Project"
            )}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
