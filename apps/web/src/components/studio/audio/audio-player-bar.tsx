"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

interface AudioPlayerBarProps {
  url?: string | null;
  title?: string;
  waveform?: number[] | null;
  onEnded?: () => void;
}

export function AudioPlayerBar({ url, title, waveform, onEnded }: AudioPlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current || !url) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.warn("Audio play error", e));
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const formatTime = (secs: number) => {
    const s = Math.floor(secs);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? "0" : ""}${rem}`;
  };

  const peaks = waveform && waveform.length > 0 ? waveform : Array(48).fill(0.2);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 shadow-inner backdrop-blur-sm">
      <audio
        ref={audioRef}
        src={url || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          onEnded?.();
        }}
      />
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="font-medium text-zinc-200 truncate max-w-[280px]">
          {title || "No track selected"}
        </span>
        <div className="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Waveform Bar */}
      <div className="relative flex h-8 items-center gap-[2px] overflow-hidden rounded bg-zinc-900 px-2 py-1">
        {peaks.map((peak, idx) => {
          const progress = duration > 0 ? currentTime / duration : 0;
          const barProgress = idx / peaks.length;
          const isActive = barProgress <= progress;
          return (
            <div
              key={idx}
              className={`flex-1 rounded-sm transition-colors duration-100 ${
                isActive ? "bg-violet-500 shadow-sm shadow-violet-500/50" : "bg-zinc-700 hover:bg-zinc-600"
              }`}
              style={{ height: `${Math.max(12, Math.min(100, peak * 100))}%` }}
            />
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!url}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white shadow hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                setCurrentTime(0);
              }
            }}
            disabled={!url}
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Progress Slider */}
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
          disabled={!url}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-violet-500 disabled:opacity-40"
        />

        {/* Volume */}
        <div className="flex items-center gap-1.5 text-zinc-400">
          <button
            type="button"
            onClick={() => {
              if (!audioRef.current) return;
              const nextMute = !isMuted;
              setIsMuted(nextMute);
              audioRef.current.muted = nextMute;
            }}
            className="hover:text-zinc-200"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              setIsMuted(val === 0);
              if (audioRef.current) {
                audioRef.current.volume = val;
                audioRef.current.muted = val === 0;
              }
            }}
            className="w-16 h-1 cursor-pointer appearance-none rounded bg-zinc-800 accent-violet-500"
          />
        </div>
      </div>
    </div>
  );
}
