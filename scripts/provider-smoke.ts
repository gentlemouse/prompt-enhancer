/**
 * BYOK provider smoke test.
 *
 * Usage:
 *   npm run smoke:providers
 *   npm run smoke:providers -- --providers=openai,gemini
 *   npm run smoke:providers -- --config=./scripts/my-config.json
 *
 * Configuration Priority:
 *   CLI Arguments > process.env > .env.local > JSON Config
 */

import { API_PROVIDERS } from '../src/shared/constants.ts';
import type { APIProvider } from '../src/shared/types.ts';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Load .env.local if it exists
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, quiet: true });
}

type ProviderUnderTest = Exclude<APIProvider, 'proxy' | 'custom'>;

interface ProviderRuntimeConfig {
  provider: ProviderUnderTest;
  keyEnv: string;
  modelEnv: string;
}

interface SmokeResult {
  provider: ProviderUnderTest;
  skipped: boolean;
  ok: boolean;
  message: string;
  model?: string;
}

const PROVIDERS: ProviderRuntimeConfig[] = [
  { provider: 'openai', keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL' },
  {
    provider: 'anthropic',
    keyEnv: 'ANTHROPIC_API_KEY',
    modelEnv: 'ANTHROPIC_MODEL',
  },
  {
    provider: 'deepseek',
    keyEnv: 'DEEPSEEK_API_KEY',
    modelEnv: 'DEEPSEEK_MODEL',
  },
  { provider: 'gemini', keyEnv: 'GEMINI_API_KEY', modelEnv: 'GEMINI_MODEL' },
  { provider: 'kimi', keyEnv: 'KIMI_API_KEY', modelEnv: 'KIMI_MODEL' },
  {
    provider: 'minimax',
    keyEnv: 'MINIMAX_API_KEY',
    modelEnv: 'MINIMAX_MODEL',
  },
  { provider: 'qwen', keyEnv: 'QWEN_API_KEY', modelEnv: 'QWEN_MODEL' },
  { provider: 'zhipu', keyEnv: 'ZHIPU_API_KEY', modelEnv: 'ZHIPU_MODEL' },
];

const PROMPT = 'Reply with exactly OK.';
const REQUEST_TIMEOUT_MS = 30000;
const PLACEHOLDER_PATTERNS = [
  /^your[_-]/i,
  /_here$/i,
  /^replace[_-]/i,
  /^example[_-]/i,
  /^test[_-]?key$/i,
];

const getArgValue = (prefix: string): string | null => {
  const flag = process.argv.find((arg) => arg.startsWith(prefix));
  return flag ? flag.slice(prefix.length) : null;
};

const parseSelectedProviders = (): Set<ProviderUnderTest> | null => {
  const value = getArgValue('--providers=');
  if (!value) return null;

  const values = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean) as ProviderUnderTest[];

  return new Set(values);
};

const loadJsonConfig = (): Record<string, { apiKey?: string; model?: string }> => {
  const configPath = getArgValue('--config=');
  if (!configPath) return {};

  try {
    const absolutePath = path.resolve(process.cwd(), configPath);
    if (!fs.existsSync(absolutePath)) {
      console.warn(`配置文件未找到: ${absolutePath}`);
      return {};
    }
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    console.error(`解析配置文件失败: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
};

const isPlaceholderValue = (value: string | undefined): boolean => {
  if (!value) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
};

const withTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const extractOpenAIContent = (data: unknown): string => {
  if (
    typeof data === 'object' &&
    data !== null &&
    'choices' in data &&
    Array.isArray((data as { choices?: unknown[] }).choices)
  ) {
    const firstChoice = (data as { choices: Array<{ message?: { content?: unknown } }> })
      .choices[0];
    const content = firstChoice?.message?.content;
    if (typeof content === 'string') {
      return content.trim();
    }
  }

  throw new Error('响应中缺少 choices[0].message.content');
};

const extractAnthropicContent = (data: unknown): string => {
  if (
    typeof data === 'object' &&
    data !== null &&
    'content' in data &&
    Array.isArray((data as { content?: unknown[] }).content)
  ) {
    const firstBlock = (data as { content: Array<{ text?: unknown }> }).content[0];
    const text = firstBlock?.text;
    if (typeof text === 'string') {
      return text.trim();
    }
  }

  throw new Error('响应中缺少 content[0].text');
};

const formatError = async (response: Response): Promise<string> => {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as {
      error?: { message?: string } | string;
      message?: string;
    };

    if (typeof data.error === 'string') return data.error;
    if (typeof data.error?.message === 'string') return data.error.message;
    if (typeof data.message === 'string') return data.message;
  } catch {
    // non-json response
  }

  return text.slice(0, 300) || `HTTP ${response.status}`;
};

const extractMinimaxBusinessError = (data: unknown): string | null => {
  if (
    typeof data === 'object' &&
    data !== null &&
    'base_resp' in data &&
    typeof (data as { base_resp?: unknown }).base_resp === 'object' &&
    (data as { base_resp: { status_code?: unknown } }).base_resp !== null
  ) {
    const baseResp = (data as {
      base_resp: { status_code?: unknown; status_msg?: unknown };
    }).base_resp;

    if (typeof baseResp.status_code === 'number' && baseResp.status_code !== 0) {
      return typeof baseResp.status_msg === 'string'
        ? baseResp.status_msg
        : `MiniMax 业务错误: ${baseResp.status_code}`;
    }
  }

  return null;
};

const runOpenAICompatibleSmoke = async (
  provider: ProviderUnderTest,
  apiKey: string,
  model: string
): Promise<string> => {
  const maxTokens =
    provider === 'minimax' ? 128 : provider === 'gemini' ? 64 : 16;
  const requestBody: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: PROMPT }],
    temperature: 0,
    max_tokens: maxTokens,
  };

  if (provider === 'zhipu') {
    requestBody.thinking = { type: 'disabled' };
  }

  const endpoints =
    provider === 'minimax'
      ? ['https://api.minimaxi.com/v1/chat/completions', 'https://api.minimax.io/v1/chat/completions']
      : [API_PROVIDERS[provider].endpoint];

  let data: unknown = null;
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    const response = await withTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = new Error(await formatError(response));
      const canFallback =
        provider === 'minimax' &&
        endpoint.includes('api.minimaxi.com') &&
        /invalid api key|authorized_error|2049/i.test(error.message);

      if (canFallback) {
        lastError = error;
        continue;
      }

      throw error;
    }

    data = await response.json();
    lastError = null;
    break;
  }

  if (lastError) {
    throw lastError;
  }

  if (provider === 'minimax') {
    const businessError = extractMinimaxBusinessError(data);
    if (businessError) {
      throw new Error(businessError);
    }
  }

  return extractOpenAIContent(data);
};

const runAnthropicSmoke = async (apiKey: string, model: string): Promise<string> => {
  const response = await withTimeout(API_PROVIDERS.anthropic.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      temperature: 0,
      system: 'Reply with exactly OK.',
      messages: [{ role: 'user', content: PROMPT }],
    }),
  });

  if (!response.ok) {
    throw new Error(await formatError(response));
  }

  return extractAnthropicContent(await response.json());
};

const runSmoke = async (
  runtimeConfig: ProviderRuntimeConfig,
  explicitlySelected: boolean,
  jsonConfig: Record<string, { apiKey?: string; model?: string }>
): Promise<SmokeResult> => {
  // Priority: process.env > JSON Config
  const apiKey = (process.env[runtimeConfig.keyEnv] || jsonConfig[runtimeConfig.provider]?.apiKey)?.trim();
  const model =
    (process.env[runtimeConfig.modelEnv] || jsonConfig[runtimeConfig.provider]?.model)?.trim() ||
    API_PROVIDERS[runtimeConfig.provider].defaultModel;

  if (!apiKey) {
    return {
      provider: runtimeConfig.provider,
      skipped: true,
      ok: !explicitlySelected,
      message: explicitlySelected
        ? `缺少 API Key (检查环境变量 ${runtimeConfig.keyEnv} 或配置文件)`
        : `未配置 API Key，已跳过`,
    };
  }

  if (isPlaceholderValue(apiKey)) {
    return {
      provider: runtimeConfig.provider,
      skipped: true,
      ok: !explicitlySelected,
      message: explicitlySelected
        ? '检测到占位符 API Key，请替换成真实值后重试'
        : '检测到占位符 API Key，已跳过',
      model,
    };
  }

  try {
    const content =
      runtimeConfig.provider === 'anthropic'
        ? await runAnthropicSmoke(apiKey, model)
        : await runOpenAICompatibleSmoke(runtimeConfig.provider, apiKey, model);

    return {
      provider: runtimeConfig.provider,
      skipped: false,
      ok:
        runtimeConfig.provider === 'minimax'
          ? /\bOK\b/i.test(content)
          : /^OK[.!]?$/i.test(content),
      message: `返回内容: ${JSON.stringify(content)}`,
      model,
    };
  } catch (error) {
    return {
      provider: runtimeConfig.provider,
      skipped: false,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      model,
    };
  }
};

const main = async (): Promise<void> => {
  const selectedProviders = parseSelectedProviders();
  const jsonConfig = loadJsonConfig();

  const providersToRun = PROVIDERS.filter(({ provider }) =>
    selectedProviders ? selectedProviders.has(provider) : true
  );

  if (providersToRun.length === 0) {
    console.error('未匹配到任何 provider；请检查 --providers 参数。');
    process.exit(1);
  }

  console.log('Lynx/灵犀 — Provider BYOK Smoke Test\n');
  console.log('配置来源:');
  if (fs.existsSync(envLocalPath)) console.log(`- 加载了环境变量: .env.local`);
  const configPath = getArgValue('--config=');
  if (configPath) console.log(`- 加载了配置文件: ${configPath}`);
  console.log('\n说明: 仅对已提供 API key 的 provider 发起真实请求；每次请求都可能产生计费。');

  const results: SmokeResult[] = [];

  for (const providerConfig of providersToRun) {
    const explicitlySelected = selectedProviders?.has(providerConfig.provider) ?? false;
    const result = await runSmoke(providerConfig, explicitlySelected, jsonConfig);
    results.push(result);

    const prefix = result.skipped ? '○' : result.ok ? '✓' : '✗';
    const modelInfo = result.model ? ` (${result.model})` : '';
    console.log(`${prefix} ${result.provider}${modelInfo}: ${result.message}`);
  }

  const failed = results.filter((result) => !result.ok && !result.skipped);
  const missingRequiredKeys = results.filter(
    (result) => result.skipped && selectedProviders?.has(result.provider)
  );
  const ranCount = results.filter((result) => !result.skipped).length;

  console.log('\n--- Summary ---');
  console.log(`ran=${ranCount} failed=${failed.length} skipped=${results.length - ranCount}`);

  if (failed.length > 0 || missingRequiredKeys.length > 0) {
    process.exit(1);
  }

  if (ranCount === 0) {
    console.log('没有可运行的 provider；请通过 .env.local 或 JSON 配置文件设置 API key。');
  } else {
    console.log('所有已执行的 provider smoke test 均通过。');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
