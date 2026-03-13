/**
 * Lynx — Cloudflare Worker API 代理
 *
 * 功能：
 * - 为免费用户代理 AI API 调用（无需自备 API Key）
 * - IP hash + 设备指纹双重终身限额控制
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
  GATEWAY_RPM_LIMIT?: string;
  UPSTREAM_MAX_RETRIES?: string;
  QUEUE_MAX_WAIT_MS?: string;
  QUEUE_POLL_INTERVAL_MS?: string;
  CIRCUIT_BREAKER_THRESHOLD?: string;
  CIRCUIT_BREAKER_COOLDOWN_MS?: string;
  KEY_MAX_INFLIGHT?: string;
  RATE_LIMITER: KVNamespace;
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

/** KV 过期时间：180 天（足够长，定期清理不活跃用户） */
const KV_TTL_SECONDS = 180 * 24 * 60 * 60;

/** 将 IP 哈希为匿名标识 */
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + '-prompt-enhancer-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** 生成终身限额 KV key */
function getLimitKey(identifier: string): string {
  return `lifetime:${identifier}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-FP',
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
 * 在上游成功后再持久化用量，减少并发拥塞场景的误扣
 */
async function persistUsage(
  env: Env,
  options: {
    useFingerprint: boolean;
    ipKey: string;
    ipCount: number;
    fpKey: string;
    fpCount: number;
  }
): Promise<void> {
  const putOps: Promise<void>[] = [];

  if (!options.useFingerprint) {
    putOps.push(
      env.RATE_LIMITER.put(options.ipKey, String(options.ipCount + 1), {
        expirationTtl: KV_TTL_SECONDS,
      })
    );
  }

  if (options.fpKey) {
    putOps.push(
      env.RATE_LIMITER.put(options.fpKey, String(options.fpCount + 1), {
        expirationTtl: KV_TTL_SECONDS,
      })
    );
  }

  await Promise.all(putOps);
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

/**
 * 获取某个身份标识的已用额度。
 *
 * 有合法设备指纹时，以设备指纹为主身份，避免同一 IP 下其他用户
 * 的历史消耗直接封死新安装用户。IP 仅作为无指纹请求的兜底限额。
 */
async function getEffectiveCount(
  env: Env,
  clientIP: string,
  deviceFP: string
): Promise<{
  ipCount: number;
  fpCount: number;
  effectiveCount: number;
  ipKey: string;
  fpKey: string;
  useFingerprint: boolean;
}> {
  const ipHash = await hashIP(clientIP);
  const ipKey = getLimitKey(ipHash);
  const ipCount = parseInt((await env.RATE_LIMITER.get(ipKey)) || '0', 10);

  let fpCount = 0;
  let fpKey = '';
  if (deviceFP && deviceFP.startsWith('pe_')) {
    fpKey = getLimitKey(deviceFP);
    fpCount = parseInt((await env.RATE_LIMITER.get(fpKey)) || '0', 10);
  }

  const useFingerprint = Boolean(fpKey);

  return {
    ipCount,
    fpCount,
    effectiveCount: useFingerprint ? fpCount : ipCount,
    ipKey,
    fpKey,
    useFingerprint,
  };
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
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const deviceFP = request.headers.get('X-Device-FP') || '';
        const limit = parseInt(env.LIFETIME_LIMIT || '', 10) || DEFAULT_LIFETIME_LIMIT;
        const { effectiveCount } = await getEffectiveCount(env, clientIP, deviceFP);
        const remaining = Math.max(0, limit - effectiveCount);

        return new Response(
          JSON.stringify({ limit, used: effectiveCount, remaining }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ---- GET /v1/slo — 查询最近 SLO 指标 ----
    if (request.method === 'GET' && url.pathname === '/v1/slo') {
      try {
        const requested = Number.parseInt(url.searchParams.get('minutes') || '10', 10);
        const minutes = Math.min(60, Math.max(1, Number.isFinite(requested) ? requested : 10));
        const timeline = await getRecentSloMetrics(env, minutes);
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
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname !== '/v1/enhance') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // ---- 终身限额检查 ----
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const deviceFP = request.headers.get('X-Device-FP') || '';
      const limit = parseInt(env.LIFETIME_LIMIT || '', 10) || DEFAULT_LIFETIME_LIMIT;
      const { ipCount, fpCount, effectiveCount, ipKey, fpKey, useFingerprint } =
        await getEffectiveCount(env, clientIP, deviceFP);

      if (effectiveCount >= limit) {
        return new Response(
          JSON.stringify({
            error: '免费额度已用完，请配置自己的 API Key 解锁无限使用',
            limit,
            used: effectiveCount,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      void incrementSloMetric(env, 'request_total');

      // ---- 解析请求 ----
      const body = (await request.json()) as {
        messages: Array<{ role: string; content: string }>;
        model?: string;
        stream?: boolean;
        temperature?: number;
        max_tokens?: number;
      };

      const wantStream = body.stream === true;

      // ---- 网关令牌桶 + 队列 ----
      const keyPool = getApiKeyPool(env);
      const slot = await acquireGatewaySlot(env, keyPool.length);
      if (!slot.granted) {
        void incrementSloMetric(env, 'queue_timeout');
        void incrementSloMetric(env, 'request_failed');
        return new Response(
          JSON.stringify({
            error: '系统繁忙，请稍后重试',
            code: 'GATEWAY_BUSY',
            queueWaitMs: slot.waitMs,
          }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      void incrementSloMetric(env, 'queue_wait_total_ms', slot.waitMs);
      void incrementSloMetric(env, 'queue_wait_count');

      // ---- 调用 DeepSeek API（含拥塞重试） ----
      const apiResponse = await callDeepSeekWithPool(env, {
        model: body.model,
        messages: body.messages,
        max_tokens: body.max_tokens,
        temperature: body.temperature,
        stream: wantStream,
      });

      if (!apiResponse.ok) {
        void incrementSloMetric(env, 'request_failed');
        const errorText = await apiResponse.text();
        return new Response(
          JSON.stringify({ error: `API error: ${apiResponse.status}`, details: errorText }),
          {
            status: apiResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // ---- 上游成功后再扣额度（避免拥塞失败误扣） ----
      await persistUsage(env, {
        useFingerprint,
        ipKey,
        ipCount,
        fpKey,
        fpCount,
      });
      void incrementSloMetric(env, 'request_success');

      const remaining = Math.max(0, limit - effectiveCount - 1);

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
