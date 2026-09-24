import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Save } from 'lucide-react';
import type { ProjectSegment } from '@shared/types/segment.types';

interface SegmentEditModalProps {
  segment: ProjectSegment | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, text: string) => Promise<void>;
  onReset: (id: string) => Promise<void>;
}

export const SegmentEditModal: React.FC<SegmentEditModalProps> = ({
  segment,
  isOpen,
  onClose,
  onSave,
  onReset
}) => {
  const [overrideText, setOverrideText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (segment) {
      setOverrideText(segment.overrideText ?? segment.baseText);
    }
  }, [segment]);

  if (!isOpen || !segment) return null;

  const handleSave = async () => {
    if (!overrideText.trim()) return;
    setIsSaving(true);
    try {
      await onSave(segment.id, overrideText.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await onReset(segment.id);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded">
              #{segment.segmentIndex + 1}
            </span>
            <h2 className="text-base font-semibold text-white">
              Chỉnh sửa nội dung phát âm Segment
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Base Text (Readonly reference) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Nội dung gốc từ kịch bản xử lý (Base Text):
            </label>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 leading-relaxed max-h-28 overflow-y-auto">
              {segment.baseText}
            </div>
          </div>

          {/* Override Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Nội dung tùy chỉnh (Override Text):
              </label>
              <span className="text-xs text-slate-400">
                {overrideText.length} ký tự
              </span>
            </div>
            <textarea
              rows={4}
              value={overrideText}
              onChange={(e) => setOverrideText(e.target.value)}
              placeholder="Nhập nội dung tùy chỉnh cho riêng segment này..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-950 text-white border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-normal"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              * Lưu ý: Thay đổi nội dung segment sẽ đặt trạng thái segment về &quot;Chưa tạo&quot; để bạn có thể tạo lại riêng segment này.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/60 border-t border-slate-800">
          <div>
            {segment.hasOverride && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Khôi phục gốc
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !overrideText.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
