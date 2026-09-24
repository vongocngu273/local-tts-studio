import React, { useEffect, useState, useRef } from 'react';
import {
  Mic2,
  Search,
  RefreshCw,
  Star,
  X
} from 'lucide-react';
import { useTranslation } from '../stores/app.store';
import { useVoiceStore } from '../stores/voice.store';
import { useGenerationStore } from '../stores/generation.store';
import { VoiceCard } from '../components/voices/VoiceCard';
import { EmptyState } from '../components/ui/EmptyState';
import type { VoiceDefinition } from '@shared/types/provider.types';

export const VoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    voices,
    isLoading,
    isRefreshing,
    filter,
    setFilter,
    fetchVoices,
    refreshVoices,
    toggleFavorite,
    previewingVoiceId,
    setPreviewingVoiceId
  } = useVoiceStore();

  const { previewVoice, isPreviewing } = useGenerationStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      setPreviewingVoiceId(null);
    };
  }, [setPreviewingVoiceId]);

  const handlePlayPreview = async (voice: VoiceDefinition) => {
    setErrorMessage(null);
    // If already playing this voice, toggle stop
    if (previewingVoiceId === voice.id && isPlayingAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
      setIsPlayingAudio(false);
      setPreviewingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setPreviewingVoiceId(voice.id);
    try {
      const sampleText =
        voice.language === 'VI'
          ? 'Xin chào! Tôi là giọng đọc nhân tạo, sẵn sàng đồng hành cùng các dự án của bạn.'
          : 'Hello! I am an AI neural voice, ready to bring your scripts to life.';

      const gen = await previewVoice({
        providerId: voice.providerId,
        voiceId: voice.id,
        text: sampleText
      });

      if (gen) {
        const url = gen.playbackUrl || `localtts-audio://generation/${gen.id}`;
        setIsPlayingAudio(true);
        if (audioRef.current) {
          const audio = audioRef.current;
          audio.pause();
          audio.src = url;
          audio.load();
          audio.play().catch((err: unknown) => {
            const domErr = err as { name?: string; message?: string };
            if (domErr?.name === 'AbortError') {
              return;
            }
            if (domErr?.name === 'NotAllowedError') {
              console.warn('Audio playback blocked by autoplay policy:', err);
              setErrorMessage('Vui lòng tương tác với ứng dụng để phát âm thanh.');
            } else {
              console.error('Audio preview play error:', err);
              setErrorMessage('Trình duyệt không thể phát âm thanh xem trước.');
            }
            setIsPlayingAudio(false);
            setPreviewingVoiceId(null);
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to generate preview sample:', err);
      setErrorMessage(`Không thể nghe thử giọng đọc: ${msg}`);
      setIsPlayingAudio(false);
      setPreviewingVoiceId(null);
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
    setPreviewingVoiceId(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hidden audio element for previews */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onError={handleAudioEnded}
      />

      {/* Error alert banner */}
      {errorMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Mic2 className="h-5 w-5 text-primary" />
            <span>{t.voices.title}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.voices.subtitle}</p>
        </div>

        <button
          onClick={() => refreshVoices()}
          disabled={isRefreshing || isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
          <span>{isRefreshing ? 'Đang làm mới...' : 'Cập nhật thư viện'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo tên giọng, ngôn ngữ hoặc vùng miền..."
            value={filter.search || ''}
            onChange={(e) => setFilter({ search: e.target.value })}
            className="w-full rounded-lg border border-input bg-background pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {filter.search && (
            <button
              onClick={() => setFilter({ search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Provider Select */}
          <select
            value={filter.providerId || 'ALL'}
            onChange={(e) => setFilter({ providerId: e.target.value as typeof filter.providerId })}
            className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">Tất cả nhà cung cấp</option>
            <option value="edge-tts">Edge TTS</option>
            <option value="lucylab">LucyLab</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="vbee">Vbee</option>
          </select>

          {/* Gender Select */}
          <select
            value={filter.gender || 'ALL'}
            onChange={(e) => setFilter({ gender: e.target.value as typeof filter.gender })}
            className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">Tất cả giới tính</option>
            <option value="female">Nữ</option>
            <option value="male">Nam</option>
          </select>

          {/* Favorites only button */}
          <button
            onClick={() => setFilter({ favoritesOnly: !filter.favoritesOnly })}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
              filter.favoritesOnly
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-500 font-semibold'
                : 'border-input bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${filter.favoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>Yêu thích</span>
          </button>
        </div>
      </div>

      {/* Voice Grid or Empty State */}
      {isLoading ? (
        <div className="py-20 text-center space-y-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground">Đang tải danh mục giọng đọc...</p>
        </div>
      ) : voices.length === 0 ? (
        <EmptyState
          icon={Mic2}
          title="Không tìm thấy giọng đọc nào"
          description="Thử thay đổi bộ lọc tìm kiếm hoặc nhấn nút 'Cập nhật thư viện' để đồng bộ lại danh sách giọng từ các nhà cung cấp."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {voices.map((voice) => (
            <VoiceCard
              key={`${voice.providerId}:${voice.id}`}
              voice={voice}
              isPlaying={previewingVoiceId === voice.id && isPlayingAudio}
              isLoading={previewingVoiceId === voice.id && isPreviewing}
              onPlayPreview={handlePlayPreview}
              onToggleFavorite={(pId, vId) => toggleFavorite(pId, vId)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
