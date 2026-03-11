import { expect, test, chromium } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(process.cwd(), 'dist');
const CHROME_EXECUTABLE_PATH = process.env.CHROME_EXECUTABLE_PATH;
const PLAYWRIGHT_HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false';
const EXTENSION_ID_TIMEOUT_MS = 15_000;

const TEST_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Prompt Enhancer Smoke</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f6f7fb;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      main {
        width: min(760px, calc(100vw - 48px));
      }
      textarea {
        width: 100%;
        min-height: 160px;
        padding: 16px;
        border: 1px solid #cfd4e2;
        border-radius: 16px;
        font-size: 16px;
        resize: none;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <main>
      <label for="prompt">Prompt</label>
      <textarea id="prompt" placeholder="Describe your task"></textarea>
    </main>
  </body>
</html>`;

test('loads the extension and injects the content script into a real page', async () => {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'prompt-enhancer-e2e-'));

  let context:
    | Awaited<ReturnType<typeof chromium.launchPersistentContext>>
    | undefined;

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
    console.log('e2e: context launched');

    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.setContent(TEST_PAGE_HTML);
    await page.bringToFront();
    console.log('e2e: test page ready', page.url());

    let serviceWorker = context.serviceWorkers()[0] ?? null;
    if (serviceWorker) {
      console.log('e2e: service worker ready', serviceWorker.url());
    }

    const extensionId =
      (serviceWorker ? new URL(serviceWorker.url()).host : null) ||
      (await waitForExtensionId(userDataDir));
    console.log('e2e: extension id', extensionId);

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await expect(popupPage.locator('#saveBtn')).toBeVisible();
    console.log('e2e: popup ready');

    serviceWorker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
    console.log('e2e: service worker ready', serviceWorker.url());

    const targetTabId = await serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      return tab?.id ?? null;
    });

    expect(targetTabId).not.toBeNull();
    console.log('e2e: target tab id', targetTabId);

    await popupPage.evaluate(origin => {
      const existingButton = document.getElementById('grant-permission-smoke');
      existingButton?.remove();

      const button = document.createElement('button');
      button.id = 'grant-permission-smoke';
      button.textContent = 'grant';
      button.addEventListener('click', async () => {
        const granted = await chrome.permissions.request({
          origins: [origin + '/*'],
        });
        (window as Window & { __grantPermissionResult?: boolean }).__grantPermissionResult =
          granted;
      });
      document.body.appendChild(button);
    }, 'https://example.com');

    await popupPage.locator('#grant-permission-smoke').click();
    await expect
      .poll(() =>
        popupPage.evaluate(
          () =>
            (window as Window & { __grantPermissionResult?: boolean })
              .__grantPermissionResult
        )
      )
      .toBe(true);
    console.log('e2e: permission granted');

    const injectionResult = await popupPage.evaluate(async tabId => {
      return chrome.runtime.sendMessage({
        action: 'injectContentScript',
        tabId,
      });
    }, targetTabId);

    expect(injectionResult).toEqual({ success: true });
    console.log('e2e: injection succeeded');

    await expect
      .poll(() =>
        page.evaluate(() => Boolean(document.getElementById('prompt-enhancer-shadow-host')))
      )
      .toBe(true);
    console.log('e2e: shadow host detected');

    await page.locator('#prompt').focus();
    console.log('e2e: prompt focused');

    await expect
      .poll(() =>
        page.evaluate(() => {
          const host = document.getElementById(
            'prompt-enhancer-shadow-host'
          ) as HTMLElement | null;
          const container = host?.shadowRoot?.querySelector(
            '.prompt-enhancer-container'
          ) as HTMLElement | null;
          return container ? window.getComputedStyle(container).display : 'missing';
        })
      )
      .toBe('flex');
    console.log('e2e: button visible');
    await popupPage.close();
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

const waitForExtensionId = async (userDataDir: string): Promise<string> => {
  const preferencesPath = path.join(userDataDir, 'Default', 'Preferences');
  const localExtensionSettingsPath = path.join(
    userDataDir,
    'Default',
    'Local Extension Settings'
  );
  const deadline = Date.now() + EXTENSION_ID_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const raw = await readFile(preferencesPath, 'utf8');
      const preferences = JSON.parse(raw) as {
        extensions?: {
          settings?: Record<
            string,
            {
              path?: string;
            }
          >;
        };
      };

      const settings = preferences.extensions?.settings ?? {};
      for (const [extensionId, config] of Object.entries(settings)) {
        if (config.path && path.resolve(config.path) === EXTENSION_PATH) {
          return extensionId;
        }
      }
    } catch {
      // Browser may not have materialized Preferences yet.
    }

    const localExtensionIds = await listDir(localExtensionSettingsPath);
    if (localExtensionIds.length > 0) {
      return localExtensionIds[0];
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error('Timed out while resolving the unpacked extension ID');
};

const resolveExtensionIdFromServiceWorker = async (
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>
): Promise<string | null> => {
  try {
    const serviceWorker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent('serviceworker', { timeout: 5_000 }));
    return new URL(serviceWorker.url()).host;
  } catch {
    return null;
  }
};
