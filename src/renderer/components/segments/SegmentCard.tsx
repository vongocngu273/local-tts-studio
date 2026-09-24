import React from 'react';
import {
  Play,
  RotateCcw,
  Edit2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Sparkles,
  Volume2
} from 'lucide-react';
import type { ProjectSegment } from '@shared/types/segment.types';

interface SegmentCardProps {
  segment: ProjectSegment;
  isSelected?: boolean;
  isPlaying?: boolean;
  onSelect: () => void;
  onEditOverride: () => void;
  onRegenerate: () => void;
  onPlayPreview: () => void;
}

export const SegmentCard: React.FC<SegmentCardProps> = ({
  segment,
  isSelected,
  isPlaying,
  onSelect,
  onEditOverride,
  onRegenerate,
  onPlayPreview
}) => {
  const getStatusBadge = () => {
    switch (segment.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Sẵn sàng
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            Đang tạo
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Chờ xử lý
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            Thất bại
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Chưa tạo
          </span>
        );
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border transition-all duration-200 p-4 cursor-pointer ${
        isSelected
          ? 'bg-slate-900 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/30'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
            #{segment.segmentIndex + 1}
          </span>
          <span className="text-[11px] text-slate-400">
            Đoạn văn {segment.paragraphIndex + 1}
          </span>
          <span className="text-[11px] text-slate-500">•</span>
          <span className="text-[11px] text-slate-400">
            {segment.characterCount} ký tự
          </span>
          {segment.hasOverride && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-2.5 h-2.5" />
              Tùy chỉnh
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {segment.durationMs ? (
            <span className="text-xs font-mono text-slate-400">
              {(segment.durationMs / 1000).toFixed(2)}s
            </span>
          ) : null}
          {getStatusBadge()}
        </div>
      </div>

      {/* Segment Text */}
      <p className="text-sm text-slate-200 leading-relaxed mb-3 font-normal line-clamp-3">
        {segment.text}
      </p>

      {/* Error Message */}
      {segment.status === 'failed' && segment.errorMessage && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300">
          {segment.errorMessage}
        </div>
      )}

      {/* Footer / Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Volume2 className="w-3.5 h-3.5 text-slate-500" />
          <span className="truncate max-w-[140px]">{segment.voiceId || 'Default Voice'}</span>
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {segment.status === 'completed' && segment.audioPath && (
            <button
              onClick={onPlayPreview}
              className={`p-1.5 rounded-lg border transition-colors ${
                isPlaying
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
              }`}
              title="Nghe thử segment"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onEditOverride}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:text-white hover:bg-slate-700 transition-colors"
            title="Sửa nội dung segment (Override)"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onRegenerate}
            disabled={segment.status === 'processing'}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:text-indigo-400 hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Tạo lại riêng segment này (1 TTS call)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
