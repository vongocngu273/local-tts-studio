import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  FolderOpen,
  Download,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import type { TTSGeneration } from '@shared/types/provider.types';

interface AudioPlayerProps {
  generation: TTSGeneration;
  autoPlay?: boolean;
  onClose?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  generation,
  autoPlay = false
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isError, setIsError] = useState(false);

  const audioSrc = generation.playbackUrl || `localtts-audio://generation/${generation.id}`;

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsError(false);

    const audio = audioRef.current;
    if (audio) {
      audio.load();
      if (autoPlay) {
        audio.play().catch(() => {
          // Autoplay blocked by browser policy until interaction
        });
      }
    }
  }, [audioSrc, autoPlay]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error('Audio play failed:', err);
        setIsError(true);
      });
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) {
      setDuration(audio.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      if (audioRef.current) audioRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleOpenFolder = async () => {
    if (window.localTTS?.tts) {
      await window.localTTS.tts.openAudioFolder(generation.id);
    }
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsError(true)}
      />

      {/* Track info header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground flex items-center gap-2">
              <span>{generation.voiceId}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground uppercase">
                {generation.providerId}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {generation.characterCount.toLocaleString()} ký tự • {generation.sizeBytes ? `${Math.round(generation.sizeBytes / 1024)} KB` : 'MP3'}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenFolder}
            title="Mở thư mục chứa tệp âm thanh"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
          <a
            href={audioSrc}
            download={`audio-${generation.voiceId}-${generation.id.slice(0, 8)}.mp3`}
            title="Tải xuống tệp MP3"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Seekbar and time */}
      <div className="space-y-1">
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          disabled={!duration || isError}
          className="w-full cursor-pointer accent-primary h-1.5 bg-muted rounded-lg appearance-none"
        />
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Controls Toolbar */}
      <div className="flex items-center justify-between pt-1">
        {/* Play/Pause Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            disabled={isError}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95 shadow-sm disabled:opacity-50"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = 0;
            }}
            title="Phát lại từ đầu"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Speed presets */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {[0.75, 1.0, 1.25, 1.5].map((rate) => (
            <button
              key={rate}
              onClick={() => handleRateChange(rate)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                playbackRate === rate
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMute}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 cursor-pointer accent-primary h-1 bg-muted rounded-lg appearance-none"
          />
        </div>
      </div>

      {isError && (
        <div className="rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
          Không thể phát tệp âm thanh này. Tệp có thể đã bị xóa hoặc di chuyển khỏi bộ nhớ dự án.
        </div>
      )}
    </div>
  );
};
