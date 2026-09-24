import React, { useEffect, useState } from 'react';
import {
  History,
  Trash2,
  FolderOpen,
  Play,
  Pause
} from 'lucide-react';
import { useTranslation } from '../stores/app.store';
import { useGenerationStore } from '../stores/generation.store';
import { AudioPlayer } from '../components/audio/AudioPlayer';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';

export const HistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { generations, loadGenerations, deleteGeneration } = useGenerationStore();
  const [playingGenId, setPlayingGenId] = useState<string | null>(null);

  useEffect(() => {
    loadGenerations();
  }, [loadGenerations]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <StatusBadge label="Hoàn thành" variant="ready" />;
      case 'processing':
        return <StatusBadge label="Đang tạo..." variant="pending" />;
      case 'failed':
        return <StatusBadge label="Thất bại" variant="warning" />;
      default:
        return <StatusBadge label={status} variant="neutral" />;
    }
  };

  const selectedGeneration = generations.find((g) => g.id === playingGenId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <span>{t.history.title}</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">{t.history.subtitle}</p>
      </div>

      {/* Active player if a track is selected */}
      {selectedGeneration && selectedGeneration.status === 'completed' && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pb-2">
          <AudioPlayer generation={selectedGeneration} autoPlay={true} />
        </div>
      )}

      {/* Generations List */}
      {generations.length === 0 ? (
        <EmptyState
          icon={History}
          title={t.history.emptyTitle}
          description="Chưa có bản tạo âm thanh nào. Khi bạn nghe thử hoặc tạo âm thanh trong Studio, lịch sử sẽ được lưu trữ an toàn tại đây."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Mục đích</th>
                  <th className="px-4 py-3">Nhà cung cấp</th>
                  <th className="px-4 py-3">Giọng đọc</th>
                  <th className="px-4 py-3">Ký tự</th>
                  <th className="px-4 py-3">Dung lượng</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {generations.map((gen) => (
                  <tr
                    key={gen.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      playingGenId === gen.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                      {formatDate(gen.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {gen.purpose === 'project' ? (
                        <span className="text-foreground">Dự án</span>
                      ) : (
                        <span className="text-muted-foreground">Nghe thử</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono uppercase text-[11px] text-muted-foreground">
                      {gen.providerId}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-foreground">
                      {gen.voiceId}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-muted-foreground">
                      {gen.characterCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-muted-foreground">
                      {gen.sizeBytes ? `${Math.round(gen.sizeBytes / 1024)} KB` : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(gen.status)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {gen.status === 'completed' && (
                          <button
                            onClick={() =>
                              setPlayingGenId(playingGenId === gen.id ? null : gen.id)
                            }
                            title={playingGenId === gen.id ? 'Dừng phát' : 'Phát âm thanh'}
                            className={`rounded-lg p-1.5 transition-colors ${
                              playingGenId === gen.id
                                ? 'bg-primary text-primary-foreground font-bold'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            {playingGenId === gen.id ? (
                              <Pause className="h-3.5 w-3.5" />
                            ) : (
                              <Play className="h-3.5 w-3.5 ml-0.5" />
                            )}
                          </button>
                        )}

                        {gen.outputPath && (
                          <button
                            onClick={() => window.localTTS?.tts?.openAudioFolder(gen.id)}
                            title="Mở thư mục"
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => deleteGeneration(gen.id)}
                          title="Xóa bản ghi này"
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
