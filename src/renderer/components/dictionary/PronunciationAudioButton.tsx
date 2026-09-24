import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Square, Loader2 } from 'lucide-react';
import { useGenerationStore } from '../../stores/generation.store';
import { useVoiceStore } from '../../stores/voice.store';
import type { ProviderId } from '@shared/types/provider.types';

export interface PronunciationAudioButtonProps {
  text: string;
  voiceId?: string;
  providerId?: string;
  size?: 'sm' | 'md';
  label?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}

// Module-level tracker so only one audio preview plays at a time
let globalAudioInstance: HTMLAudioElement | null = null;
let globalStopCallback: (() => void) | null = null;

export const stopAllPronunciationAudio = (): void => {
  if (globalAudioInstance) {
    globalAudioInstance.pause();
    globalAudioInstance.removeAttribute('src');
    globalAudioInstance.load();
    globalAudioInstance = null;
  }
  if (globalStopCallback) {
    globalStopCallback();
    globalStopCallback = null;
  }
};

const normalizeProviderId = (provider?: string): ProviderId => {
  if (!provider || provider === 'ALL') return 'edge-tts';
  const lower = provider.toLowerCase();
  if (lower === 'edge' || lower === 'edge-tts') return 'edge-tts';
  if (lower === 'lucylab') return 'lucylab';
  if (lower === 'elevenlabs') return 'elevenlabs';
  if (lower === 'vbee') return 'vbee';
  return 'edge-tts';
};

export const PronunciationAudioButton: React.FC<PronunciationAudioButtonProps> = ({
  text,
  voiceId,
  providerId,
  size = 'md',
  label,
  title,
  className = '',
  disabled = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { previewVoice } = useGenerationStore();
  const { voices, fetchVoices } = useVoiceStore();

  useEffect(() => {
    if (voices.length === 0) {
      fetchVoices();
    }
  }, [voices.length, fetchVoices]);

  // Cleanup on unmount
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      if (globalAudioInstance === audio) {
        globalAudioInstance = null;
        globalStopCallback = null;
      }
    };
  }, []);

  const resolveVoiceAndProvider = (): { activeVoiceId: string; activeProviderId: ProviderId } => {
    const activeProvider = normalizeProviderId(providerId);

    if (voiceId) {
      return { activeVoiceId: voiceId, activeProviderId: activeProvider };
    }

    // Try finding a Vietnamese voice for this provider
    const vietnameseVoice = voices.find(
      (v) =>
        v.providerId === activeProvider &&
        (v.language === 'VI' || v.locale?.toLowerCase().startsWith('vi'))
    );

    if (vietnameseVoice) {
      return { activeVoiceId: vietnameseVoice.id, activeProviderId: activeProvider };
    }

    // Default fallback
    return {
      activeVoiceId: activeProvider === 'edge-tts' ? 'vi-VN-HoaiMyNeural' : 'default',
      activeProviderId: activeProvider
    };
  };

  const handleTogglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (disabled || !text || !text.trim()) return;

    // If currently playing this preview, toggle stop
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
      setIsPlaying(false);
      if (globalAudioInstance === audioRef.current) {
        globalAudioInstance = null;
        globalStopCallback = null;
      }
      return;
    }

    // Stop any other currently playing preview
    stopAllPronunciationAudio();

    setIsLoading(true);

    try {
      const { activeVoiceId, activeProviderId } = resolveVoiceAndProvider();

      const gen = await previewVoice({
        providerId: activeProviderId,
        voiceId: activeVoiceId,
        text: text.trim()
      });

      if (!gen) {
        setIsLoading(false);
        return;
      }

      const url = gen.playbackUrl || `localtts-audio://generation/${gen.id}`;

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const audio = audioRef.current;
      audio.pause();
      audio.src = url;
      audio.load();

      globalAudioInstance = audio;
      globalStopCallback = () => {
        setIsPlaying(false);
        setIsLoading(false);
      };

      audio.onended = () => {
        setIsPlaying(false);
        if (globalAudioInstance === audio) {
          globalAudioInstance = null;
          globalStopCallback = null;
        }
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
        if (globalAudioInstance === audio) {
          globalAudioInstance = null;
          globalStopCallback = null;
        }
      };

      await audio.play().catch((err: unknown) => {
        const domErr = err as { name?: string; message?: string };
        if (domErr?.name === 'AbortError') {
          // Playback interrupted intentionally
          return;
        }
        console.error('Audio preview play error:', err);
        setIsPlaying(false);
      });

      setIsLoading(false);
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to preview pronunciation:', err);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const isSmall = size === 'sm';
  const defaultTooltip = isPlaying ? 'Dừng phát' : isLoading ? 'Đang tạo âm thanh...' : 'Nghe phát âm';

  return (
    <button
      type="button"
      onClick={handleTogglePlay}
      disabled={disabled || !text || !text.trim() || isLoading}
      title={title || defaultTooltip}
      aria-label={title || defaultTooltip}
      className={`inline-flex items-center justify-center font-medium transition-all select-none ${
        isSmall ? 'rounded-md p-1 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs gap-1.5'
      } ${
        isPlaying
          ? 'bg-primary text-primary-foreground shadow-xs animate-pulse ring-1 ring-primary/50'
          : isLoading
            ? 'bg-muted text-muted-foreground cursor-wait'
            : 'bg-secondary/70 hover:bg-secondary text-secondary-foreground hover:text-foreground border border-border/60 hover:border-border'
      } disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <Loader2 className={`${isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5'} animate-spin text-primary`} />
      ) : isPlaying ? (
        <Square className={`${isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5'} fill-current`} />
      ) : (
        <Volume2 className={`${isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-primary`} />
      )}
      {label && <span className="leading-none">{isPlaying ? 'Dừng' : label}</span>}
    </button>
  );
};
