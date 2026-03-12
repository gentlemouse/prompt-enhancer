/**
 * 共享类型定义
 * 提供全项目统一的类型接口
 */

/** 推理模式枚举 */
export enum ReasoningMode {
  /** 简单模式：直接调用，适合闲聊或简单查询 */
  SIMPLE = 'SIMPLE',
  /** 深度思考模式：激活 CoT，适合复杂逻辑分析 */
  DEEP_THINKING = 'DEEP_THINKING',
  /** 专家模式：激活 Reflexion，适合代码生成、学术研究 */
  EXPERT = 'EXPERT',
}

/** 任务类型枚举 */
export enum TaskType {
  CHAT = 'CHAT',
  QA = 'QA',
  ANALYSIS = 'ANALYSIS',
  CODE = 'CODE',
  WRITING = 'WRITING',
  EXTRACTION = 'EXTRACTION',
  PLANNING = 'PLANNING',
  RESEARCH = 'RESEARCH',
}

/**
 * 优化策略枚举
 * 根据输入特征动态选择
 */
export enum OptimizationStrategy {
  /** 轻润色：简短指令，只补充缺失信息 */
  LIGHT_POLISH = 'LIGHT_POLISH',
  /** 结构化重写：首轮复杂请求，搭建完整框架 */
  STRUCTURAL_REWRITE = 'STRUCTURAL_REWRITE',
  /** 微调锐化：已写得不错的 prompt，只做措辞优化 */
  SHARPEN = 'SHARPEN',
  /** 约束追加：补充/修正类指令，在原 prompt 上追加 */
  CONSTRAINT_APPEND = 'CONSTRAINT_APPEND',
}

/** API 提供商类型 */
export type APIProvider =
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'gemini'
  | 'kimi'
  | 'minimax'
  | 'qwen'
  | 'zhipu'
  | 'custom'
  | 'proxy';

/** API 提供商配置接口 */
export interface APIProviderConfig {
  name: string;
  endpoint: string;
  defaultModel: string;
  models: string[];
  /** 是否需要特殊安全警告 */
  securityWarning?: string;
}

/** Prompt 分析结果接口 */
export interface PromptAnalysis {
  taskType: TaskType;
  reasoningMode: ReasoningMode;
  /** 动态优化策略 */
  strategy: OptimizationStrategy;
  language: 'zh' | 'en';
  length: number;
  hasCode: boolean;
  hasFormatRequest: boolean;
  hasMultipleQuestions: boolean;
  hasNumberedList: boolean;
  complexityScore: number;
  needsChainOfThought: boolean;
  needsReflection: boolean;
  originalPrompt: string;
  /** 是否为修正/补充指令 */
  isCorrection: boolean;
  /** 是否已有良好结构 */
  hasGoodStructure: boolean;
  /** 是否属于易被模型误当成直接执行任务的短提示词 */
  hasDirectExecutionRisk: boolean;
}

/** 存储配置接口 */
export interface StorageConfig {
  apiProvider: APIProvider;
  /** P0-1.2: 加密后的 API Key */
  encryptedApiKey: string;
  model: string;
  customEndpoint: string;
  customModel: string;
  /** 用户是否已确认 Anthropic 安全警告 */
  anthropicWarningAcknowledged?: boolean;
}

/** 旧版存储配置（用于迁移） */
export interface LegacyStorageConfig {
  apiProvider?: APIProvider;
  apiKey?: string;
  model?: string;
  customEndpoint?: string;
  customModel?: string;
}

/** API 请求选项 */
export interface APIRequestOptions {
  apiKey: string;
  model: string;
  prompt: string;
  endpoint?: string;
  /** 重试次数 */
  retryCount?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/** API 响应结果 */
export interface APIResponse {
  success: boolean;
  enhanced?: string;
  error?: string;
}

/** 消息类型 */
export type MessageAction =
  | 'enhancePrompt'
  | 'enhancePromptStreaming'
  | 'getProviders'
  | 'injectContentScript'
  | 'checkPermission'
  | 'requestPermission'
  | 'streamChunk'
  | 'streamError'
  | 'streamEnd'
  | 'checkOnboarding'
  | 'completeOnboarding'
  | 'getTrialStatus'
  | 'enhanceSelection'
  | 'triggerEnhance';

/** 消息接口 */
export interface ExtensionMessage {
  action: MessageAction;
  prompt?: string;
  tabId?: number;
  origin?: string;
  requestId?: string;
  chunk?: string;
  error?: string;
}

/** 试用状态 */
export type TrialState = 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED' | 'API_CONFIGURED';

/** 消息响应接口 */
export interface MessageResponse {
  success: boolean;
  enhanced?: string;
  error?: string;
  providers?: Record<APIProvider, APIProviderConfig>;
  hasPermission?: boolean;
  needsOnboarding?: boolean;
  trialState?: TrialState;
  trialRemaining?: number;
  trialTotal?: number;
}
