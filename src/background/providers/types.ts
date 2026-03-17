/**
 * API 提供商类型定义
 */

import type { PromptAnalysis } from '@shared/types';

/** API 调用选项 */
export interface APICallOptions {
  apiKey: string;
  model: string;
  prompt: string;
  analysis: PromptAnalysis;
  endpoint?: string;
  anthropicRelayEnabled?: boolean;
}

/** API 提供商适配器接口 */
export interface APIProviderAdapter {
  /** 提供商名称 */
  name: string;
  /** 调用 API */
  call(options: APICallOptions): Promise<string>;
}
