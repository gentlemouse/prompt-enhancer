import type { APIProvider, APIProviderConfig } from './types';
import { TaskType } from './types';

/**
 * API 提供商配置
 * P0-1.3: 为 Anthropic 添加安全警告
 */
export const API_PROVIDERS: Record<APIProvider, APIProviderConfig> = {
  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  anthropic: {
    name: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-5-haiku-latest',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest'],
    // P0-1.3: 安全警告
    securityWarning:
      '注意：Anthropic API 在浏览器中直接调用需要启用特殊访问模式，' +
      '这可能带来安全风险。建议仅在信任的网络环境下使用，' +
      '或考虑使用后端代理方案。',
  },
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  proxy: {
    name: '免费模式（无需 API Key）',
    endpoint: 'https://prompt-enhancer-proxy.gentlemouse666.workers.dev/v1/enhance',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat'],
  },
  custom: {
    name: '自定义 API',
    endpoint: '',
    defaultModel: '',
    models: [],
  },
};

/** 任务类型关键词指标 */
export const TASK_INDICATORS: Record<TaskType, string[]> = {
  [TaskType.CODE]: [
    'code',
    'coding',
    '代码',
    '编程',
    '函数',
    'function',
    'script',
    '脚本',
    'python',
    'javascript',
    'java',
    'c++',
    'rust',
    'go',
    'sql',
    'html',
    'css',
    'api',
    'bug',
    'debug',
    '调试',
    '实现',
    'implement',
    '算法',
    'algorithm',
    '程序',
    'program',
    '开发',
    'develop',
    '接口',
    '数据库',
    'database',
    '重构',
    'refactor',
    '优化代码',
    '性能优化',
  ],
  [TaskType.WRITING]: [
    '写',
    'write',
    '文章',
    'article',
    '文案',
    'copy',
    '邮件',
    'email',
    '报告',
    'report',
    '故事',
    'story',
    '描述',
    'describe',
    '介绍',
    'introduce',
    '文档',
    'document',
    '通知',
    '公告',
    '新闻',
    '博客',
    'blog',
    '作文',
    '撰写',
    '起草',
    'draft',
    '创作',
    '内容',
  ],
  [TaskType.ANALYSIS]: [
    '分析',
    'analyze',
    'analysis',
    '原因',
    'reason',
    'why',
    '为什么',
    '比较',
    'compare',
    '对比',
    '评估',
    'evaluate',
    '诊断',
    'diagnose',
    '优缺点',
    'pros and cons',
    '影响',
    'impact',
    '趋势',
    'trend',
    '深入',
    '探讨',
    '剖析',
    '论证',
    '推理',
    '逻辑',
  ],
  [TaskType.EXTRACTION]: [
    '提取',
    'extract',
    '总结',
    'summarize',
    '翻译',
    'translate',
    '转换',
    'convert',
    '格式化',
    'format',
    'json',
    'csv',
    '表格',
    '列出',
    'list',
    '整理',
    '归纳',
    '摘要',
    '要点',
    'key points',
  ],
  [TaskType.QA]: [
    '什么是',
    'what is',
    '是什么',
    '解释',
    'explain',
    '定义',
    'define',
    '区别',
    'difference',
    '含义',
    'meaning',
    '概念',
    'concept',
  ],
  [TaskType.PLANNING]: [
    '计划',
    'plan',
    '方案',
    'solution',
    '策略',
    'strategy',
    '步骤',
    'steps',
    '流程',
    'process',
    '设计',
    'design',
    '架构',
    'architecture',
    '规划',
    '安排',
    'schedule',
    '路线图',
    'roadmap',
  ],
  [TaskType.RESEARCH]: [
    '研究',
    'research',
    '调查',
    '论文',
    'paper',
    '学术',
    'academic',
    '文献',
    '综述',
    'survey',
    '实验',
    'experiment',
    '假设',
    'hypothesis',
  ],
  [TaskType.CHAT]: [],
};

/** 复杂度信号 */
export const COMPLEXITY_SIGNALS = {
  /** 高复杂度信号 */
  HIGH: [
    '详细',
    '全面',
    '深入',
    '系统',
    '完整',
    'comprehensive',
    'detailed',
    '多角度',
    '多维度',
    '深度分析',
    '逐步',
    'step by step',
    '考虑边缘情况',
    '异常处理',
    '错误处理',
  ],
  /** 需要思维链的信号 */
  CHAIN_OF_THOUGHT: [
    '推理',
    '论证',
    '证明',
    '演绎',
    '归纳',
    '逻辑',
    '让我们',
    "let's",
    '一步一步',
    '逐步分析',
    '思考过程',
  ],
  /** 需要反思的信号 */
  REFLECTION: [
    '最佳',
    '最优',
    'best',
    'optimal',
    '高质量',
    '高精度',
    '准确',
    'accurate',
    '可靠',
    'reliable',
    '健壮',
    'robust',
  ],
};

/**
 * AI 聊天网站白名单
 * 这些站点上放宽检测规则：
 * - contenteditable 仅需尺寸通过即可
 * - textarea 尺寸要求更低
 * - input[text] 也会被检测
 */
export const AI_CHAT_DOMAINS: string[] = [
  // OpenAI
  'chat.openai.com',
  'chatgpt.com',
  // Anthropic
  'claude.ai',
  // Google
  'gemini.google.com',
  'aistudio.google.com',
  // Microsoft
  'copilot.microsoft.com',
  // DeepSeek
  'chat.deepseek.com',
  // Mistral
  'chat.mistral.ai',
  // Meta
  'meta.ai',
  // xAI
  'grok.com',
  // Perplexity
  'perplexity.ai',
  // Poe
  'poe.com',
  // HuggingFace
  'huggingface.co',
  // 其他海外
  'you.com',
  'phind.com',
  'character.ai',
  'pi.ai',
  'chat.lmsys.org',
  'arena.lmsys.org',
  // 国内 AI
  'kimi.moonshot.cn',
  'tongyi.aliyun.com',
  'yiyan.baidu.com',
  'xinghuo.xfyun.cn',
  'chat.zhipu.ai',
  'doubao.com',
  'yuanbao.tencent.com',
  'tiangong.cn',
  // 第三方客户端 / 自部署
  'lobechat.com',
  'open-webui.com',
  'chatbox.ai',
  'typingmind.com',
  'nextchat.dev',
  'chat.vercel.ai',
];

/** 重试配置 */
export const RETRY_CONFIG = {
  /** 最大重试次数 */
  maxRetries: 3,
  /** 初始延迟（毫秒） */
  initialDelay: 1000,
  /** 最大延迟（毫秒） */
  maxDelay: 10000,
  /** 退避倍数 */
  backoffMultiplier: 2,
};

/** 存储键名 */
export const STORAGE_KEYS = {
  CONFIG: 'prompt_enhancer_config',
  TRIAL_DATA: 'prompt_enhancer_trial',
  LEGACY_API_KEY: 'apiKey',
  LEGACY_PROVIDER: 'apiProvider',
  LEGACY_MODEL: 'model',
  LEGACY_CUSTOM_ENDPOINT: 'customEndpoint',
  LEGACY_CUSTOM_MODEL: 'customModel',
} as const;

/** 免费试用最大次数 */
export const TRIAL_MAX_USES = 10;
