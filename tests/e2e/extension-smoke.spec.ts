import { expect, test, chromium } from '@playwright/test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(process.cwd(), 'dist');
const CHROME_EXECUTABLE_PATH = process.env.CHROME_EXECUTABLE_PATH;
const PLAYWRIGHT_HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false';
const EXTENSION_ID_TIMEOUT_MS = 15_000;

test.skip(
  !CHROME_EXECUTABLE_PATH,
  'Extension e2e requires CHROME_EXECUTABLE_PATH to launch Chrome with unpacked extensions'
);

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

const CHATGPT_LIKE_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Prompt Enhancer ChatGPT-like Fixture</title>
    <style>
      :root {
        font-family: ui-sans-serif, system-ui, sans-serif;
        color: #111827;
        background: #f3f4f6;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }
      main {
        width: min(760px, calc(100vw - 48px));
      }
      form.chat-shell {
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 24px;
        padding: 18px 18px 12px;
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
      }
      .compose-row {
        display: flex;
        align-items: flex-end;
        gap: 12px;
      }
      .chat-compose {
        flex: 1;
        min-height: 108px;
        max-height: 240px;
        overflow: auto;
        padding: 14px 56px 14px 16px;
        border: 1px solid #e5e7eb;
        border-radius: 18px;
        outline: none;
        box-sizing: border-box;
        white-space: pre-wrap;
      }
      .chat-compose:focus {
        border-color: #94a3b8;
      }
      .composer-submit-btn {
        width: 40px;
        height: 40px;
        border: 0;
        border-radius: 999px;
        background: #111827;
        color: white;
        cursor: pointer;
        flex: none;
      }
      .composer-submit-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }
    </style>
  </head>
  <body>
    <main>
      <form class="chat-shell compose conversation" id="fixture-form">
        <div class="compose-row">
          <div
            id="prompt-textarea"
            class="chat-compose ProseMirror"
            contenteditable="true"
            role="textbox"
            aria-label="Message ChatGPT"
            aria-multiline="true"
            data-placeholder="Message ChatGPT"
          ><p>draft prompt</p></div>
          <textarea
            name="prompt-textarea"
            aria-hidden="true"
            tabindex="-1"
            style="display:none"
          ></textarea>
          <button
            id="fixture-send"
            class="composer-submit-btn"
            type="submit"
            aria-label="Send message"
            data-testid="send-button"
          >↑</button>
        </div>
      </form>
      <script>
        window.__fixtureMetrics = {
          submitCount: 0,
          sendClicks: 0,
          submittedTexts: [],
        };
        const form = document.getElementById('fixture-form');
        const compose = document.getElementById('prompt-textarea');
        const send = document.getElementById('fixture-send');
        form.addEventListener('submit', event => {
          event.preventDefault();
          window.__fixtureMetrics.submitCount += 1;
          window.__fixtureMetrics.submittedTexts.push(compose.innerText);
        });
        send.addEventListener('click', () => {
          window.__fixtureMetrics.sendClicks += 1;
        });
      </script>
    </main>
  </body>
</html>`;

type BrowserContext = Awaited<ReturnType<typeof chromium.launchPersistentContext>>;
type BrowserPage = Awaited<ReturnType<BrowserContext['newPage']>>;
type BrowserServiceWorker = BrowserContext['serviceWorkers'] extends () => Array<
  infer T
>
  ? T
  : never;

type ExtensionTestSession = {
  context: BrowserContext;
  page: BrowserPage;
  popupPage: BrowserPage;
  serviceWorker: BrowserServiceWorker;
  targetTabId: number;
  userDataDir: string;
};

const launchExtensionSession = async (
  html: string
): Promise<ExtensionTestSession> => {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'prompt-enhancer-e2e-'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    ...(CHROME_EXECUTABLE_PATH ? { executablePath: CHROME_EXECUTABLE_PATH } : {}),
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
  await page.setContent(html);
  await page.bringToFront();
  console.log('e2e: test page ready', page.url());

  let serviceWorker = context.serviceWorkers()[0] ?? null;
  if (serviceWorker) {
    console.log('e2e: service worker ready', serviceWorker.url());
  }

  const extensionId =
    (serviceWorker ? new URL(serviceWorker.url()).host : null) ||
    (await resolveExtensionIdFromServiceWorker(context)) ||
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

  return {
    context,
    page,
    popupPage,
    serviceWorker,
    targetTabId: targetTabId as number,
    userDataDir,
  };
};

const cleanupExtensionSession = async (
  session: ExtensionTestSession | undefined
): Promise<void> => {
  await session?.context?.close();
  if (session?.userDataDir) {
    await rm(session.userDataDir, { recursive: true, force: true });
  }
};

const waitForEnhancerHost = async (page: BrowserPage): Promise<void> => {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(document.getElementById('prompt-enhancer-shadow-host'))
      )
    )
    .toBe(true);
  console.log('e2e: shadow host detected');
};

const waitForEnhancerButtonVisible = async (page: BrowserPage): Promise<void> => {
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
};

const clickEnhancerButton = async (page: BrowserPage): Promise<void> => {
  const rect = await page.evaluate(() => {
    const host = document.getElementById(
      'prompt-enhancer-shadow-host'
    ) as HTMLElement | null;
    const button = host?.shadowRoot?.querySelector(
      '.prompt-enhancer-btn'
    ) as HTMLElement | null;
    if (!button) return null;

    const { left, top, width, height } = button.getBoundingClientRect();
    return { left, top, width, height };
  });

  expect(rect).not.toBeNull();
  if (!rect) return;

  await page.mouse.click(rect.left + rect.width / 2, rect.top + rect.height / 2);
};

test('loads the extension and injects the content script into a real page', async () => {
  let session: ExtensionTestSession | undefined;

  try {
    session = await launchExtensionSession(TEST_PAGE_HTML);

    await waitForEnhancerHost(session.page);

    await session.page.locator('#prompt').focus();
    console.log('e2e: prompt focused');

    await waitForEnhancerButtonVisible(session.page);
    await session.popupPage.close();
  } finally {
    await cleanupExtensionSession(session);
  }
});

test('does not submit the ChatGPT-like composer when clicking the enhancer button', async () => {
  let session: ExtensionTestSession | undefined;

  try {
    session = await launchExtensionSession(CHATGPT_LIKE_PAGE_HTML);

    await waitForEnhancerHost(session.page);

    await session.page.locator('#prompt-textarea').focus();
    console.log('e2e: fixture composer focused');

    await waitForEnhancerButtonVisible(session.page);
    await clickEnhancerButton(session.page);
    await session.page.waitForTimeout(300);

    await expect
      .poll(() =>
        session?.page.evaluate(
          () =>
            (
              window as Window & {
                __fixtureMetrics: {
                  submitCount: number;
                  sendClicks: number;
                  submittedTexts: string[];
                };
              }
            ).__fixtureMetrics
        )
      )
      .toEqual({
        submitCount: 0,
        sendClicks: 0,
        submittedTexts: [],
      });

    await session.popupPage.close();
  } finally {
    await cleanupExtensionSession(session);
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

const listDir = async (dirPath: string): Promise<string[]> => {
  try {
    return await readdir(dirPath);
  } catch {
    return [];
  }
};

const resolveExtensionIdFromServiceWorker = async (
  context: BrowserContext
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
