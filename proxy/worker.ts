/**
 * Prompt Enhancer — Cloudflare Worker API 代理
 *
 * 功能：
 * - 为免费用户代理 AI API 调用（无需自备 API Key）
 * - 每用户每日限额控制（基于 IP hash）
 * - 速率限制防滥用
 * - CORS 支持 Chrome 扩展调用
 *
 * 部署：wrangler deploy proxy/worker.ts
 *
 * 环境变量（wrangler.toml 或 Dashboard 设置）：
 * - DEEPSEEK_API_KEY: DeepSeek API Key
 * - DAILY_LIMIT: 每用户每日限额（默认 10）
 */

interface Env {
  DEEPSEEK_API_KEY: string;
  DAILY_LIMIT?: string;
  RATE_LIMITER: KVNamespace;
}

/** 默认每日限额 */
const DEFAULT_DAILY_LIMIT = 10;

/** IP hash 用于匿名限额计数 */
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + '-prompt-enhancer-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** 获取当日 key */
function getDailyKey(ipHash: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `limit:${today}:${ipHash}`;
}

/** CORS 头 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/v1/enhance') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ipHash = await hashIP(clientIP);
      const dailyKey = getDailyKey(ipHash);
      const dailyLimit = parseInt(env.DAILY_LIMIT || '', 10) || DEFAULT_DAILY_LIMIT;

      const currentCount = parseInt(
        (await env.RATE_LIMITER.get(dailyKey)) || '0',
        10
      );

      if (currentCount >= dailyLimit) {
        return new Response(
          JSON.stringify({
            error: '今日免费额度已用完，请配置自己的 API Key 解锁无限使用',
            limit: dailyLimit,
            used: currentCount,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const body = (await request.json()) as {
        messages: Array<{ role: string; content: string }>;
        model?: string;
      };

      const apiResponse = await fetch(
        'https://api.deepseek.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: body.model || 'deepseek-chat',
            messages: body.messages,
            max_tokens: 2048,
            temperature: 0.7,
          }),
        }
      );

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        return new Response(
          JSON.stringify({ error: `API error: ${apiResponse.status}`, details: errorText }),
          {
            status: apiResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      await env.RATE_LIMITER.put(dailyKey, String(currentCount + 1), {
        expirationTtl: 86400,
      });

      const result = await apiResponse.json();

      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Daily-Remaining': String(dailyLimit - currentCount - 1),
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal error',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
