import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions';
import { Play, Pause, Volume2, ZoomIn, ZoomOut } from 'lucide-react';
import type { SegmentAudioOffset } from '@shared/types/composition.types';

interface WaveformTimelineProps {
  audioPath: string | null;
  segmentOffsets?: SegmentAudioOffset[];
  onSelectSegment?: (segmentId: string) => void;
  selectedSegmentId?: string | null;
}

export const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  audioPath,
  segmentOffsets = [],
  onSelectSegment,
  selectedSegmentId
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);

  const onSelectSegmentRef = useRef(onSelectSegment);
  useEffect(() => {
    onSelectSegmentRef.current = onSelectSegment;
  }, [onSelectSegment]);

  const selectedSegmentIdRef = useRef(selectedSegmentId);
  useEffect(() => {
    selectedSegmentIdRef.current = selectedSegmentId;
  }, [selectedSegmentId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(20);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !audioPath) return;

    setIsReady(false);
    setIsPlaying(false);

    // Initialize Regions & Timeline plugins
    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const timeline = TimelinePlugin.create({
      container: timelineRef.current || undefined,
      height: 20,
      style: {
        color: '#94a3b8',
        fontSize: '10px'
      }
    });

    // Create WaveSurfer instance
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#475569',
      progressColor: '#6366f1',
      cursorColor: '#f43f5e',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 96,
      normalize: true,
      minPxPerSec: 20,
      plugins: [timeline, regions]
    });

    wavesurferRef.current = ws;

    // Load audio source via localtts-audio:// or HTTP/blob
    const audioUrl =
      audioPath.startsWith('http') || audioPath.startsWith('blob:') || audioPath.startsWith('localtts-audio:')
        ? audioPath
        : `localtts-audio://file?path=${encodeURIComponent(audioPath)}`;

    ws.load(audioUrl);

    ws.on('ready', () => {
      setIsReady(true);
      setDuration(ws.getDuration());

      // Add non-destructive visual regions for each segment
      regions.clearRegions();
      segmentOffsets.forEach((offset, idx) => {
        const startSec = offset.startMs / 1000;
        const endSec = offset.endMs / 1000;
        const isSelected = selectedSegmentIdRef.current === offset.segmentId;

        // Alternate subtle colors for distinction
        const baseColor =
          idx % 2 === 0 ? 'rgba(99, 102, 241, 0.14)' : 'rgba(168, 85, 247, 0.14)';
        const activeColor = 'rgba(99, 102, 241, 0.35)';

        regions.addRegion({
          id: offset.segmentId,
          start: startSec,
          end: endSec,
          color: isSelected ? activeColor : baseColor,
          drag: false,
          resize: false
        });
      });
    });

    ws.on('audioprocess', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('seeking', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('interaction', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    regions.on('region-clicked', (region: Region, e: MouseEvent) => {
      e.stopPropagation();
      ws.setTime(region.start);
      ws.play();
      onSelectSegmentRef.current?.(region.id);
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioPath, segmentOffsets]);

  // Update region highlight when selectedSegmentId changes
  useEffect(() => {
    if (!regionsRef.current) return;
    const regions = regionsRef.current.getRegions();
    regions.forEach((r: Region) => {
      if (r.id === selectedSegmentId) {
        r.setOptions({ color: 'rgba(99, 102, 241, 0.35)' });
      } else {
        r.setOptions({ color: 'rgba(99, 102, 241, 0.14)' });
      }
    });
  }, [selectedSegmentId]);

  const togglePlay = () => {
    wavesurferRef.current?.playPause();
  };

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(10, Math.min(100, zoomLevel + delta));
    setZoomLevel(newZoom);
    wavesurferRef.current?.zoom(newZoom);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
  };

  if (!audioPath) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900/50 border border-slate-800 rounded-2xl text-center">
        <Volume2 className="w-10 h-10 text-slate-600 mb-2" />
        <p className="text-sm text-slate-400 font-medium">Chưa có bản ghép âm thanh hoàn chỉnh.</p>
        <p className="text-xs text-slate-500 mt-1">
          Nhấn &quot;Ghép nối âm thanh&quot; (Compose) sau khi các phân đoạn đã tạo xong để hiển thị dạng sóng.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
      {/* Waveform container */}
      <div className="relative mb-3 bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 overflow-hidden">
        <div ref={containerRef} className="w-full cursor-pointer" />
        <div ref={timelineRef} className="w-full mt-1" />
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-between gap-4">
        {/* Play/Pause & Time */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!isReady}
            className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors disabled:opacity-50"
            title={isPlaying ? 'Tạm dừng' : 'Phát'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <div className="flex items-baseline gap-1 font-mono text-sm">
            <span className="font-semibold text-white">{formatTime(currentTime)}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1 text-slate-300">
          <button
            onClick={() => handleZoom(-10)}
            className="p-1 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Thu nhỏ timeline"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono px-1.5 text-slate-400">{zoomLevel}px/s</span>
          <button
            onClick={() => handleZoom(10)}
            className="p-1 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Phóng to timeline"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
