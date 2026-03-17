import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, '..');
const srcRoot = path.join(projectRoot, 'src');
const localeFiles = {
  en: path.join(projectRoot, '_locales/en/messages.json'),
  zh: path.join(projectRoot, '_locales/zh_CN/messages.json'),
};

const readText = (filePath: string): string => fs.readFileSync(filePath, 'utf8');

const walkFiles = (dirPath: string): string[] => {
  const result: string[] = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx|js|jsx|html)$/.test(entry.name)) {
      result.push(fullPath);
    }
  }

  return result;
};

const collectUsedI18nKeys = (files: string[]): Set<string> => {
  const patterns = [
    /\bt\(\s*['"]([A-Za-z0-9_]+)['"]/g,
    /getMessage\(\s*['"]([A-Za-z0-9_]+)['"]/g,
    /data-i18n(?:-html|-placeholder|-title)?=["']([A-Za-z0-9_]+)["']/g,
  ];
  const keys = new Set<string>();

  for (const file of files) {
    const source = readText(file);
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        if (match[1] !== 'key') {
          keys.add(match[1]);
        }
      }
    }
  }

  return keys;
};

describe('i18n coverage', () => {
  it('keeps locale key sets in sync between English and Chinese', () => {
    const en = JSON.parse(readText(localeFiles.en)) as Record<string, unknown>;
    const zh = JSON.parse(readText(localeFiles.zh)) as Record<string, unknown>;

    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('keeps all statically referenced i18n keys defined in both locale files', () => {
    const en = JSON.parse(readText(localeFiles.en)) as Record<string, unknown>;
    const zh = JSON.parse(readText(localeFiles.zh)) as Record<string, unknown>;
    const usedKeys = [...collectUsedI18nKeys(walkFiles(srcRoot))].sort();

    expect(usedKeys.every(key => key in en)).toBe(true);
    expect(usedKeys.every(key => key in zh)).toBe(true);
  });

  it('does not leave hardcoded visible copy in key UI surfaces', () => {
    const popupHtml = readText(path.join(srcRoot, 'popup/index.html'));
    const onboarding = readText(path.join(srcRoot, 'popup/onboarding.ts'));
    const trialPrompt = readText(
      path.join(srcRoot, 'content/ui/trial-prompt.ts')
    );
    const backgroundIndex = readText(path.join(srcRoot, 'background/index.ts'));

    expect(popupHtml).not.toContain('>推荐<');
    expect(popupHtml).not.toContain('>无需特殊网络，稳定调用原生 API<');
    expect(popupHtml).not.toContain('>API Key<');
    expect(onboarding).not.toMatch(/data-i18n="[^"]+">[^<\s]/);
    expect(trialPrompt).not.toContain('aria-label="Close"');
    expect(backgroundIndex).not.toContain("error: 'Missing prompt parameter'");
    expect(backgroundIndex).not.toContain("error: 'Cannot get tab ID'");
    expect(backgroundIndex).not.toContain("error: 'Missing tabId parameter'");
    expect(backgroundIndex).not.toContain("error: 'Missing origin parameter'");
    expect(backgroundIndex).not.toContain("error: 'Unknown action type'");
  });
});
