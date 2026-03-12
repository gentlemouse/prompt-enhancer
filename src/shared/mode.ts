import type { APIProvider } from './types';

/**
 * 运行时可用的配置视图（解密后的 API Key）。
 */
export interface RuntimeConfigView {
  apiProvider: APIProvider;
  apiKey: string;
}

const FREE_MODE_PLACEHOLDER_KEYS = new Set([
  'proxy-mode',
  'free-mode',
  'builtin-free',
]);

/**
 * 判断当前配置是否为“有效的 BYOK 配置”。
 *
 * 规则：
 * - API Key 为空或仅空白字符 => 非 BYOK
 * - provider 为 proxy => 非 BYOK（属于内置免费模式）
 * - 历史占位 key（如 proxy-mode）=> 非 BYOK
 */
export const isByokConfigured = (
  config: RuntimeConfigView | null | undefined
): config is RuntimeConfigView => {
  if (!config) return false;

  const key = config.apiKey.trim();
  if (!key) return false;
  if (config.apiProvider === 'proxy') return false;

  return !FREE_MODE_PLACEHOLDER_KEYS.has(key.toLowerCase());
};
