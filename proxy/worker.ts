/**
 * Lynx — Cloudflare Worker API 代理
 *
 * 功能：
 * - 为免费用户代理 AI API 调用（无需自备 API Key）
 * - 基于 session + 设备指纹的免费额度控制
 * - 流式/非流式响应透传
 * - CORS 支持 Chrome 扩展调用
 *
 * 部署：cd proxy && wrangler deploy
 *
 * 环境变量（wrangler.toml 或 Dashboard 设置）：
 * - DEEPSEEK_API_KEY: DeepSeek API Key（secret）
 * - LIFETIME_LIMIT: 每用户终身免费限额（默认 10）
 */

interface Env {
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_API_KEYS?: string;
  LIFETIME_LIMIT?: string;
  SESSION_SIGNING_SECRET?: string;
  ALLOWED_EXTENSION_ORIGINS?: string;
  ALLOW_DEV_EXTENSION_ORIGIN?: string;
  SESSION_TTL_SECONDS?: string;
  SESSION_ISSUE_RPM_LIMIT?: string;
  OPS_DASHBOARD_TOKEN?: string;
  GATEWAY_RPM_LIMIT?: string;
  UPSTREAM_MAX_RETRIES?: string;
  QUEUE_MAX_WAIT_MS?: string;
  QUEUE_POLL_INTERVAL_MS?: string;
  CIRCUIT_BREAKER_THRESHOLD?: string;
  CIRCUIT_BREAKER_COOLDOWN_MS?: string;
  KEY_MAX_INFLIGHT?: string;
  RATE_LIMITER: KVNamespace;
  QUOTA_COORDINATOR: DurableObjectNamespaceLike;
  GATEWAY_COORDINATOR: DurableObjectNamespaceLike;
}

const DEFAULT_LIFETIME_LIMIT = 10;
const DEFAULT_PER_KEY_RPM = 50;
const DEFAULT_UPSTREAM_MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 600;
const DEFAULT_QUEUE_MAX_WAIT_MS = 2500;
const DEFAULT_QUEUE_POLL_INTERVAL_MS = 120;
const DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 3;
const DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS = 30000;
const DEFAULT_KEY_MAX_INFLIGHT = 8;
const DEFAULT_SESSION_TTL_SECONDS = 5 * 60;
const DEFAULT_SESSION_ISSUE_RPM_LIMIT = 12;
const OPS_COOKIE_NAME = 'lynx_ops_session';

/** KV 过期时间：180 天（足够长，定期清理不活跃用户） */
const KV_TTL_SECONDS = 180 * 24 * 60 * 60;

/** 生成终身限额 KV key */
function getLimitKey(identifier: string): string {
  return `lifetime:${identifier}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Device-FP, X-Extension-Origin',
};

interface SessionPayload {
  sid: string;
  fpHash: string;
  issuedAt: number;
  expiresAt: number;
  origin: string;
}

interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

interface DurableObjectStateLike {
  storage: {
    get<T = unknown>(key: string): Promise<T | undefined>;
    put<T = unknown>(key: string, value: T): Promise<void>;
  };
}

const SESSION_SIGNATURE_PREFIX = 'v1';

const encoder = new TextEncoder();

const hashIdentifier = async (
  value: string,
  salt: string
): Promise<string> => {
  const data = encoder.encode(value + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const base64UrlEncode = (value: string): string =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const base64UrlDecode = (value: string): string => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return atob(padded);
};

const createHmacSignature = async (
  secret: string,
  message: string
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

const parseAllowedOrigins = (env: Env): Set<string> =>
  new Set(
    (env.ALLOWED_EXTENSION_ORIGINS || '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  );

const resolveExtensionOrigin = async (request: Request): Promise<string> => {
  const headerOrigin =
    request.headers.get('X-Extension-Origin') || request.headers.get('Origin');
  if (headerOrigin) {
    return headerOrigin;
  }

  try {
    const body = (await request.clone().json()) as { origin?: string };
    return body.origin || '';
  } catch {
    return '';
  }
};

const isAllowedExtensionOrigin = (origin: string, env: Env): boolean => {
  if (!origin) return false;

  const allowedOrigins = parseAllowedOrigins(env);
  if (allowedOrigins.has(origin)) {
    return true;
  }

  return (
    env.ALLOW_DEV_EXTENSION_ORIGIN === 'true' &&
    origin.startsWith('chrome-extension://')
  );
};

const getSessionSecret = (env: Env): string | null =>
  env.SESSION_SIGNING_SECRET?.trim() || null;

const buildSessionToken = async (
  env: Env,
  payload: SessionPayload
): Promise<string> => {
  const secret = getSessionSecret(env);
  if (!secret) {
    throw new Error('SESSION_SIGNING_SECRET is not configured');
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${SESSION_SIGNATURE_PREFIX}.${encodedPayload}`;
  const signature = await createHmacSignature(secret, message);
  return `${SESSION_SIGNATURE_PREFIX}.${encodedPayload}.${signature}`;
};

const readBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get('Authorization') || '';
  const prefix = 'Bearer ';
  return authorization.startsWith(prefix)
    ? authorization.slice(prefix.length).trim()
    : null;
};

const verifySessionToken = async (
  env: Env,
  token: string
): Promise<SessionPayload | null> => {
  const secret = getSessionSecret(env);
  if (!secret) return null;

  const [version, encodedPayload, signature] = token.split('.');
  if (
    version !== SESSION_SIGNATURE_PREFIX ||
    !encodedPayload ||
    !signature
  ) {
    return null;
  }

  const message = `${version}.${encodedPayload}`;
  const expectedSignature = await createHmacSignature(secret, message);
  if (expectedSignature !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (
      !payload.sid ||
      !payload.fpHash ||
      !payload.origin ||
      !payload.issuedAt ||
      !payload.expiresAt
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const unauthorizedResponse = (message: string): Response =>
  new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const jsonResponse = (
  payload: unknown,
  status: number = 200,
  extraHeaders: Record<string, string> = {}
): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });

const readCookie = (request: Request, name: string): string | null => {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').map(item => item.trim());
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return rest.join('=');
    }
  }
  return null;
};

const isOpsAuthorized = (request: Request, env: Env): boolean => {
  const expected = env.OPS_DASHBOARD_TOKEN?.trim();
  if (!expected) return false;
  return readCookie(request, OPS_COOKIE_NAME) === expected;
};

const unauthorizedOpsResponse = (): Response =>
  new Response('Unauthorized', {
    status: 401,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

const validateFreeSession = async (
  request: Request,
  env: Env
): Promise<{ ok: true; payload: SessionPayload } | { ok: false; response: Response }> => {
  const token = readBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: unauthorizedResponse('Missing free session token'),
    };
  }

  const payload = await verifySessionToken(env, token);
  if (!payload) {
    return {
      ok: false,
      response: unauthorizedResponse('Invalid free session token'),
    };
  }

  if (payload.expiresAt <= Date.now()) {
    return {
      ok: false,
      response: unauthorizedResponse('Free session token expired'),
    };
  }

  const origin = await resolveExtensionOrigin(request);
  if (origin !== payload.origin || !isAllowedExtensionOrigin(origin, env)) {
    return {
      ok: false,
      response: unauthorizedResponse('Extension origin is not authorized'),
    };
  }

  const deviceFP = request.headers.get('X-Device-FP') || '';
  const fpHash = await hashIdentifier(deviceFP, '-prompt-enhancer-session-salt');
  if (!deviceFP || fpHash !== payload.fpHash) {
    return {
      ok: false,
      response: unauthorizedResponse('Device fingerprint does not match session'),
    };
  }

  return { ok: true, payload };
};

/**
 * 监控看板 HTML（极简版）
 */
const SLO_DASHBOARD_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lynx SLO Dashboard</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b1220;
        --card: #111a2c;
        --ok: #22c55e;
        --warn: #f59e0b;
        --bad: #ef4444;
        --text: #e5e7eb;
        --sub: #94a3b8;
      }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      .wrap {
        max-width: 1080px;
        margin: 20px auto;
        padding: 0 16px;
      }
      h1 { margin: 0 0 12px; font-size: 22px; }
      .toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 12px;
      }
      button {
        border: 1px solid #334155;
        background: #0f172a;
        color: var(--text);
        border-radius: 8px;
        padding: 6px 10px;
        cursor: pointer;
      }
      button.active { border-color: #38bdf8; }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 12px;
      }
      .card {
        background: var(--card);
        border: 1px solid #1f2937;
        border-radius: 12px;
        padding: 12px;
      }
      .label { color: var(--sub); font-size: 12px; margin-bottom: 6px; }
      .value { font-size: 24px; font-weight: 700; }
      .ok .value { color: var(--ok); }
      .warn .value { color: var(--warn); }
      .bad .value { color: var(--bad); }
      .sub { color: var(--sub); font-size: 12px; margin-top: 6px; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
        background: var(--card);
        border-radius: 12px;
        overflow: hidden;
      }
      th, td {
        padding: 10px;
        border-bottom: 1px solid #1f2937;
        text-align: right;
        font-size: 12px;
      }
      th:first-child, td:first-child { text-align: left; }
      .hint { color: var(--sub); font-size: 12px; margin-top: 10px; }
      .error { color: var(--bad); margin-top: 12px; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Lynx SLO Dashboard</h1>
      <div class="toolbar">
        <span>窗口：</span>
        <button data-minutes="10" class="active">10 分钟</button>
        <button data-minutes="30">30 分钟</button>
        <button data-minutes="60">60 分钟</button>
        <span id="refreshAt" class="hint"></span>
      </div>

      <div class="grid">
        <div class="card" id="cardReq">
          <div class="label">请求总量</div>
          <div class="value" id="requestTotal">-</div>
        </div>
        <div class="card" id="cardTps">
          <div class="label">平均吞吐（每分钟）</div>
          <div class="value" id="throughput">-</div>
        </div>
        <div class="card" id="card429">
          <div class="label">429 比率</div>
          <div class="value" id="rate429">-</div>
        </div>
        <div class="card" id="cardTimeout">
          <div class="label">超时比率</div>
          <div class="value" id="rateTimeout">-</div>
        </div>
        <div class="card" id="cardQueue">
          <div class="label">平均排队时长</div>
          <div class="value" id="queueWait">-</div>
        </div>
        <div class="card" id="cardFail">
          <div class="label">失败总量</div>
          <div class="value" id="requestFailed">-</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>分钟</th>
            <th>请求</th>
            <th>成功</th>
            <th>失败</th>
            <th>429%</th>
            <th>Timeout%</th>
            <th>排队(ms)</th>
            <th>吞吐</th>
          </tr>
        </thead>
        <tbody id="timelineBody"></tbody>
      </table>

      <div class="hint">
        阈值：429 &gt; 3% 红色；Timeout &gt; 2% 红色；平均排队时长 &gt; 2000ms 红色，&gt; 1200ms 黄色。
      </div>
      <div id="error" class="error"></div>
    </div>

    <script>
      const state = { minutes: 10 };
      const fmtPct = value => (value * 100).toFixed(2) + "%";
      const fmtNum = value => Number(value || 0).toLocaleString("en-US");
      const byId = id => document.getElementById(id);

      function setCardLevel(cardId, level) {
        const card = byId(cardId);
        card.classList.remove("ok", "warn", "bad");
        card.classList.add(level);
      }

      function levelByRate(rate, warn, bad) {
        if (rate > bad) return "bad";
        if (rate > warn) return "warn";
        return "ok";
      }

      function levelByMs(ms, warn, bad) {
        if (ms > bad) return "bad";
        if (ms > warn) return "warn";
        return "ok";
      }

      async function load() {
        byId("error").textContent = "";
        try {
          const res = await fetch("/v1/slo?minutes=" + state.minutes);
          if (!res.ok) throw new Error("HTTP " + res.status);
          const data = await res.json();
          const summary = data.summary || {};
          const timeline = data.timeline || [];

          byId("requestTotal").textContent = fmtNum(summary.request_total);
          byId("requestFailed").textContent = fmtNum(summary.request_failed);
          byId("throughput").textContent = (
            (summary.throughput || 0) / Math.max(1, Number(data.window_minutes || 1))
          ).toFixed(1);
          byId("rate429").textContent = fmtPct(summary.rate_429 || 0);
          byId("rateTimeout").textContent = fmtPct(summary.rate_timeout || 0);
          byId("queueWait").textContent = Math.round(summary.avg_queue_wait_ms || 0) + " ms";

          setCardLevel("cardReq", "ok");
          setCardLevel("cardFail", summary.request_failed > 0 ? "warn" : "ok");
          setCardLevel("cardTps", "ok");
          setCardLevel("card429", levelByRate(summary.rate_429 || 0, 0.015, 0.03));
          setCardLevel("cardTimeout", levelByRate(summary.rate_timeout || 0, 0.01, 0.02));
          setCardLevel("cardQueue", levelByMs(summary.avg_queue_wait_ms || 0, 1200, 2000));

          const body = byId("timelineBody");
          body.innerHTML = timeline
            .map(item => "<tr>" +
              "<td>" + item.minute.slice(11,16) + "</td>" +
              "<td>" + fmtNum(item.request_total) + "</td>" +
              "<td>" + fmtNum(item.request_success) + "</td>" +
              "<td>" + fmtNum(item.request_failed) + "</td>" +
              "<td>" + fmtPct(item.rate_429 || 0) + "</td>" +
              "<td>" + fmtPct(item.rate_timeout || 0) + "</td>" +
              "<td>" + Math.round(item.avg_queue_wait_ms || 0) + "</td>" +
              "<td>" + fmtNum(item.throughput_per_minute || 0) + "</td>" +
              "</tr>")
            .join("");

          byId("refreshAt").textContent = "最后刷新: " + new Date().toLocaleTimeString();
        } catch (error) {
          byId("error").textContent = "加载失败: " + (error && error.message ? error.message : String(error));
        }
      }

      document.querySelectorAll("button[data-minutes]").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll("button[data-minutes]").forEach(x => x.classList.remove("active"));
          btn.classList.add("active");
          state.minutes = Number(btn.dataset.minutes || "10");
          load();
        });
      });

      load();
      setInterval(load, 10000);
    </script>
  </body>
</html>`;

const SLO_METRIC_NAMES = [
  'request_total',
  'request_success',
  'request_failed',
  'upstream_call',
  'upstream_429',
  'upstream_timeout',
  'queue_timeout',
  'queue_wait_total_ms',
  'queue_wait_count',
] as const;

type SloMetricName = (typeof SLO_METRIC_NAMES)[number];

interface ApiKeyEntry {
  id: string;
  value: string;
}

interface KeyRuntimeState {
  failures: number;
  openedUntil: number;
  inFlight: number;
}

const keyStates = new Map<string, KeyRuntimeState>();
let roundRobinCursor = 0;

/**
 * 读取正整数环境变量（非法值回退默认值）
 */
const getEnvInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/**
 * 当前分钟桶（UTC，精确到分钟）
 */
const getMinuteBucket = (timestampMs: number = Date.now()): string => {
  const iso = new Date(timestampMs).toISOString();
  return iso.slice(0, 16);
};

/**
 * 生成 SLO 计数 key
 */
const getSloMetricKey = (minuteBucket: string, metricName: SloMetricName): string =>
  `slo:${minuteBucket}:${metricName}`;

/**
 * 增量记录 SLO 指标（KV 非原子，自然近似）
 */
const incrementSloMetric = async (
  env: Env,
  metricName: SloMetricName,
  delta: number = 1
): Promise<void> => {
  const minute = getMinuteBucket();
  const metricKey = getSloMetricKey(minute, metricName);
  const current = Number.parseInt((await env.RATE_LIMITER.get(metricKey)) || '0', 10) || 0;
  await env.RATE_LIMITER.put(metricKey, String(current + delta), {
    expirationTtl: 3 * 24 * 60 * 60,
  });
};

/**
 * 读取 SLO 指标（不存在时返回 0）
 */
const readSloMetric = async (
  env: Env,
  minuteBucket: string,
  metricName: SloMetricName
): Promise<number> =>
  Number.parseInt(
    (await env.RATE_LIMITER.get(getSloMetricKey(minuteBucket, metricName))) || '0',
    10
  ) || 0;

/**
 * 解析可用的 DeepSeek key 池（支持单 key + 多 key）
 */
const getApiKeyPool = (env: Env): ApiKeyEntry[] => {
  const pooled = (env.DEEPSEEK_API_KEYS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  const allKeys = pooled.length > 0 ? pooled : [env.DEEPSEEK_API_KEY].filter(Boolean);

  const toStableSuffix = (value: string): string => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
  };

  return allKeys.map((value, index) => ({
    id: `key_${index + 1}_${toStableSuffix(value)}`,
    value,
  }));
};

/**
 * 获取 key 运行时状态
 */
const getKeyState = (keyId: string): KeyRuntimeState => {
  const existing = keyStates.get(keyId);
  if (existing) return existing;
  const created: KeyRuntimeState = { failures: 0, openedUntil: 0, inFlight: 0 };
  keyStates.set(keyId, created);
  return created;
};

/**
 * 选出当前可用 key（轮询 + inFlight 限制 + 熔断）
 */
const pickKey = (
  pool: ApiKeyEntry[],
  now: number,
  keyMaxInFlight: number
): ApiKeyEntry | null => {
  if (pool.length === 0) return null;

  for (let i = 0; i < pool.length; i++) {
    const idx = (roundRobinCursor + i) % pool.length;
    const candidate = pool[idx];
    const state = getKeyState(candidate.id);
    if (state.openedUntil > now) continue;
    if (state.inFlight >= keyMaxInFlight) continue;
    roundRobinCursor = (idx + 1) % pool.length;
    return candidate;
  }

  // 半开探测：当所有 key 都在熔断窗口时，选最早恢复的 key 试探一次
  let probeCandidate: ApiKeyEntry | null = null;
  let earliestOpenUntil = Number.MAX_SAFE_INTEGER;
  for (const candidate of pool) {
    const state = getKeyState(candidate.id);
    if (state.inFlight >= keyMaxInFlight) continue;
    if (state.openedUntil < earliestOpenUntil) {
      earliestOpenUntil = state.openedUntil;
      probeCandidate = candidate;
    }
  }
  if (probeCandidate) return probeCandidate;

  return null;
};

/**
 * 熔断失败计数
 */
const markKeyFailure = (
  keyId: string,
  threshold: number,
  cooldownMs: number
): void => {
  const state = getKeyState(keyId);
  state.failures += 1;
  if (state.failures >= threshold) {
    state.openedUntil = Date.now() + cooldownMs;
    state.failures = 0;
  }
};

/**
 * 熔断成功恢复
 */
const markKeySuccess = (keyId: string): void => {
  const state = getKeyState(keyId);
  state.failures = 0;
  state.openedUntil = 0;
};

/**
 * 延迟函数
 */
const sleep = async (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * 计算指数退避时间（含轻微随机抖动）
 */
const getRetryDelayMs = (attempt: number): number => {
  const base = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 200);
  return base + jitter;
};

/**
 * 判断上游错误是否可重试
 */
const isRetryableUpstreamStatus = (status: number): boolean =>
  status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

/**
 * 网关令牌桶 + 队列：获取一个上游请求配额
 */
const acquireGatewaySlot = async (
  env: Env,
  keyCount: number
): Promise<{ granted: true; waitMs: number } | { granted: false; waitMs: number }> => {
  const rpmLimit = getEnvInt(
    env.GATEWAY_RPM_LIMIT,
    Math.max(1, keyCount) * DEFAULT_PER_KEY_RPM
  );
  const maxWaitMs = getEnvInt(env.QUEUE_MAX_WAIT_MS, DEFAULT_QUEUE_MAX_WAIT_MS);
  const pollIntervalMs = Math.max(
    20,
    getEnvInt(env.QUEUE_POLL_INTERVAL_MS, DEFAULT_QUEUE_POLL_INTERVAL_MS)
  );
  const startedAt = Date.now();

  while (Date.now() - startedAt <= maxWaitMs) {
    const minuteBucket = getMinuteBucket();
    const bucketKey = `tb:${minuteBucket}`;
    const current = Number.parseInt((await env.RATE_LIMITER.get(bucketKey)) || '0', 10) || 0;

    if (current < rpmLimit) {
      await env.RATE_LIMITER.put(bucketKey, String(current + 1), {
        expirationTtl: 2 * 60,
      });
      return { granted: true, waitMs: Date.now() - startedAt };
    }

    await sleep(pollIntervalMs);
  }

  return { granted: false, waitMs: Date.now() - startedAt };
};

/**
 * 统一调用 DeepSeek（多 Key 池化 + 拥塞重试 + 熔断）
 */
async function callDeepSeekWithPool(
  env: Env,
  payload: {
    model?: string;
    messages: Array<{ role: string; content: string }>;
    stream: boolean;
    temperature?: number;
    max_tokens?: number;
  }
): Promise<Response> {
  const keyPool = getApiKeyPool(env);
  if (keyPool.length === 0) {
    return new Response(JSON.stringify({ error: 'No upstream API key configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const maxRetries = getEnvInt(env.UPSTREAM_MAX_RETRIES, DEFAULT_UPSTREAM_MAX_RETRIES);
  const breakerThreshold = getEnvInt(
    env.CIRCUIT_BREAKER_THRESHOLD,
    DEFAULT_CIRCUIT_BREAKER_THRESHOLD
  );
  const breakerCooldownMs = getEnvInt(
    env.CIRCUIT_BREAKER_COOLDOWN_MS,
    DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS
  );
  const keyMaxInFlight = Math.max(
    1,
    getEnvInt(env.KEY_MAX_INFLIGHT, DEFAULT_KEY_MAX_INFLIGHT)
  );
  const totalAttempts = Math.max(maxRetries + 1, keyPool.length);

  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    const picked = pickKey(keyPool, Date.now(), keyMaxInFlight);
    if (!picked) {
      await sleep(80);
      continue;
    }

    const state = getKeyState(picked.id);
    state.inFlight += 1;

    try {
      void incrementSloMetric(env, 'upstream_call');
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${picked.value}`,
        },
        body: JSON.stringify({
          model: payload.model || 'deepseek-chat',
          messages: payload.messages,
          max_tokens: payload.max_tokens || 2048,
          temperature: payload.temperature ?? 0.7,
          stream: payload.stream,
        }),
      });

      if (response.ok) {
        markKeySuccess(picked.id);
        return response;
      }

      lastResponse = response;
      if (response.status === 429) {
        void incrementSloMetric(env, 'upstream_429');
      }

      markKeyFailure(picked.id, breakerThreshold, breakerCooldownMs);

      if (attempt < totalAttempts) {
        // key 权限类错误：直接切到其他 key
        if (response.status === 401 || response.status === 403) {
          continue;
        }

        // 可重试错误：退避重试
        if (isRetryableUpstreamStatus(response.status)) {
          const retryAfter = response.headers.get('Retry-After');
          const retryDelay = retryAfter
            ? Number.parseInt(retryAfter, 10) * 1000
            : getRetryDelayMs(attempt);
          await sleep(
            Number.isFinite(retryDelay) && retryDelay > 0
              ? retryDelay
              : getRetryDelayMs(attempt)
          );
          continue;
        }

        // 其他错误：如果有多 key，尝试切换一次
        if (keyPool.length > 1) {
          continue;
        }
      }

      return response;
    } catch {
      void incrementSloMetric(env, 'upstream_timeout');
      markKeyFailure(picked.id, breakerThreshold, breakerCooldownMs);
      if (attempt >= totalAttempts) {
        return new Response(JSON.stringify({ error: 'Upstream request timeout' }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } finally {
      const latest = getKeyState(picked.id);
      latest.inFlight = Math.max(0, latest.inFlight - 1);
    }
  }

  return lastResponse
    ? lastResponse
    : new Response(JSON.stringify({ error: 'Upstream unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
}

/**
 * 拉取最近 N 分钟 SLO 指标
 */
const getRecentSloMetrics = async (
  env: Env,
  minutes: number
): Promise<
  Array<{
    minute: string;
    request_total: number;
    request_success: number;
    request_failed: number;
    upstream_429: number;
    upstream_timeout: number;
    queue_timeout: number;
    throughput_per_minute: number;
    avg_queue_wait_ms: number;
    rate_429: number;
    rate_timeout: number;
  }>
> => {
  const rows: Array<{
    minute: string;
    request_total: number;
    request_success: number;
    request_failed: number;
    upstream_429: number;
    upstream_timeout: number;
    queue_timeout: number;
    throughput_per_minute: number;
    avg_queue_wait_ms: number;
    rate_429: number;
    rate_timeout: number;
  }> = [];

  for (let i = minutes - 1; i >= 0; i--) {
    const minute = getMinuteBucket(Date.now() - i * 60 * 1000);
    const values = await Promise.all(
      SLO_METRIC_NAMES.map(metricName => readSloMetric(env, minute, metricName))
    );
    const data = Object.fromEntries(
      SLO_METRIC_NAMES.map((metricName, idx) => [metricName, values[idx]])
    ) as Record<SloMetricName, number>;
    const requestTotal = data.request_total || 0;
    const queueWaitCount = data.queue_wait_count || 0;
    const queueWaitTotal = data.queue_wait_total_ms || 0;

    rows.push({
      minute,
      request_total: requestTotal,
      request_success: data.request_success || 0,
      request_failed: data.request_failed || 0,
      upstream_429: data.upstream_429 || 0,
      upstream_timeout: data.upstream_timeout || 0,
      queue_timeout: data.queue_timeout || 0,
      throughput_per_minute: data.request_success || 0,
      avg_queue_wait_ms: queueWaitCount > 0 ? queueWaitTotal / queueWaitCount : 0,
      rate_429: requestTotal > 0 ? (data.upstream_429 || 0) / requestTotal : 0,
      rate_timeout:
        requestTotal > 0
          ? ((data.upstream_timeout || 0) + (data.queue_timeout || 0)) / requestTotal
          : 0,
    });
  }

  return rows;
};

const getQuotaCoordinatorStub = (
  env: Env,
  identifier: string
): DurableObjectStubLike => {
  const id = env.QUOTA_COORDINATOR.idFromName(identifier);
  return env.QUOTA_COORDINATOR.get(id);
};

const getGatewayCoordinatorStub = (env: Env): DurableObjectStubLike => {
  const id = env.GATEWAY_COORDINATOR.idFromName('global-gateway');
  return env.GATEWAY_COORDINATOR.get(id);
};

export class QuotaIdentityCoordinator {
  private static readonly RESERVATIONS_KEY = 'quota:reservations';
  private static readonly RESERVATION_TTL_MS = 2 * 60 * 1000;

  constructor(
    private readonly state: DurableObjectStateLike,
    private readonly env: Env
  ) {}

  private async readSessionIssueCount(minuteBucket: string): Promise<number> {
    return (
      (await this.state.storage.get<number>(`session:${minuteBucket}`)) || 0
    );
  }

  private async readReservations(): Promise<Record<string, number>> {
    return (
      (await this.state.storage.get<Record<string, number>>(
        QuotaIdentityCoordinator.RESERVATIONS_KEY
      )) || {}
    );
  }

  private async getActiveReservations(): Promise<Record<string, number>> {
    const now = Date.now();
    const reservations = await this.readReservations();
    const activeEntries = Object.entries(reservations).filter(
      ([, timestamp]) =>
        now - timestamp <= QuotaIdentityCoordinator.RESERVATION_TTL_MS
    );
    const activeReservations = Object.fromEntries(activeEntries);

    if (activeEntries.length !== Object.keys(reservations).length) {
      await this.state.storage.put(
        QuotaIdentityCoordinator.RESERVATIONS_KEY,
        activeReservations
      );
    }

    return activeReservations;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body = (await request.json()) as {
      identifier: string;
      limit: number;
      issueRpmLimit?: number;
      reservationId?: string;
    };

    const usageKey = getLimitKey(body.identifier);
    const currentUsed =
      Number.parseInt((await this.env.RATE_LIMITER.get(usageKey)) || '0', 10) ||
      0;
    const limit = body.limit || DEFAULT_LIFETIME_LIMIT;
    const activeReservations = await this.getActiveReservations();
    const pendingCount = Object.keys(activeReservations).length;
    const effectiveUsed = currentUsed + pendingCount;

    if (url.pathname === '/session') {
      const minuteBucket = getMinuteBucket();
      const currentSessionCount =
        await this.readSessionIssueCount(minuteBucket);
      const issueRpmLimit =
        body.issueRpmLimit || DEFAULT_SESSION_ISSUE_RPM_LIMIT;

      if (currentSessionCount >= issueRpmLimit) {
        return new Response(
          JSON.stringify({ error: 'Too many session issues', code: 'SESSION_RATE_LIMITED' }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      await this.state.storage.put(
        `session:${minuteBucket}`,
        currentSessionCount + 1
      );

      return new Response(JSON.stringify({ granted: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/quota') {
      return new Response(
        JSON.stringify({
          used: effectiveUsed,
          committedUsed: currentUsed,
          pending: pendingCount,
          remaining: Math.max(0, limit - effectiveUsed),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (url.pathname === '/reserve') {
      if (effectiveUsed >= limit) {
        return new Response(
          JSON.stringify({
            error: 'Free quota exhausted',
            used: effectiveUsed,
            remaining: 0,
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const reservationId = crypto.randomUUID();
      const nextReservations = {
        ...activeReservations,
        [reservationId]: Date.now(),
      };
      await this.state.storage.put(
        QuotaIdentityCoordinator.RESERVATIONS_KEY,
        nextReservations
      );

      return new Response(
        JSON.stringify({
          reservationId,
          used: currentUsed + Object.keys(nextReservations).length,
          remaining: Math.max(
            0,
            limit - (currentUsed + Object.keys(nextReservations).length)
          ),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (url.pathname === '/commit') {
      if (!body.reservationId || !activeReservations[body.reservationId]) {
        return new Response(
          JSON.stringify({ error: 'Reservation not found' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      delete activeReservations[body.reservationId];
      await this.state.storage.put(
        QuotaIdentityCoordinator.RESERVATIONS_KEY,
        activeReservations
      );

      const nextUsed = Math.min(limit, currentUsed + 1);
      await this.env.RATE_LIMITER.put(usageKey, String(nextUsed), {
        expirationTtl: KV_TTL_SECONDS,
      });

      return new Response(
        JSON.stringify({
          used: nextUsed + Object.keys(activeReservations).length,
          committedUsed: nextUsed,
          pending: Object.keys(activeReservations).length,
          remaining: Math.max(
            0,
            limit - (nextUsed + Object.keys(activeReservations).length)
          ),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (url.pathname === '/release') {
      if (body.reservationId && activeReservations[body.reservationId]) {
        delete activeReservations[body.reservationId];
        await this.state.storage.put(
          QuotaIdentityCoordinator.RESERVATIONS_KEY,
          activeReservations
        );
      }

      return new Response(
        JSON.stringify({
          used: currentUsed + Object.keys(activeReservations).length,
          committedUsed: currentUsed,
          pending: Object.keys(activeReservations).length,
          remaining: Math.max(
            0,
            limit - (currentUsed + Object.keys(activeReservations).length)
          ),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export class GatewayCoordinator {
  constructor(
    private readonly state: DurableObjectStateLike,
    private readonly env: Env
  ) {
    void this.state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/slo') {
      const requested = Number.parseInt(url.searchParams.get('minutes') || '10', 10);
      const minutes = Math.min(60, Math.max(1, Number.isFinite(requested) ? requested : 10));
      const timeline = await getRecentSloMetrics(this.env, minutes);
      const summary = timeline.reduce(
        (acc, item) => {
          acc.request_total += item.request_total;
          acc.request_success += item.request_success;
          acc.request_failed += item.request_failed;
          acc.upstream_429 += item.upstream_429;
          acc.upstream_timeout += item.upstream_timeout;
          acc.queue_timeout += item.queue_timeout;
          acc.throughput += item.throughput_per_minute;
          acc.queue_wait_ms_weighted +=
            item.avg_queue_wait_ms * Math.max(0, item.request_total - item.queue_timeout);
          acc.queue_samples += Math.max(0, item.request_total - item.queue_timeout);
          return acc;
        },
        {
          request_total: 0,
          request_success: 0,
          request_failed: 0,
          upstream_429: 0,
          upstream_timeout: 0,
          queue_timeout: 0,
          throughput: 0,
          queue_wait_ms_weighted: 0,
          queue_samples: 0,
        }
      );

      return new Response(
        JSON.stringify({
          window_minutes: minutes,
          summary: {
            ...summary,
            avg_queue_wait_ms:
              summary.queue_samples > 0
                ? summary.queue_wait_ms_weighted / summary.queue_samples
                : 0,
            rate_429:
              summary.request_total > 0
                ? summary.upstream_429 / summary.request_total
                : 0,
            rate_timeout:
              summary.request_total > 0
                ? (summary.upstream_timeout + summary.queue_timeout) /
                  summary.request_total
                : 0,
          },
          timeline,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (request.method !== 'POST' || url.pathname !== '/enhance') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as {
      model?: string;
      messages: Array<{ role: string; content: string }>;
      stream?: boolean;
      temperature?: number;
      max_tokens?: number;
    };
    const wantStream = body.stream === true;

    void incrementSloMetric(this.env, 'request_total');

    const keyPool = getApiKeyPool(this.env);
    const slot = await acquireGatewaySlot(this.env, keyPool.length);
    if (!slot.granted) {
      void incrementSloMetric(this.env, 'queue_timeout');
      void incrementSloMetric(this.env, 'request_failed');
      return new Response(
        JSON.stringify({
          error: '系统繁忙，请稍后重试',
          code: 'GATEWAY_BUSY',
          queueWaitMs: slot.waitMs,
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    void incrementSloMetric(this.env, 'queue_wait_total_ms', slot.waitMs);
    void incrementSloMetric(this.env, 'queue_wait_count');

    const upstreamResponse = await callDeepSeekWithPool(this.env, {
      model: body.model,
      messages: body.messages,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      stream: wantStream,
    });

    if (!upstreamResponse.ok) {
      void incrementSloMetric(this.env, 'request_failed');
      const errorText = await upstreamResponse.text();
      return new Response(
        JSON.stringify({
          error: `API error: ${upstreamResponse.status}`,
          details: errorText,
        }),
        {
          status: upstreamResponse.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    void incrementSloMetric(this.env, 'request_success');

    if (wantStream) {
      return new Response(upstreamResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const result = await upstreamResponse.json();
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ---- GET /dashboard - 运行状态看板 ----
    if (
      request.method === 'GET' &&
      (url.pathname === '/dashboard' || url.pathname === '/')
    ) {
      const dashboardToken = env.OPS_DASHBOARD_TOKEN?.trim();
      if (!dashboardToken) {
        return unauthorizedOpsResponse();
      }

      const queryToken = url.searchParams.get('token');
      if (queryToken === dashboardToken) {
        return new Response(SLO_DASHBOARD_HTML, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Set-Cookie': `${OPS_COOKIE_NAME}=${dashboardToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`,
          },
        });
      }

      if (!isOpsAuthorized(request, env)) {
        return unauthorizedOpsResponse();
      }

      return new Response(SLO_DASHBOARD_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    // ---- GET /v1/quota — 查询剩余额度 ----
    if (request.method === 'GET' && url.pathname === '/v1/quota') {
      try {
        const authResult = await validateFreeSession(request, env);
        if (!authResult.ok) {
          return authResult.response;
        }

        const deviceFP = request.headers.get('X-Device-FP') || '';
        const limit = parseInt(env.LIFETIME_LIMIT || '', 10) || DEFAULT_LIFETIME_LIMIT;
        const quotaResponse = await getQuotaCoordinatorStub(env, deviceFP).fetch(
          new Request('https://quota.internal/quota', {
            method: 'POST',
            body: JSON.stringify({
              identifier: deviceFP,
              limit,
            }),
          })
        );
        const quota = (await quotaResponse.json()) as {
          used: number;
          remaining: number;
        };

        return new Response(
          JSON.stringify({
            limit,
            used: quota.used,
            remaining: quota.remaining,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ---- POST /v1/session — 签发免费模式会话 ----
    if (request.method === 'POST' && url.pathname === '/v1/session') {
      try {
        const secret = getSessionSecret(env);
        if (!secret) {
          return new Response(
            JSON.stringify({ error: 'SESSION_SIGNING_SECRET is not configured' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const origin = await resolveExtensionOrigin(request);
        if (!isAllowedExtensionOrigin(origin, env)) {
          return new Response(
            JSON.stringify({ error: 'Extension origin is not allowed' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const deviceFP = request.headers.get('X-Device-FP') || '';
        if (!deviceFP || !deviceFP.startsWith('pe_')) {
          return new Response(
            JSON.stringify({ error: 'Valid device fingerprint is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const now = Date.now();
        const ttlSeconds =
          getEnvInt(env.SESSION_TTL_SECONDS, DEFAULT_SESSION_TTL_SECONDS);
        const issueGate = await getQuotaCoordinatorStub(env, deviceFP).fetch(
          new Request('https://quota.internal/session', {
            method: 'POST',
            body: JSON.stringify({
              identifier: deviceFP,
              limit:
                parseInt(env.LIFETIME_LIMIT || '', 10) || DEFAULT_LIFETIME_LIMIT,
              issueRpmLimit: getEnvInt(
                env.SESSION_ISSUE_RPM_LIMIT,
                DEFAULT_SESSION_ISSUE_RPM_LIMIT
              ),
            }),
          })
        );
        if (!issueGate.ok) {
          const errorPayload = await issueGate.text();
          return new Response(errorPayload, {
            status: issueGate.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const payload: SessionPayload = {
          sid: crypto.randomUUID(),
          fpHash: await hashIdentifier(
            deviceFP,
            '-prompt-enhancer-session-salt'
          ),
          issuedAt: now,
          expiresAt: now + ttlSeconds * 1000,
          origin,
        };
        const token = await buildSessionToken(env, payload);

        return new Response(
          JSON.stringify({
            token,
            expiresAt: payload.expiresAt,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
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
    }

    // ---- GET /v1/slo — 查询最近 SLO 指标 ----
    if (request.method === 'GET' && url.pathname === '/v1/slo') {
      try {
        if (!isOpsAuthorized(request, env)) {
          return unauthorizedOpsResponse();
        }

        const sloResponse = await getGatewayCoordinatorStub(env).fetch(
          new Request(
            `https://gateway.internal/slo?minutes=${url.searchParams.get('minutes') || '10'}`,
            { method: 'GET' }
          )
        );
        const payload = await sloResponse.text();
        return new Response(payload, {
          status: sloResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/v1/byok/anthropic/messages'
    ) {
      try {
        const apiKey = request.headers.get('X-Anthropic-Key') || '';
        if (!apiKey.trim()) {
          return jsonResponse({ error: 'Missing Anthropic API key' }, 400);
        }

        const body = (await request.json()) as {
          model: string;
          max_tokens: number;
          temperature?: number;
          system: string;
          messages: Array<{ role: string; content: string }>;
        };

        const upstream = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        });

        const responseText = await upstream.text();
        return new Response(responseText, {
          status: upstream.status,
          headers: {
            ...corsHeaders,
            'Content-Type':
              upstream.headers.get('Content-Type') || 'application/json',
          },
        });
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : 'Internal error' },
          500
        );
      }
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    if (url.pathname !== '/v1/enhance') {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    try {
      const authResult = await validateFreeSession(request, env);
      if (!authResult.ok) {
        return authResult.response;
      }

      // ---- 终身限额检查 ----
      const deviceFP = request.headers.get('X-Device-FP') || '';
      const limit = parseInt(env.LIFETIME_LIMIT || '', 10) || DEFAULT_LIFETIME_LIMIT;
      const quotaStub = getQuotaCoordinatorStub(env, deviceFP);
      const reservationResponse = await quotaStub.fetch(
        new Request('https://quota.internal/reserve', {
          method: 'POST',
          body: JSON.stringify({
            identifier: deviceFP,
            limit,
          }),
        })
      );
      const reservationPayload = (await reservationResponse.json()) as {
        used: number;
        remaining: number;
        reservationId?: string;
      };

      if (!reservationResponse.ok || !reservationPayload.reservationId) {
        return new Response(
          JSON.stringify({
            error: '免费额度已用完，请配置自己的 API Key 解锁无限使用',
            limit,
            used: reservationPayload.used,
          }),
          {
            status: reservationResponse.status || 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // ---- 解析请求 ----
      const body = (await request.json()) as {
        messages: Array<{ role: string; content: string }>;
        model?: string;
        stream?: boolean;
        temperature?: number;
        max_tokens?: number;
      };

      const wantStream = body.stream === true;

      const apiResponse = await getGatewayCoordinatorStub(env).fetch(
        new Request('https://gateway.internal/enhance', {
          method: 'POST',
          body: JSON.stringify({
            model: body.model,
            messages: body.messages,
            max_tokens: body.max_tokens,
            temperature: body.temperature,
            stream: wantStream,
          }),
        })
      );

      if (!apiResponse.ok) {
        await quotaStub.fetch(
          new Request('https://quota.internal/release', {
            method: 'POST',
            body: JSON.stringify({
              identifier: deviceFP,
              limit,
              reservationId: reservationPayload.reservationId,
            }),
          })
        );
        const errorText = await apiResponse.text();
        let errorPayload: string;

        try {
          errorPayload = JSON.stringify(JSON.parse(errorText));
        } catch {
          errorPayload = JSON.stringify({
            error: `API error: ${apiResponse.status}`,
            details: errorText,
          });
        }

        return new Response(
          errorPayload,
          {
            status: apiResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const consumeResponse = await quotaStub.fetch(
        new Request('https://quota.internal/commit', {
          method: 'POST',
          body: JSON.stringify({
            identifier: deviceFP,
            limit,
            reservationId: reservationPayload.reservationId,
          }),
        })
      );
      const consumePayload = (await consumeResponse.json()) as {
        used: number;
        remaining: number;
      };
      const remaining = consumePayload.remaining;

      // ---- 流式响应透传 ----
      if (wantStream) {
        return new Response(apiResponse.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Remaining': String(remaining),
          },
        });
      }

      // ---- 非流式响应 ----
      const result = await apiResponse.json();

      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Remaining': String(remaining),
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
