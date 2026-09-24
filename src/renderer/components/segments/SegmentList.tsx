import React, { useState, useRef } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import type { ProjectSegment } from '@shared/types/segment.types';
import { SegmentCard } from './SegmentCard';
import { SegmentEditModal } from './SegmentEditModal';

interface SegmentListProps {
  segments: ProjectSegment[];
  isBuilding: boolean;
  onBuildSegments: () => void;
  onUpdateOverride: (id: string, text: string) => Promise<void>;
  onResetOverride: (id: string) => Promise<void>;
  onRegenerateSegment: (id: string) => void;
  onSelectSegment?: (segment: ProjectSegment) => void;
  selectedSegmentId?: string | null;
}

export const SegmentList: React.FC<SegmentListProps> = ({
  segments,
  isBuilding,
  onBuildSegments,
  onUpdateOverride,
  onResetOverride,
  onRegenerateSegment,
  onSelectSegment,
  selectedSegmentId
}) => {
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'pending'>('all');
  const [editingSegment, setEditingSegment] = useState<ProjectSegment | null>(null);
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const filtered = segments.filter((s) => {
    if (filter === 'completed') return s.status === 'completed';
    if (filter === 'failed') return s.status === 'failed';
    if (filter === 'pending') return s.status === 'pending' || s.status === 'queued';
    return true;
  });

  const handlePlayPreview = (seg: ProjectSegment) => {
    if (!seg.audioPath) return;

    if (playingSegmentId === seg.id) {
      audioRef.current?.pause();
      setPlayingSegmentId(null);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingSegmentId(null);
      audioRef.current.onerror = () => setPlayingSegmentId(null);
    }

    const audioUrl = `localtts-audio://file?path=${encodeURIComponent(seg.audioPath)}`;
    audioRef.current.src = audioUrl;
    audioRef.current.play().catch((err) => {
      console.error('Segment playback failed:', err);
      setPlayingSegmentId(null);
    });

    setPlayingSegmentId(seg.id);
  };

  return (
    <div>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">
            Danh sách phân đoạn ({segments.length} segments)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất cả ({segments.length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'completed'
                  ? 'bg-slate-800 text-emerald-400 font-medium'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              Sẵn sàng ({segments.filter((s) => s.status === 'completed').length})
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'failed'
                  ? 'bg-slate-800 text-rose-400 font-medium'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              Lỗi ({segments.filter((s) => s.status === 'failed').length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'pending'
                  ? 'bg-slate-800 text-slate-300 font-medium'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Chờ ({segments.filter((s) => s.status === 'pending' || s.status === 'queued').length})
            </button>
          </div>

          {/* Rebuild button */}
          <button
            onClick={onBuildSegments}
            disabled={isBuilding}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
            title="Phân tách lại các segment từ kịch bản xử lý"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBuilding ? 'animate-spin' : ''}`} />
            Phân đoạn lại
          </button>
        </div>
      </div>

      {/* Grid / List of segments */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <p className="text-sm text-slate-400">Không có phân đoạn nào trong bộ lọc này.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((seg) => (
            <SegmentCard
              key={seg.id}
              segment={seg}
              isSelected={selectedSegmentId === seg.id}
              isPlaying={playingSegmentId === seg.id}
              onSelect={() => onSelectSegment?.(seg)}
              onEditOverride={() => setEditingSegment(seg)}
              onRegenerate={() => onRegenerateSegment(seg.id)}
              onPlayPreview={() => handlePlayPreview(seg)}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <SegmentEditModal
        segment={editingSegment}
        isOpen={!!editingSegment}
        onClose={() => setEditingSegment(null)}
        onSave={onUpdateOverride}
        onReset={onResetOverride}
      />
    </div>
  );
};
