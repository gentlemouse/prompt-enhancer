/**
 * API 配置验证脚本
 *
 * 验证各提供商端点可达性及免费代理是否正常。
 * 运行: npx tsx scripts/verify-apis.ts
 *
 * 注意：除 proxy 外，其他提供商需要有效的 API Key 才能完整测试。
 * 本脚本主要验证 proxy（免费模式）和端点格式。
 */

/**
 * 使用内联配置避免路径解析问题
 */
const PROXY_ENDPOINT = 'https://prompt-enhancer-proxy.gentlemouse666.workers.dev/v1/enhance';
const QUOTA_URL = PROXY_ENDPOINT.replace('/v1/enhance', '/v1/quota');

async function testProxyQuota(): Promise<boolean> {
  try {
    const res = await fetch(QUOTA_URL, { method: 'GET' });
    const data = (await res.json()) as { limit?: number; used?: number; remaining?: number };
    if (res.ok && typeof data.remaining === 'number') {
      console.log(`  ✓ Proxy quota: ${data.remaining}/${data.limit ?? 10} remaining`);
      return true;
    }
    console.log(`  ✗ Proxy quota: unexpected response`, data);
    return false;
  } catch (e) {
    console.log(`  ✗ Proxy quota:`, (e as Error).message);
    return false;
  }
}

async function testProxyEnhance(): Promise<boolean> {
  try {
    const res = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Reply with exactly: OK' },
          { role: 'user', content: 'Say OK' },
        ],
        stream: false,
      }),
    });
    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data?.choices?.[0]?.message?.content ?? '';
      console.log(`  ✓ Proxy enhance: responded (${content.slice(0, 30)}...)`);
      return true;
    }
    const err = JSON.parse(text) as { error?: string };
    if (res.status === 429) {
      console.log(`  ○ Proxy enhance: 429 (quota exhausted, expected if over limit)`);
      return true; // 限额用尽也算配置正确
    }
    console.log(`  ✗ Proxy enhance: ${res.status}`, err.error ?? text.slice(0, 80));
    return false;
  } catch (e) {
    console.log(`  ✗ Proxy enhance:`, (e as Error).message);
    return false;
  }
}

function printProviderConfigs(): void {
  const configs: Record<string, { model: string; endpoint: string }> = {
    openai: { model: 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1/chat/completions' },
    anthropic: { model: 'claude-haiku-4-5-20251001', endpoint: 'https://api.anthropic.com/v1/messages' },
    deepseek: { model: 'deepseek-chat', endpoint: 'https://api.deepseek.com/v1/chat/completions' },
    gemini: {
      model: 'gemini-2.0-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    },
    kimi: { model: 'kimi-k2-turbo-preview', endpoint: 'https://api.moonshot.ai/v1/chat/completions' },
    minimax: { model: 'M2-her', endpoint: 'https://api.minimax.io/v1/text/chatcompletion_v2' },
    qwen: { model: 'qwen-plus', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' },
    zhipu: { model: 'glm-4-flash', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
  };
  console.log('\n--- Provider configs ---');
  for (const [p, cfg] of Object.entries(configs)) {
    console.log(`  ${p}: ${cfg.model} @ ${cfg.endpoint}`);
  }
}

async function main(): Promise<void> {
  console.log('Lynx/灵犀 — API 配置验证\n');

  printProviderConfigs();

  console.log('\n--- Testing Proxy (free tier) ---');
  const quotaOk = await testProxyQuota();
  const enhanceOk = await testProxyEnhance();

  console.log('\n--- Result ---');
  if (quotaOk && enhanceOk) {
    console.log('Proxy (免费模式) 工作正常。');
  } else {
    console.log('Proxy 验证未完全通过，请检查网络或 Worker 部署。');
    process.exit(1);
  }

  console.log('\n其他提供商需在扩展中配置 API Key 后手动测试。');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
