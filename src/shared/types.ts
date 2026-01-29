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

/** API 提供商类型 */
export type APIProvider = 'openai' | 'anthropic' | 'deepseek' | 'custom';

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
  | 'completeOnboarding';

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

/** 消息响应接口 */
export interface MessageResponse {
  success: boolean;
  enhanced?: string;
  error?: string;
  providers?: Record<APIProvider, APIProviderConfig>;
  hasPermission?: boolean;
  needsOnboarding?: boolean;
}
