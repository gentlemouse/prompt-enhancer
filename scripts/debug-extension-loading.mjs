import { chromium } from '@playwright/test';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(process.cwd(), 'dist');
const CHROME_EXECUTABLE_PATH = process.env.CHROME_EXECUTABLE_PATH;
const PLAYWRIGHT_HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false';
const KEEP_PROFILE = process.env.DEBUG_KEEP_PROFILE === 'true';

const inspectJsonFile = async filePath => {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const listDir = async dirPath => {
  try {
    await access(dirPath);
    return await readdir(dirPath);
  } catch {
    return [];
  }
};

const main = async () => {
  const userDataDir = await mkdtemp(
    path.join(os.tmpdir(), 'prompt-enhancer-debug-')
  );

  let context;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      ...(CHROME_EXECUTABLE_PATH
        ? { executablePath: CHROME_EXECUTABLE_PATH }
        : {}),
      headless: PLAYWRIGHT_HEADLESS,
      ignoreHTTPSErrors: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });

    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(5000);

    const cdp = await context.newCDPSession(page);
    const targets = await cdp.send('Target.getTargets').catch(() => ({
      targetInfos: [],
    }));

    const preferencesPath = path.join(userDataDir, 'Default', 'Preferences');
    const preferences = await inspectJsonFile(preferencesPath);
    const extensionSettings = preferences?.extensions?.settings || null;

    const summary = {
      userDataDir,
      extensionPath: EXTENSION_PATH,
      executablePath: CHROME_EXECUTABLE_PATH || 'playwright-bundled-chromium',
      headless: PLAYWRIGHT_HEADLESS,
      pages: context.pages().map(currentPage => currentPage.url()),
      serviceWorkers: context.serviceWorkers().map(worker => worker.url()),
      backgroundPages: context.backgroundPages().map(bgPage => bgPage.url()),
      targetInfos: (targets.targetInfos || []).map(target => ({
        targetId: target.targetId,
        type: target.type,
        title: target.title,
        url: target.url,
        attached: target.attached,
      })),
      preferencesPath,
      extensionSettingsKeys: extensionSettings
        ? Object.keys(extensionSettings)
        : [],
      matchingExtensionEntries: extensionSettings
        ? Object.entries(extensionSettings)
            .filter(([, value]) => {
              return value?.path && path.resolve(value.path) === EXTENSION_PATH;
            })
            .map(([id, value]) => ({
              id,
              path: value.path,
              state: value.state,
              manifest: value.manifest
                ? {
                    name: value.manifest.name,
                    version: value.manifest.version,
                    manifest_version: value.manifest.manifest_version,
                  }
                : null,
            }))
        : [],
      defaultExtensionsDirEntries: await listDir(
        path.join(userDataDir, 'Default', 'Extensions')
      ),
      localExtensionSettingsEntries: await listDir(
        path.join(userDataDir, 'Default', 'Local Extension Settings')
      ),
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await context?.close().catch(() => {});
    if (!KEEP_PROFILE) {
      await rm(userDataDir, { recursive: true, force: true });
    }
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
