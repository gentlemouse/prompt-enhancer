/**
 * 验证工具模块
 * P0-1.4: 自定义 Endpoint 校验
 */

import { t } from '../i18n';

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
    return { valid: false, error: t('validationEmptyEndpoint') };
  }

  // 尝试解析 URL
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { valid: false, error: t('validationInvalidUrl') };
  }

  // 强制要求 HTTPS
  if (url.protocol !== 'https:') {
    return {
      valid: false,
      error: t('validationHttpsOnly'),
    };
  }

  // 检查是否为本地地址（禁止）
  const hostname = url.hostname.toLowerCase();
  const localPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  if (localPatterns.some(pattern => hostname === pattern)) {
    return {
      valid: false,
      error: t('validationNoLocalhost'),
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
      error: t('validationNoPrivateIp'),
    };
  }

  // 检查路径是否合理
  if (!url.pathname || url.pathname === '/') {
    return {
      valid: false,
      error: t('validationPathRequired'),
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
    return { valid: false, error: t('validationEmptyKey') };
  }

  // 基本长度检查
  if (apiKey.length < 10) {
    return { valid: false, error: t('validationKeyTooShort') };
  }

  // 提供商特定的格式检查
  switch (provider) {
    case 'openai':
      if (!apiKey.startsWith('sk-')) {
        return {
          valid: false,
          error: t('validationOpenAIKeyFormat'),
        };
      }
      break;
    case 'anthropic':
      if (!apiKey.startsWith('sk-ant-')) {
        return {
          valid: false,
          error: t('validationAnthropicKeyFormat'),
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
