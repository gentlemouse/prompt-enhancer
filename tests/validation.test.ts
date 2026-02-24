/**
 * 验证工具测试
 *
 * 覆盖目标：
 * - Endpoint 验证（HTTPS、格式、私有 IP、本地地址）
 * - API Key 验证（格式、提供商前缀）
 * - 输入清理（XSS 防护）
 */

import { describe, it, expect } from 'vitest';
import {
  validateEndpoint,
  validateApiKey,
  sanitizeInput,
} from '@shared/utils/validation';

describe('validateEndpoint', () => {
  describe('有效 endpoint', () => {
    it('标准 HTTPS endpoint 应通过', () => {
      const result = validateEndpoint('https://api.openai.com/v1/chat/completions');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('自定义域名应通过', () => {
      const result = validateEndpoint('https://my-api.example.com/v1/completions');
      expect(result.valid).toBe(true);
    });
  });

  describe('空值和格式错误', () => {
    it('空字符串应失败', () => {
      const result = validateEndpoint('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      // 测试环境 t() 返回 i18n key；运行时为翻译文案
      expect(result.error === 'validationEmptyEndpoint' || result.error?.includes('请输入')).toBe(true);
    });

    it('无效 URL 格式应失败', () => {
      const result = validateEndpoint('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationInvalidUrl' || result.error?.includes('无效')).toBe(true);
    });
  });

  describe('协议检查', () => {
    it('HTTP 应被拒绝', () => {
      const result = validateEndpoint('http://api.example.com/v1/chat');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationHttpsOnly' || result.error?.includes('HTTPS')).toBe(true);
    });

    it('FTP 应被拒绝', () => {
      const result = validateEndpoint('ftp://files.example.com/api');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationHttpsOnly' || result.error?.includes('HTTPS')).toBe(true);
    });
  });

  describe('本地地址检查', () => {
    it('localhost 应被拒绝', () => {
      const result = validateEndpoint('https://localhost/v1/chat');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationNoLocalhost' || result.error?.includes('本地地址')).toBe(true);
    });

    it('127.0.0.1 应被拒绝', () => {
      const result = validateEndpoint('https://127.0.0.1/v1/chat');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationNoLocalhost' || result.error?.includes('本地地址')).toBe(true);
    });

    it('0.0.0.0 应被拒绝', () => {
      const result = validateEndpoint('https://0.0.0.0/v1/chat');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationNoLocalhost' || result.error?.includes('本地地址')).toBe(true);
    });
  });

  describe('私有 IP 检查', () => {
    it('10.x.x.x 应被拒绝', () => {
      const result = validateEndpoint('https://10.0.0.1/v1/chat');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationNoPrivateIp' || result.error?.includes('私有网络')).toBe(true);
    });

    it('172.16.x.x 应被拒绝', () => {
      const result = validateEndpoint('https://172.16.0.1/v1/chat');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationNoPrivateIp' || result.error?.includes('私有网络')).toBe(true);
    });

    it('192.168.x.x 应被拒绝', () => {
      const result = validateEndpoint('https://192.168.1.1/v1/chat');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationNoPrivateIp' || result.error?.includes('私有网络')).toBe(true);
    });

    it('172.32.x.x 不应被拒绝（非私有范围）', () => {
      const result = validateEndpoint('https://172.32.0.1/v1/chat');
      expect(result.valid).toBe(true);
    });
  });

  describe('路径检查', () => {
    it('仅域名无路径应失败', () => {
      const result = validateEndpoint('https://api.example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationPathRequired' || result.error?.includes('完整的 API 路径')).toBe(true);
    });

    it('仅有根路径应失败', () => {
      const result = validateEndpoint('https://api.example.com/');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationPathRequired' || result.error?.includes('完整的 API 路径')).toBe(true);
    });
  });
});

describe('validateApiKey', () => {
  describe('通用检查', () => {
    it('空字符串应失败', () => {
      const result = validateApiKey('', 'openai');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationEmptyKey' || result.error?.includes('请输入')).toBe(true);
    });

    it('过短的 key 应失败', () => {
      const result = validateApiKey('short', 'openai');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationKeyTooShort' || result.error?.includes('格式不正确')).toBe(true);
    });
  });

  describe('OpenAI 检查', () => {
    it('以 sk- 开头应通过', () => {
      const result = validateApiKey('sk-1234567890abcdef', 'openai');
      expect(result.valid).toBe(true);
    });

    it('不以 sk- 开头应失败', () => {
      const result = validateApiKey('pk-1234567890abcdef', 'openai');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationOpenAIKeyFormat' || result.error?.includes('sk-')).toBe(true);
    });
  });

  describe('Anthropic 检查', () => {
    it('以 sk-ant- 开头应通过', () => {
      const result = validateApiKey('sk-ant-1234567890abcdef', 'anthropic');
      expect(result.valid).toBe(true);
    });

    it('仅以 sk- 开头应失败', () => {
      const result = validateApiKey('sk-1234567890abcdef', 'anthropic');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error === 'validationAnthropicKeyFormat' || result.error?.includes('sk-ant-')).toBe(true);
    });
  });

  describe('DeepSeek 和自定义', () => {
    it('DeepSeek 不做特殊前缀检查', () => {
      const result = validateApiKey('any-valid-key-12345', 'deepseek');
      expect(result.valid).toBe(true);
    });

    it('自定义不做特殊前缀检查', () => {
      const result = validateApiKey('custom-key-1234567', 'custom');
      expect(result.valid).toBe(true);
    });
  });
});

describe('sanitizeInput', () => {
  it('应转义 &', () => {
    expect(sanitizeInput('a & b')).toBe('a &amp; b');
  });

  it('应转义 <', () => {
    expect(sanitizeInput('<script>')).toBe('&lt;script&gt;');
  });

  it('应转义 >', () => {
    expect(sanitizeInput('a > b')).toBe('a &gt; b');
  });

  it('应转义双引号', () => {
    expect(sanitizeInput('"hello"')).toBe('&quot;hello&quot;');
  });

  it('应转义单引号', () => {
    expect(sanitizeInput("it's")).toBe("it&#039;s");
  });

  it('应处理组合场景', () => {
    const input = '<img src="x" onerror="alert(\'xss\')">';
    const result = sanitizeInput(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
  });

  it('普通文本不应被修改', () => {
    expect(sanitizeInput('hello world')).toBe('hello world');
  });

  it('中文文本不应被修改', () => {
    expect(sanitizeInput('你好世界')).toBe('你好世界');
  });
});
