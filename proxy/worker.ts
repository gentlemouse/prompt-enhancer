/**
 * Prompt Enhancer — Cloudflare Worker API 代理
 *
 * 功能：
 * - 为免费用户代理 AI API 调用（无需自备 API Key）
 * - IP hash + 设备指纹双重限额控制
 * - 流式/非流式响应透传
 * - CORS 支持 Chrome 扩展调用
 *
 * 部署：cd proxy && wrangler deploy
 *
 * 环境变量（wrangler.toml 或 Dashboard 设置）：
 * - DEEPSEEK_API_KEY: DeepSeek API Key（secret）
 * - DAILY_LIMIT: 每用户每日限额（默认 10）
 */

interface Env {
  DEEPSEEK_API_KEY: string;
  DAILY_LIMIT?: string;
  RATE_LIMITER: KVNamespace;
}

const DEFAULT_DAILY_LIMIT = 10;

/** 将 IP 哈希为匿名标识 */
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + '-prompt-enhancer-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** 生成当日限额 key */
function getDailyKey(identifier: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `limit:${today}:${identifier}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Device-FP',
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
      // ---- 双重限额检查 ----
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const deviceFP = request.headers.get('X-Device-FP') || '';
      const ipHash = await hashIP(clientIP);
      const dailyLimit = parseInt(env.DAILY_LIMIT || '', 10) || DEFAULT_DAILY_LIMIT;

      const ipKey = getDailyKey(ipHash);
      const ipCount = parseInt((await env.RATE_LIMITER.get(ipKey)) || '0', 10);

      let fpCount = 0;
      let fpKey = '';
      if (deviceFP && deviceFP.startsWith('pe_')) {
        fpKey = getDailyKey(deviceFP);
        fpCount = parseInt((await env.RATE_LIMITER.get(fpKey)) || '0', 10);
      }

      const effectiveCount = Math.max(ipCount, fpCount);

      if (effectiveCount >= dailyLimit) {
        return new Response(
          JSON.stringify({
            error: '今日免费额度已用完，请配置自己的 API Key 解锁无限使用',
            limit: dailyLimit,
            used: effectiveCount,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // ---- 递增计数（先扣后调，防止并发超发） ----
      const putOps = [
        env.RATE_LIMITER.put(ipKey, String(ipCount + 1), { expirationTtl: 86400 }),
      ];
      if (fpKey) {
        putOps.push(
          env.RATE_LIMITER.put(fpKey, String(fpCount + 1), { expirationTtl: 86400 })
        );
      }
      await Promise.all(putOps);

      // ---- 解析请求 ----
      const body = (await request.json()) as {
        messages: Array<{ role: string; content: string }>;
        model?: string;
        stream?: boolean;
        temperature?: number;
        max_tokens?: number;
      };

      const wantStream = body.stream === true;
      const remaining = dailyLimit - effectiveCount - 1;

      // ---- 调用 DeepSeek API ----
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
            max_tokens: body.max_tokens || 2048,
            temperature: body.temperature ?? 0.7,
            stream: wantStream,
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

      // ---- 流式响应透传 ----
      if (wantStream) {
        return new Response(apiResponse.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Daily-Remaining': String(remaining),
          },
        });
      }

      // ---- 非流式响应 ----
      const result = await apiResponse.json();

      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Daily-Remaining': String(remaining),
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
