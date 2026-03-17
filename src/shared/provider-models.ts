import { API_PROVIDERS } from './constants';

/**
 * Anthropic 旧模型 alias 到当前 selector 中可用 alias 的兼容映射。
 * 这里的目标是保证历史配置继续可用，而不是严格保持旧模型行为完全一致。
 */
export const ANTHROPIC_MODEL_ALIASES: Record<string, string> = {
  'claude-opus-4-1': 'claude-opus-4-6',
  'claude-opus-4-0': 'claude-opus-4-6',
  'claude-sonnet-4-0': 'claude-sonnet-4-6',
  'claude-3-5-haiku-latest': 'claude-haiku-4-5',
};

/**
 * 将历史 Anthropic model 归一化为当前支持的 alias。
 * 如果传入值已经是当前支持模型，或者不是已知旧 alias，则原样返回。
 */
export const normalizeAnthropicModel = (model: string): string => {
  if (!model) return model;

  const normalized = ANTHROPIC_MODEL_ALIASES[model] || model;
  const supportedModels = API_PROVIDERS.anthropic.models;

  return supportedModels.includes(normalized)
    ? normalized
    : API_PROVIDERS.anthropic.defaultModel;
};
