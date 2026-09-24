import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  APP_NAME,
  APP_ID,
  APP_VERSION,
  APP_AUTHOR,
  APP_YEAR,
  APP_COPYRIGHT
} from '../src/shared/constants/app.constants';
import { SystemInfoService } from '../src/main/services/system/systemInfo.service';
import { SystemInfoSchema } from '../src/shared/schemas/system.schema';

describe('QA Branding & Packaging Test Suite (TC-20260924-BRANDING-AND-PACKAGING)', () => {
  // --------------------------------------------------------------------------
  // 1. App Constants Branding Specification
  // --------------------------------------------------------------------------
  describe('Brand Constants Verification (app.constants.ts)', () => {
    it('verifies APP_AUTHOR matches "Ngự Võ"', () => {
      expect(APP_AUTHOR).toBe('Ngự Võ');
    });

    it('verifies APP_VERSION matches "1.0.0"', () => {
      expect(APP_VERSION).toBe('1.0.0');
    });

    it('verifies APP_YEAR matches "2026"', () => {
      expect(APP_YEAR).toBe('2026');
    });

    it('verifies APP_COPYRIGHT matches "Copyright © 2026 Ngự Võ. All rights reserved."', () => {
      expect(APP_COPYRIGHT).toBe('Copyright © 2026 Ngự Võ. All rights reserved.');
    });

    it('verifies APP_NAME and APP_ID match standard identities', () => {
      expect(APP_NAME).toBe('Local TTS Studio');
      expect(APP_ID).toBe('com.localtts.studio');
    });
  });

  // --------------------------------------------------------------------------
  // 2. package.json & Electron Builder Packaging Configuration
  // --------------------------------------------------------------------------
  describe('package.json & electron-builder Multiplatform Targets', () => {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    it('verifies package.json top-level metadata (version 1.0.0, author Ngự Võ)', () => {
      expect(pkg.version).toBe('1.0.0');
      expect(pkg.author).toBe('Ngự Võ');
      expect(pkg.name).toBe('local-tts-studio');
      expect(pkg.description).toBe('Local AI Text to Speech Studio');
    });

    it('verifies build scripts for mac, windows, and linux targets', () => {
      const { scripts } = pkg;
      expect(scripts['build:mac']).toContain('electron-builder --mac');
      expect(scripts['build:mac-universal']).toContain('electron-builder --mac --universal');
      expect(scripts['build:win']).toContain('electron-builder --win');
      expect(scripts['build:win-x64']).toContain('electron-builder --win --x64');
      expect(scripts['build:win-ia32']).toContain('electron-builder --win --ia32');
      expect(scripts['build:win-arm64']).toContain('electron-builder --win --arm64');
      expect(scripts['build:linux']).toContain('electron-builder --linux AppImage deb');
    });

    it('verifies electron-builder top-level build properties', () => {
      expect(pkg.build).toBeDefined();
      expect(pkg.build.appId).toBe('com.localtts.studio');
      expect(pkg.build.productName).toBe('Local TTS Studio');
      expect(pkg.build.copyright).toBe('Copyright © 2026 Ngự Võ. All rights reserved.');
      expect(pkg.build.directories?.output).toBe('release');
    });

    it('verifies macOS packaging configuration (universal, x64, arm64, minimum 12.0.0)', () => {
      const { mac } = pkg.build;
      expect(mac).toBeDefined();
      expect(mac.category).toBe('public.app-category.productivity');
      expect(mac.minimumSystemVersion).toBe('12.0.0');

      const targetDmg = mac.target.find((t: { target: string }) => t.target === 'dmg');
      const targetZip = mac.target.find((t: { target: string }) => t.target === 'zip');

      expect(targetDmg).toBeDefined();
      expect(targetDmg.arch).toContain('x64');
      expect(targetDmg.arch).toContain('arm64');
      expect(targetDmg.arch).toContain('universal');

      expect(targetZip).toBeDefined();
      expect(targetZip.arch).toContain('x64');
      expect(targetZip.arch).toContain('arm64');
      expect(targetZip.arch).toContain('universal');
    });

    it('verifies Windows packaging configuration (x64, ia32, arm64 for nsis and portable)', () => {
      const { win } = pkg.build;
      expect(win).toBeDefined();

      const targetNsis = win.target.find((t: { target: string }) => t.target === 'nsis');
      const targetPortable = win.target.find((t: { target: string }) => t.target === 'portable');

      expect(targetNsis).toBeDefined();
      expect(targetNsis.arch).toContain('x64');
      expect(targetNsis.arch).toContain('ia32');
      expect(targetNsis.arch).toContain('arm64');

      expect(targetPortable).toBeDefined();
      expect(targetPortable.arch).toContain('x64');
      expect(targetPortable.arch).toContain('ia32');
      expect(targetPortable.arch).toContain('arm64');
    });

    it('verifies Linux packaging configuration (AppImage, deb for x64, arm64)', () => {
      const { linux } = pkg.build;
      expect(linux).toBeDefined();
      expect(linux.category).toBe('AudioVideo');

      const targetAppImage = linux.target.find((t: { target: string }) => t.target === 'AppImage');
      const targetDeb = linux.target.find((t: { target: string }) => t.target === 'deb');

      expect(targetAppImage).toBeDefined();
      expect(targetAppImage.arch).toContain('x64');
      expect(targetAppImage.arch).toContain('arm64');

      expect(targetDeb).toBeDefined();
      expect(targetDeb.arch).toContain('x64');
      expect(targetDeb.arch).toContain('arm64');
    });
  });

  // --------------------------------------------------------------------------
  // 3. System Diagnostics & Version Telemetry
  // --------------------------------------------------------------------------
  describe('System Diagnostics Service (systemInfo.service.ts)', () => {
    const service = new SystemInfoService();

    it('reports appVersion as "1.0.0" and satisfies SystemInfoSchema', () => {
      const info = service.getSystemInfo();
      expect(info.appVersion).toBe('1.0.0');

      const parseResult = SystemInfoSchema.safeParse(info);
      expect(parseResult.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Localization Dictionary Keys (translations.ts)
  // --------------------------------------------------------------------------
  describe('Branding Localization Keys (translations.ts)', () => {
    const translationsPath = path.resolve(__dirname, '../src/renderer/i18n/translations.ts');
    const content = fs.readFileSync(translationsPath, 'utf-8');

    it('verifies Vietnamese translation keys for author, copyright, and releaseYear', () => {
      expect(content).toContain("author: 'Tác giả'");
      expect(content).toContain("copyright: 'Bản quyền thương hiệu'");
      expect(content).toContain("releaseYear: 'Năm phát hành'");
      expect(content).toContain("appName: 'Tên ứng dụng'");
      expect(content).toContain("appId: 'Mã định danh (App ID)'");
      expect(content).toContain("version: 'Phiên bản'");
      expect(content).toContain("localFirstDesc: 'Kiến trúc máy tính để bàn ưu tiên cục bộ (Local-First)'");
    });

    it('verifies English translation keys for author, copyright, and releaseYear', () => {
      expect(content).toContain("author: 'Author'");
      expect(content).toContain("copyright: 'Brand Copyright'");
      expect(content).toContain("releaseYear: 'Release Year'");
      expect(content).toContain("appName: 'Application Name'");
      expect(content).toContain("appId: 'Application ID'");
      expect(content).toContain("version: 'App Version'");
      expect(content).toContain("localFirstDesc: 'Local-First Desktop Architecture'");
    });
  });

  // --------------------------------------------------------------------------
  // 5. UI Presentation Verification (SettingsPage.tsx & AppSidebar.tsx)
  // --------------------------------------------------------------------------
  describe('UI Presentation & Component Watermarks', () => {
    it('verifies SettingsPage.tsx renders all 7 branding telemetry cards in General tab', () => {
      const settingsPagePath = path.resolve(__dirname, '../src/renderer/pages/SettingsPage.tsx');
      expect(fs.existsSync(settingsPagePath)).toBe(true);

      const content = fs.readFileSync(settingsPagePath, 'utf-8');

      // General tab brand cards
      expect(content).toContain('{APP_NAME}');
      expect(content).toContain('{APP_ID}');
      expect(content).toContain('v{systemInfo?.appVersion || APP_VERSION}');
      expect(content).toContain('{APP_YEAR}');
      expect(content).toContain('{APP_AUTHOR}');
      expect(content).toContain('{APP_COPYRIGHT}');
      expect(content).toContain('{t.settings.general.localFirstDesc}');

      // Ensure imports are in place
      expect(content).toContain('APP_NAME');
      expect(content).toContain('APP_ID');
      expect(content).toContain('APP_VERSION');
      expect(content).toContain('APP_AUTHOR');
      expect(content).toContain('APP_YEAR');
      expect(content).toContain('APP_COPYRIGHT');
    });

    it('verifies AppSidebar.tsx renders footer watermark with version, year, and author', () => {
      const sidebarPath = path.resolve(__dirname, '../src/renderer/components/layout/AppSidebar.tsx');
      expect(fs.existsSync(sidebarPath)).toBe(true);

      const content = fs.readFileSync(sidebarPath, 'utf-8');

      // Uncollapsed footer watermark: v{APP_VERSION} • © {APP_YEAR} {APP_AUTHOR}
      expect(content).toContain('v{APP_VERSION} • © {APP_YEAR} {APP_AUTHOR}');

      // Collapsed footer watermark
      expect(content).toContain('© {APP_YEAR}');
      expect(content).toContain('${APP_COPYRIGHT} (v${APP_VERSION})');
    });
  });
});
