import React, { useState } from 'react';
import { Subtitles, Download, Search, CheckCircle2 } from 'lucide-react';
import type { SubtitleCue, SubtitleExportFormat } from '@shared/types/subtitle.types';
import { formatSrtTimestamp } from '@shared/utils/time.utils';

interface SubtitleViewerProps {
  cues: SubtitleCue[];
  isLoading: boolean;
  onExport: (format: SubtitleExportFormat) => Promise<void>;
}

export const SubtitleViewer: React.FC<SubtitleViewerProps> = ({
  cues,
  isLoading,
  onExport
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExportingSrt, setIsExportingSrt] = useState(false);
  const [isExportingVtt, setIsExportingVtt] = useState(false);

  const filteredCues = cues.filter((c) =>
    c.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportSrt = async () => {
    setIsExportingSrt(true);
    try {
      await onExport('srt');
    } finally {
      setIsExportingSrt(false);
    }
  };

  const handleExportVtt = async () => {
    setIsExportingVtt(true);
    try {
      await onExport('vtt');
    } finally {
      setIsExportingVtt(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Subtitles className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">
            Phụ đề dự án ({cues.length} câu)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm phụ đề..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-950 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
            />
          </div>

          {/* Export buttons */}
          <button
            onClick={handleExportSrt}
            disabled={cues.length === 0 || isExportingSrt || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isExportingSrt ? 'Đang xuất...' : 'Xuất SRT'}
          </button>

          <button
            onClick={handleExportVtt}
            disabled={cues.length === 0 || isExportingVtt || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isExportingVtt ? 'Đang xuất...' : 'Xuất VTT'}
          </button>
        </div>
      </div>

      {/* Cues Table / List */}
      {cues.length === 0 ? (
        <div className="text-center py-12 bg-slate-950/40 border border-slate-800/80 rounded-xl">
          <Subtitles className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">Chưa có dữ liệu phụ đề.</p>
          <p className="text-xs text-slate-500 mt-1">
            Tạo các phân đoạn và ghép nối âm thanh để xem và tải phụ đề SRT/VTT chuẩn xác.
          </p>
        </div>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-medium border-b border-slate-800 sticky top-0 backdrop-blur-sm z-10">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-4 w-44">Thời gian</th>
                <th className="py-2.5 px-3 w-20 text-center">Độ dài</th>
                <th className="py-2.5 px-4">Nội dung phụ đề</th>
                <th className="py-2.5 px-3 w-28 text-center">Độ chính xác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {filteredCues.map((cue, index) => {
                const durSec = ((cue.endMs - cue.startMs) / 1000).toFixed(2);
                const startStr = formatSrtTimestamp(cue.startMs);
                const endStr = formatSrtTimestamp(cue.endMs);

                return (
                  <tr key={cue.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-center">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">
                      {startStr} → {endStr}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-center">
                      {durSec}s
                    </td>
                    <td className="py-2.5 px-4 text-slate-200 font-normal leading-relaxed">
                      {cue.text}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {cue.accuracy === 'word' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Từ AI
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          Ước lượng
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
