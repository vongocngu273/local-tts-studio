import React from 'react';
import { Play, Pause, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { QueueStatus } from '@shared/types/queue.types';
import type { ProjectSegment } from '@shared/types/segment.types';

interface QueueControlBarProps {
  queueStatus: QueueStatus | null;
  segments: ProjectSegment[];
  onStartQueue: () => void;
  onPauseQueue: () => void;
  onResumeQueue: () => void;
  onCancelQueue: () => void;
}

export const QueueControlBar: React.FC<QueueControlBarProps> = ({
  queueStatus,
  segments,
  onStartQueue,
  onPauseQueue,
  onResumeQueue,
  onCancelQueue
}) => {
  const total = segments.length;
  const completed = segments.filter((s) => s.status === 'completed').length;
  const failed = segments.filter((s) => s.status === 'failed').length;
  const pending = segments.filter((s) => s.status === 'pending' || s.status === 'queued').length;
  const processing = segments.filter((s) => s.status === 'processing').length;

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isRunning = queueStatus?.isRunning || processing > 0;
  const isPaused = queueStatus?.isPaused;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm mb-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        {/* Status badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Tiến độ hàng đợi:
            </span>
            <span className="text-sm font-bold text-white">
              {completed} / {total} ({percent}%)
            </span>
          </div>

          {isRunning && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Loader2 className="w-3 h-3 animate-spin" />
              Đang tạo ({processing} active)
            </span>
          )}

          {isPaused && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Pause className="w-3 h-3" />
              Tạm dừng
            </span>
          )}

          {failed > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-3 h-3" />
              {failed} lỗi
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isRunning && pending > 0 && (
            <button
              onClick={onStartQueue}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              {completed === 0 ? 'Tạo tất cả (Start)' : `Tạo tiếp (${pending} còn lại)`}
            </button>
          )}

          {isRunning && !isPaused && (
            <button
              onClick={onPauseQueue}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
              Tạm dừng
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResumeQueue}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Tiếp tục
            </button>
          )}

          {(isRunning || pending > 0) && (
            <button
              onClick={onCancelQueue}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-700 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Hủy hàng đợi
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
        <div
          className="bg-emerald-500 h-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
        {failed > 0 && (
          <div
            className="bg-rose-500 h-full transition-all duration-300"
            style={{ width: `${(failed / total) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
};
