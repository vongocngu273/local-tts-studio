import React from 'react';
import { Play, Pause, Star, Mic2, Loader2 } from 'lucide-react';
import type { VoiceDefinition, ProviderId } from '@shared/types/provider.types';

interface VoiceCardProps {
  voice: VoiceDefinition;
  isPlaying: boolean;
  isLoading?: boolean;
  onPlayPreview: (voice: VoiceDefinition) => void;
  onToggleFavorite: (providerId: ProviderId, voiceId: string) => void;
}

export const VoiceCard: React.FC<VoiceCardProps> = ({
  voice,
  isPlaying,
  isLoading = false,
  onPlayPreview,
  onToggleFavorite
}) => {
  const getGenderBadge = () => {
    switch (voice.gender) {
      case 'female':
        return <span className="rounded bg-pink-500/10 text-pink-500 px-1.5 py-0.5 text-[10px] font-medium">Nữ</span>;
      case 'male':
        return <span className="rounded bg-blue-500/10 text-blue-500 px-1.5 py-0.5 text-[10px] font-medium">Nam</span>;
      default:
        return <span className="rounded bg-gray-500/10 text-gray-500 px-1.5 py-0.5 text-[10px] font-medium">Trung tính</span>;
    }
  };

  const getProviderBadge = () => {
    return (
      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground uppercase">
        {voice.providerId}
      </span>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mic2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground line-clamp-1">{voice.name}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-mono text-muted-foreground">{voice.locale}</span>
              {getGenderBadge()}
              {getProviderBadge()}
            </div>
          </div>
        </div>

        {/* Favorite toggle */}
        <button
          onClick={() => onToggleFavorite(voice.providerId, voice.id)}
          title={voice.isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          className={`p-1 rounded-md transition-colors ${
            voice.isFavorite
              ? 'text-amber-400 hover:text-amber-500'
              : 'text-muted-foreground/40 hover:text-muted-foreground'
          }`}
        >
          <Star className={`h-4 w-4 ${voice.isFavorite ? 'fill-amber-400' : ''}`} />
        </button>
      </div>

      {/* Description */}
      {voice.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {voice.description}
        </p>
      )}

      {/* Bottom bar with Preview button */}
      <div className="border-t border-border/50 pt-2.5 flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground">
          {voice.sampleRate ? `${voice.sampleRate / 1000} kHz` : '24 kHz'}
        </span>

        <button
          onClick={() => onPlayPreview(voice)}
          disabled={isLoading}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
            isPlaying
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'bg-muted/80 text-foreground hover:bg-primary/10 hover:text-primary'
          } ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          ) : isPlaying ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          <span>{isLoading ? 'Đang tải...' : isPlaying ? 'Dừng' : 'Nghe thử'}</span>
        </button>
      </div>
    </div>
  );
};
