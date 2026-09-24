import React, { useState } from 'react';
import {
  Download,
  FolderOpen,
  CheckCircle2,
  FileAudio,
  FileText,
  FileCode,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import type { ProjectExportOptions, ProjectExportResult } from '@shared/types/export.types';
import { DEFAULT_EXPORT_OPTIONS } from '@shared/types/export.types';

interface ExportPanelProps {
  projectId: string;
  projectName: string;
  isExporting: boolean;
  lastExportResult: ProjectExportResult | null;
  onExportBundle: (targetDir: string, options: Partial<ProjectExportOptions>) => Promise<void>;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  projectName,
  isExporting,
  lastExportResult,
  onExportBundle
}) => {
  const [targetDir, setTargetDir] = useState('');
  const [options, setOptions] = useState<ProjectExportOptions>(DEFAULT_EXPORT_OPTIONS);

  const handleSelectDirectory = async () => {
    const selected = await window.localTTS.export.selectExportDirectory();
    if (selected) {
      setTargetDir(selected);
    }
  };

  const handleToggleOption = (key: keyof ProjectExportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = async () => {
    if (!targetDir) return;
    await onExportBundle(targetDir, options);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm max-w-4xl mx-auto">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-white mb-1">
          Xuất toàn bộ gói dự án{projectName ? `: ${projectName}` : ''}
        </h3>
        <p className="text-xs text-slate-400">
          Đóng gói các tệp âm thanh hoàn chỉnh, phụ đề và kịch bản vào một thư mục đích trên máy tính của bạn.
        </p>
      </div>

      {/* Options grid */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          Chọn các tệp cần xuất:
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* MP3 Audio */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors min-h-[68px]">
            <input
              type="checkbox"
              data-testid="export-opt-mp3"
              checked={options.includeMp3}
              onChange={() => handleToggleOption('includeMp3')}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 mt-0.5 shrink-0"
            />
            <FileAudio className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-medium text-white break-words whitespace-normal">audio.mp3</div>
              <div className="text-[10px] text-slate-400 leading-relaxed break-words whitespace-normal mt-0.5">Âm thanh nén tiêu chuẩn</div>
            </div>
          </label>

          {/* WAV Audio */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors min-h-[68px]">
            <input
              type="checkbox"
              data-testid="export-opt-wav"
              checked={options.includeWav}
              onChange={() => handleToggleOption('includeWav')}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 mt-0.5 shrink-0"
            />
            <FileAudio className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-medium text-white break-words whitespace-normal">audio.wav</div>
              <div className="text-[10px] text-slate-400 leading-relaxed break-words whitespace-normal mt-0.5">Chất lượng gốc PCM 16-bit</div>
            </div>
          </label>

          {/* Individual Segments */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors min-h-[68px]">
            <input
              type="checkbox"
              data-testid="export-opt-individual-segments"
              checked={options.includeIndividualSegments}
              onChange={() => handleToggleOption('includeIndividualSegments')}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 mt-0.5 shrink-0"
            />
            <Layers className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-medium text-white break-words whitespace-normal">Từng đoạn âm thanh (segments/)</div>
              <div className="text-[10px] text-slate-400 leading-relaxed break-words whitespace-normal mt-0.5">Xuất tệp âm thanh riêng lẻ cho từng câu / phân đoạn</div>
            </div>
          </label>

          {/* SRT Subtitle */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors min-h-[68px]">
            <input
              type="checkbox"
              data-testid="export-opt-srt"
              checked={options.includeSrt}
              onChange={() => handleToggleOption('includeSrt')}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 mt-0.5 shrink-0"
            />
            <FileText className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-medium text-white break-words whitespace-normal">subtitle.srt</div>
              <div className="text-[10px] text-slate-400 leading-relaxed break-words whitespace-normal mt-0.5">Phụ đề chuẩn SubRip</div>
            </div>
          </label>

          {/* VTT Subtitle */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors min-h-[68px]">
            <input
              type="checkbox"
              data-testid="export-opt-vtt"
              checked={options.includeVtt}
              onChange={() => handleToggleOption('includeVtt')}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 mt-0.5 shrink-0"
            />
            <FileText className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-medium text-white break-words whitespace-normal">subtitle.vtt</div>
              <div className="text-[10px] text-slate-400 leading-relaxed break-words whitespace-normal mt-0.5">Phụ đề chuẩn WebVTT</div>
            </div>
          </label>

          {/* Original Script */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors min-h-[68px]">
            <input
              type="checkbox"
              data-testid="export-opt-script-original"
              checked={options.includeScriptOriginal}
              onChange={() => handleToggleOption('includeScriptOriginal')}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 mt-0.5 shrink-0"
            />
            <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-medium text-white break-words whitespace-normal">script-original.txt</div>
              <div className="text-[10px] text-slate-400 leading-relaxed break-words whitespace-normal mt-0.5">Kịch bản văn bản gốc</div>
            </div>
          </label>

          {/* Processed Script */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors min-h-[68px]">
            <input
              type="checkbox"
              data-testid="export-opt-script-processed"
              checked={options.includeScriptProcessed}
              onChange={() => handleToggleOption('includeScriptProcessed')}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 mt-0.5 shrink-0"
            />
            <FileText className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-medium text-white break-words whitespace-normal">script-processed.txt</div>
              <div className="text-[10px] text-slate-400 leading-relaxed break-words whitespace-normal mt-0.5">Kịch bản sau chuẩn hóa</div>
            </div>
          </label>

          {/* Markdown Manifest */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors min-h-[68px]">
            <input
              type="checkbox"
              data-testid="export-opt-markdown-manifest"
              checked={options.includeMarkdownManifest}
              onChange={() => handleToggleOption('includeMarkdownManifest')}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 mt-0.5 shrink-0"
            />
            <FileSpreadsheet className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-medium text-white break-words whitespace-normal">manifest.md</div>
              <div className="text-[10px] text-slate-400 leading-relaxed break-words whitespace-normal mt-0.5">Bản báo cáo tổng hợp thông số kỹ thuật, số từ và mốc thời gian</div>
            </div>
          </label>

          {/* Project JSON Metadata */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors min-h-[68px]">
            <input
              type="checkbox"
              data-testid="export-opt-project-json"
              checked={options.includeProjectJson}
              onChange={() => handleToggleOption('includeProjectJson')}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 mt-0.5 shrink-0"
            />
            <FileCode className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-medium text-white break-words whitespace-normal">project.json</div>
              <div className="text-[10px] text-slate-400 leading-relaxed break-words whitespace-normal mt-0.5">Dữ liệu cấu hình dự án, danh sách phân đoạn và mốc thời gian</div>
            </div>
          </label>
        </div>
      </div>

      {/* Target Directory Selection */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Thư mục xuất tệp:
        </label>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={targetDir}
            placeholder="Chưa chọn thư mục đích..."
            data-testid="export-target-dir-input"
            className="flex-1 px-3.5 py-2.5 text-xs bg-slate-950 text-white border border-slate-700 rounded-xl focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSelectDirectory}
            data-testid="export-select-dir-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            Chọn thư mục...
          </button>
        </div>
      </div>

      {/* Export Action */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleExport}
          disabled={!targetDir || isExporting}
          data-testid="export-submit-btn"
          className="inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Đang đóng gói và xuất tệp...' : 'Xuất gói dự án ngay'}
        </button>
      </div>

      {/* Success banner if export completed */}
      {lastExportResult && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs">
          <div className="flex items-center gap-2 font-medium text-emerald-400 mb-2">
            <CheckCircle2 className="w-4 h-4" />
            Xuất thành công {lastExportResult.exportedFiles.length} tệp (
            {formatBytes(lastExportResult.totalSizeBytes)}) vào:
          </div>
          <div className="font-mono text-[11px] text-slate-300 break-all mb-2">
            {lastExportResult.targetDirectory}
          </div>
          <ul className="list-disc list-inside text-slate-400 space-y-0.5 pl-1">
            {lastExportResult.exportedFiles.map((f) => (
              <li key={f} className="truncate">
                {f.split(/[\\/]/).pop()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
