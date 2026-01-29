/**
 * 验证工具模块
 * P0-1.4: 自定义 Endpoint 校验
 */

/**
 * 验证 URL 是否为有效的 HTTPS 地址
 * @param url 要验证的 URL
 * @returns 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 验证自定义 API Endpoint
 * P0-1.4: 强制校验 HTTPS 协议
 * @param endpoint 要验证的 endpoint
 * @returns 验证结果
 */
export const validateEndpoint = (endpoint: string): ValidationResult => {
  if (!endpoint) {
    return { valid: false, error: '请输入 API 地址' };
  }

  // 尝试解析 URL
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { valid: false, error: '无效的 URL 格式' };
  }

  // 强制要求 HTTPS
  if (url.protocol !== 'https:') {
    return {
      valid: false,
      error: '安全原因，仅支持 HTTPS 协议。请使用 https:// 开头的地址',
    };
  }

  // 检查是否为本地地址（禁止）
  const hostname = url.hostname.toLowerCase();
  const localPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  if (localPatterns.some(pattern => hostname === pattern)) {
    return {
      valid: false,
      error: '安全原因，不支持本地地址',
    };
  }

  // 检查是否为私有 IP（禁止）
  const privateIPPatterns = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
  ];
  if (privateIPPatterns.some(pattern => pattern.test(hostname))) {
    return {
      valid: false,
      error: '安全原因，不支持私有网络地址',
    };
  }

  // 检查路径是否合理
  if (!url.pathname || url.pathname === '/') {
    return {
      valid: false,
      error: '请提供完整的 API 路径，例如 /v1/chat/completions',
    };
  }

  return { valid: true };
};

/**
 * 验证 API Key 格式
 * @param apiKey API Key
 * @param provider 提供商
 * @returns 验证结果
 */
export const validateApiKey = (
  apiKey: string,
  provider: string
): ValidationResult => {
  if (!apiKey) {
    return { valid: false, error: '请输入 API Key' };
  }

  // 基本长度检查
  if (apiKey.length < 10) {
    return { valid: false, error: 'API Key 格式不正确' };
  }

  // 提供商特定的格式检查
  switch (provider) {
    case 'openai':
      if (!apiKey.startsWith('sk-')) {
        return {
          valid: false,
          error: 'OpenAI API Key 应以 sk- 开头',
        };
      }
      break;
    case 'anthropic':
      if (!apiKey.startsWith('sk-ant-')) {
        return {
          valid: false,
          error: 'Anthropic API Key 应以 sk-ant- 开头',
        };
      }
      break;
    // DeepSeek 和自定义不做特殊检查
  }

  return { valid: true };
};

/**
 * 清理用户输入，防止 XSS
 * @param input 用户输入
 * @returns 清理后的文本
 */
export const sanitizeInput = (input: string): string => {
  // 基本的 HTML 实体转义
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
