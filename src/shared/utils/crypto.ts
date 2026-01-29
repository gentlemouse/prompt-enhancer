/**
 * 加密工具模块
 * P0-1.2: 为 API Key 提供简单的混淆/加密保护
 *
 * 注意：这是客户端加密，主要防止明文存储和简单的窥探，
 * 不能防止专业攻击者的逆向工程。对于更高安全级别，
 * 建议使用后端代理方案。
 */

/** 加密密钥（基于扩展 ID 生成） */
const getEncryptionKey = (): string => {
  // 使用扩展 ID 作为密钥的一部分，增加唯一性
  const extensionId = chrome.runtime?.id || 'prompt-enhancer-default';
  return `PE_${extensionId}_KEY`;
};

/**
 * 简单的异或加密
 * @param text 要加密的文本
 * @param key 密钥
 * @returns 加密后的 Base64 字符串
 */
const xorEncrypt = (text: string, key: string): string => {
  const result: number[] = [];
  for (let i = 0; i < text.length; i++) {
    result.push(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(String.fromCharCode(...result));
};

/**
 * 简单的异或解密
 * @param encrypted Base64 加密字符串
 * @param key 密钥
 * @returns 解密后的原文
 */
const xorDecrypt = (encrypted: string, key: string): string => {
  try {
    const decoded = atob(encrypted);
    const result: string[] = [];
    for (let i = 0; i < decoded.length; i++) {
      result.push(
        String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length))
      );
    }
    return result.join('');
  } catch {
    return '';
  }
};

/**
 * 加密 API Key
 * @param apiKey 原始 API Key
 * @returns 加密后的字符串
 */
export const encryptApiKey = (apiKey: string): string => {
  if (!apiKey) return '';
  const key = getEncryptionKey();
  // 添加时间戳和随机前缀增加混淆
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const payload = `${timestamp}:${random}:${apiKey}`;
  return xorEncrypt(payload, key);
};

/**
 * 解密 API Key
 * @param encrypted 加密后的字符串
 * @returns 原始 API Key
 */
export const decryptApiKey = (encrypted: string): string => {
  if (!encrypted) return '';
  const key = getEncryptionKey();
  const payload = xorDecrypt(encrypted, key);
  // 提取实际的 API Key（跳过时间戳和随机前缀）
  const parts = payload.split(':');
  if (parts.length >= 3) {
    return parts.slice(2).join(':');
  }
  // 兼容旧格式（直接存储的 Key）
  return payload;
};

/**
 * 验证是否为加密格式
 * @param value 要检查的值
 * @returns 是否为加密格式
 */
export const isEncryptedFormat = (value: string): boolean => {
  if (!value) return false;
  try {
    // 尝试解码，如果成功且包含分隔符，则认为是加密格式
    const decoded = atob(value);
    return decoded.includes(':') || !value.startsWith('sk-');
  } catch {
    return false;
  }
};
