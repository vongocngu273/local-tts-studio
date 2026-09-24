import { describe, it, expect } from 'vitest';
import { SrtWriter } from '../src/main/services/subtitles/srtWriter';
import { VttWriter } from '../src/main/services/subtitles/vttWriter';
import { SubtitleTimingService } from '../src/main/services/subtitles/subtitleTiming.service';
import type { SubtitleCue } from '../src/shared/types/subtitle.types';
import type { ProjectSegment } from '../src/shared/types/segment.types';

describe('Subtitle Engine', () => {
  const timingService = new SubtitleTimingService();

  const testCues: SubtitleCue[] = [
    {
      id: 'cue-1',
      segmentId: 'seg-1',
      startMs: 1250,
      endMs: 3450,
      text: 'Xin chào các bạn đến với studio âm thanh.',
      accuracy: 'word'
    },
    {
      id: 'cue-2',
      segmentId: 'seg-2',
      startMs: 3950,
      endMs: 6100,
      text: 'Hôm nay chúng ta sẽ tìm hiểu về công nghệ AI.',
      accuracy: 'word'
    }
  ];

  it('formats SRT subtitles with correct timecodes and wrapping', () => {
    const srt = SrtWriter.write(testCues, { maxCharactersPerLine: 42, maxLines: 2 });
    expect(srt).toContain('1\n00:00:01,250 --> 00:00:03,450\nXin chào');
    expect(srt).toContain('2\n00:00:03,950 --> 00:00:06,100\nHôm nay');
  });

  it('formats WebVTT subtitles with WEBVTT header and period separator', () => {
    const vtt = VttWriter.write(testCues, { maxCharactersPerLine: 42, maxLines: 2 });
    expect(vtt.startsWith('WEBVTT\n')).toBe(true);
    expect(vtt).toContain('00:00:01.250 --> 00:00:03.450');
    expect(vtt).toContain('00:00:03.950 --> 00:00:06.100');
  });

  it('generates non-drifting cues across multiple segments with pause accumulation', () => {
    const segments: ProjectSegment[] = [
      {
        id: 'seg-1',
        projectId: 'proj-1',
        segmentIndex: 0,
        text: 'Đoạn thứ nhất ngắn gọn.',
        textHash: 'h1',
        baseText: 'Đoạn thứ nhất ngắn gọn.',
        overrideText: null,
        hasOverride: false,
        sourceStart: 0,
        sourceEnd: 23,
        paragraphIndex: 0,
        status: 'completed',
        providerId: 'edge-tts',
        voiceId: 'vi-VN-HoaiMyNeural',
        modelId: null,
        settings: {},
        generationId: 'g1',
        audioPath: '/fake/path/1.mp3',
        timingPath: null,
        durationMs: 2000,
        characterCount: 23,
        pauseAfterMs: 300,
        errorCode: null,
        errorMessage: null,
        revision: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      },
      {
        id: 'seg-2',
        projectId: 'proj-1',
        segmentIndex: 1,
        text: 'Đoạn thứ hai sang đoạn văn mới.',
        textHash: 'h2',
        baseText: 'Đoạn thứ hai sang đoạn văn mới.',
        overrideText: null,
        hasOverride: false,
        sourceStart: 24,
        sourceEnd: 55,
        paragraphIndex: 1, // new paragraph!
        status: 'completed',
        providerId: 'edge-tts',
        voiceId: 'vi-VN-HoaiMyNeural',
        modelId: null,
        settings: {},
        generationId: 'g2',
        audioPath: '/fake/path/2.mp3',
        timingPath: null,
        durationMs: 3000,
        characterCount: 31,
        pauseAfterMs: null,
        errorCode: null,
        errorMessage: null,
        revision: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      }
    ];

    const sentencePauseMs = 250;
    const paragraphPauseMs = 600; // new paragraph from seg-1 to seg-2

    const cues = timingService.generateCues(segments, sentencePauseMs, paragraphPauseMs);

    expect(cues.length).toBeGreaterThanOrEqual(2);

    // Segment 1 cues must be in [0, 2000]
    const seg1Cues = cues.filter((c) => c.segmentId === 'seg-1');
    expect(seg1Cues[0].startMs).toBe(0);
    expect(seg1Cues[seg1Cues.length - 1].endMs).toBeLessThanOrEqual(2000);

    // Segment 2 cues must start after seg1 duration (2000) + paragraph pause (600) = 2600ms
    const seg2Cues = cues.filter((c) => c.segmentId === 'seg-2');
    expect(seg2Cues[0].startMs).toBe(2600);
    expect(seg2Cues[seg2Cues.length - 1].endMs).toBeLessThanOrEqual(5600); // 2600 + 3000
  });
});
