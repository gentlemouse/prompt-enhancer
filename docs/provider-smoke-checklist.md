# Provider 联调验收清单 (BYOK Smoke Test)

本计划旨在帮助开发者在工作区配置不同厂商的 API Key，并通过 `smoke:providers` 脚本快速验证各厂商选项是否能正常工作。

## 1. 准备工作

1. 在项目根目录创建 `.env.local` 文件（已加入 `.gitignore`）。
2. 从 `.env.local.example` 复制模板。
3. 填入你想要测试的 Provider API Key。

## 2. 联调清单

| Provider | 控制台及 Key 申领地址 | 环境变量 / Key 名称 | 默认模型 | 验证命令 |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | [Platform](https://platform.openai.com) | `OPENAI_API_KEY` | `gpt-5.2-chat-latest` | `npm run smoke:providers -- --providers=openai` |
| **Anthropic** | [Console](https://console.anthropic.com) | `ANTHROPIC_API_KEY` | `claude-sonnet-4-0` | `npm run smoke:providers -- --providers=anthropic` |
| **Gemini** | [AI Studio](https://aistudio.google.com) | `GEMINI_API_KEY` | `gemini-2.5-flash` | `npm run smoke:providers -- --providers=gemini` |
| **DeepSeek** | [Platform](https://platform.deepseek.com) | `DEEPSEEK_API_KEY` | `deepseek-chat` | `npm run smoke:providers -- --providers=deepseek` |
| **Kimi** | [Console](https://platform.moonshot.cn) | `KIMI_API_KEY` | `moonshot-v1-auto` | `npm run smoke:providers -- --providers=kimi` |
| **Qwen** | [DashScope](https://dashscope.aliyun.com) | `QWEN_API_KEY` | `qwen3-max` | `npm run smoke:providers -- --providers=qwen` |
| **Zhipu** | [BigModel](https://open.bigmodel.cn) | `ZHIPU_API_KEY` | `glm-5` | `npm run smoke:providers -- --providers=zhipu` |
| **Minimax** | [Platform](https://platform.minimaxi.com) | `MINIMAX_API_KEY` | `MiniMax-M2.5` | `npm run smoke:providers -- --providers=minimax` |

## 3. 验收标准
- [ ] 对应 Provider 状态显示为 `✓`。
- [ ] 返回内容包含 `"OK"` 字符串。
- [ ] 脚本最后 Summary 显示 `failed=0`。

## 4. 常见问题排查
- **占位符 key**: 如果输出 `检测到占位符 API Key`，说明 `.env.local` 或 JSON 配置里仍是示例值，还没换成真实 key。
- **缺少权限**: 检查 API Key 是否启用了 Model 访问权限。
- **余额不足**: 检查云端账户是否有足够的额度（Quota）。
- **网络问题**: 如果是在受限环境运行，请确保网络能访问对应的 Provider API 地址。
- **超时**: 脚本默认超时时间为 30s。
