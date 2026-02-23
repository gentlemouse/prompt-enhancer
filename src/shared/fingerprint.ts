/**
 * 设备指纹模块
 *
 * 生成一个稳定的匿名设备 ID，用于 API 代理的限额控制。
 *
 * 防白嫖策略：
 * - 存储在 chrome.storage.sync（绑定 Google 账号，卸载重装不丢失）
 * - 同时备份到 chrome.storage.local（离线场景兜底）
 * - 不包含任何可识别个人身份的信息
 */

/** 存储键 */
const FINGERPRINT_KEY = 'prompt_enhancer_device_fp';

/**
 * 生成随机设备 ID
 * 格式：pe_<时间戳36进制>_<随机字符串>
 */
const generateFingerprint = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `pe_${timestamp}_${random}`;
};

/**
 * 获取或创建设备指纹
 *
 * 优先级：sync > local > 新生成
 * 生成后同时写入 sync 和 local，确保最大持久性
 */
export const getDeviceFingerprint = async (): Promise<string> => {
  try {
    const syncResult = await chrome.storage.sync.get(FINGERPRINT_KEY);
    if (syncResult[FINGERPRINT_KEY]) {
      await chrome.storage.local.set({ [FINGERPRINT_KEY]: syncResult[FINGERPRINT_KEY] });
      return syncResult[FINGERPRINT_KEY];
    }

    const localResult = await chrome.storage.local.get(FINGERPRINT_KEY);
    if (localResult[FINGERPRINT_KEY]) {
      await chrome.storage.sync.set({ [FINGERPRINT_KEY]: localResult[FINGERPRINT_KEY] });
      return localResult[FINGERPRINT_KEY];
    }

    const fp = generateFingerprint();
    await Promise.all([
      chrome.storage.sync.set({ [FINGERPRINT_KEY]: fp }),
      chrome.storage.local.set({ [FINGERPRINT_KEY]: fp }),
    ]);
    return fp;
  } catch {
    const localResult = await chrome.storage.local.get(FINGERPRINT_KEY);
    if (localResult[FINGERPRINT_KEY]) return localResult[FINGERPRINT_KEY];

    const fp = generateFingerprint();
    await chrome.storage.local.set({ [FINGERPRINT_KEY]: fp });
    return fp;
  }
};
