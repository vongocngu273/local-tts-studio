export interface ProjectExportOptions {
  includeMp3: boolean;
  includeWav: boolean;
  includeSrt: boolean;
  includeVtt: boolean;
  includeScriptOriginal: boolean;
  includeScriptProcessed: boolean;
  includeProjectJson: boolean;
  includeIndividualSegments: boolean;
  includeMarkdownManifest: boolean;
  createZip: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ProjectExportOptions = {
  includeMp3: true,
  includeWav: true,
  includeSrt: true,
  includeVtt: true,
  includeScriptOriginal: true,
  includeScriptProcessed: true,
  includeProjectJson: true,
  includeIndividualSegments: true,
  includeMarkdownManifest: true,
  createZip: false
};

export interface ProjectExportResult {
  targetDirectory: string;
  exportedFiles: string[];
  zipPath?: string;
  totalSizeBytes: number;
}
