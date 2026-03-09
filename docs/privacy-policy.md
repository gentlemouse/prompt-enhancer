# Privacy Policy — Lynx / 灵犀

**Last Updated: March 9, 2026**

## Overview

Lynx (灵犀) is a browser extension that rewrites or improves text prompts for AI tools. This policy explains what user data the extension accesses, how it processes that data, where data is stored, and when data is shared.

The extension works in two different modes:

- **Free mode**: your prompt is sent to the Lynx proxy service to generate the enhanced result and enforce free-trial limits.
- **Bring Your Own Key (BYOK) mode**: your prompt is sent directly to the AI provider or custom endpoint that you configure.

If you enter personal data, confidential business information, or other sensitive content into a prompt, that content may be processed according to the mode you use.

## 1. Data Collection and Access

### A. Prompt and page text

When you explicitly trigger the enhancement feature, the extension may access:

- the prompt text you typed or selected;
- limited nearby conversation context needed to improve follow-up prompts;
- the target site domain needed to adapt the enhancement behavior to the current page.

The extension does **not** continuously monitor all text on every page, and it does **not** collect your full browsing history.

### B. Settings and configuration data

The extension stores the following settings on your device:

- selected AI provider;
- selected model;
- custom API endpoint and custom model, if you configure them;
- encrypted API key;
- onboarding and warning acknowledgment flags.

### C. Free-trial and anti-abuse data

To provide the built-in free trial and prevent abuse, the extension generates and stores:

- a random device fingerprint created by the extension;
- trial usage counters;
- installation timestamp;
- recent usage timestamps used for quota management.

This device fingerprint is a randomly generated identifier. It is not intended to contain your name, email address, or other directly identifying information.

### D. Local usage statistics

The extension may store anonymous usage statistics **locally on your device only**, such as:

- enhancement count;
- selected optimization strategy;
- detected task type;
- site domain;
- success or failure state;
- follow-up usage count.

These local statistics are used only for local product features and are not sent to the developer's server by the current version of the extension. You can disable them in the extension settings, and existing local statistics will be deleted.

### E. Network metadata

When the extension makes a network request to the Lynx proxy service, a third-party AI provider, or your custom endpoint, those servers may receive standard technical metadata that normally accompanies HTTPS requests, such as IP address, user agent, and request time.

## 2. How Data Is Processed

We process data only to provide the requested functionality of the extension, including:

- analyzing your prompt and generating an improved prompt;
- sending the prompt to the configured AI service or the Lynx proxy service so a response can be generated;
- storing your settings so the extension works between sessions;
- enforcing free-trial limits and preventing repeated trial resets;
- showing local usage summaries inside the extension;
- debugging service availability and handling request failures.

We do **not** use prompt content for advertising, data brokerage, or unrelated profiling.

## 3. How Data Is Stored

### A. Stored locally in `chrome.storage.local`

The following data is stored locally in the browser:

- encrypted API key;
- provider, model, and custom endpoint settings;
- onboarding and warning settings;
- local anonymous usage statistics;
- local copy of free-trial data and device fingerprint.

### B. Stored in `chrome.storage.sync`

To keep free-trial state from resetting after browser reinstall or profile changes, the extension may also store the following in `chrome.storage.sync`:

- free-trial usage counters;
- installation timestamp;
- recent usage timestamps;
- random device fingerprint.

If Chrome Sync is enabled in your browser profile, this data may be synchronized by Google as part of the browser sync feature.

### C. Data kept only in memory during processing

Prompt text and temporary conversation context are normally kept in memory while a request is being processed. The extension does not intentionally store the full prompt text in its own persistent local database after the enhancement request finishes.

## 4. How Data Is Shared

### A. Shared in free mode

If you use the built-in free mode, the extension sends the following data to the Lynx proxy service:

- your prompt text and generated system instructions needed to create the enhanced prompt;
- selected model and request parameters;
- random device fingerprint in the `X-Device-FP` request header for quota enforcement.

The extension may also send the random device fingerprint to the Lynx quota endpoint to check or sync remaining free-trial usage.

### B. Shared in BYOK mode

If you configure your own API key, the extension sends your prompt text and request parameters directly to the provider you selected, such as:

- OpenAI;
- Anthropic;
- Google Gemini;
- DeepSeek;
- Kimi / Moonshot;
- MiniMax;
- Qwen / DashScope;
- Zhipu GLM;
- a custom OpenAI-compatible endpoint that you configure.

In BYOK mode, the extension does not send your API key to the Lynx proxy service. Your API key is sent only to the provider or endpoint you chose in order to authenticate your request.

### C. What we do not share

We do **not** sell your personal data.
We do **not** share prompt content with advertisers.
We do **not** share your API key with unrelated third parties.

## 5. Data Retention

Data is retained as follows:

- **API key and settings**: until you delete them, reset the extension, or uninstall the extension.
- **Local anonymous statistics**: up to 90 days in local storage unless you disable statistics earlier.
- **Free-trial data and fingerprint**: until the extension is uninstalled or storage is cleared, and longer if Chrome Sync continues to retain synchronized extension data in your browser profile.
- **Prompt text**: processed on demand and not intentionally retained by the extension in persistent local storage after the request completes.

Third-party AI providers, Google Chrome Sync, and the Lynx proxy service may apply their own retention policies to data they receive.

## 6. Security

We use reasonable measures to reduce unnecessary data exposure:

- API keys are obfuscated/encrypted before local storage;
- custom endpoints must use HTTPS;
- only the permissions needed for the extension features are requested;
- optional site access is requested only when needed.

No method of transmission or storage is perfectly secure. You should avoid sending highly sensitive information through any AI service unless you are comfortable with that provider's terms and privacy practices.

## 7. Your Choices

You can:

- use BYOK mode instead of free mode if you do not want prompt text routed through the Lynx proxy service;
- disable local anonymous statistics in the extension settings;
- remove your API key and other stored settings at any time;
- uninstall the extension to stop future data processing by the extension.

## 8. Third-Party Services

Depending on how you use the extension, your data may be processed by one or more third-party services. You should review the privacy policy of the provider you choose.

- OpenAI: [https://openai.com/policies/privacy-policy](https://openai.com/policies/privacy-policy)
- Anthropic: [https://www.anthropic.com/legal/privacy](https://www.anthropic.com/legal/privacy)
- Google: [https://policies.google.com/privacy](https://policies.google.com/privacy)
- DeepSeek: [https://platform.deepseek.com/](https://platform.deepseek.com/)
- Moonshot / Kimi: [https://www.moonshot.cn/](https://www.moonshot.cn/)
- MiniMax: [https://www.minimaxi.com/](https://www.minimaxi.com/)
- Alibaba Cloud / DashScope: [https://www.alibabacloud.com/help/](https://www.alibabacloud.com/help/)
- Zhipu: [https://open.bigmodel.cn/](https://open.bigmodel.cn/)

If you configure a custom endpoint, that endpoint's operator is responsible for its own privacy practices.

## 9. Changes to This Policy

We may update this policy from time to time. Material changes will be reflected in the "Last Updated" date above.

## 10. Contact

If you have questions about this privacy policy, please open an issue on our [GitHub repository](https://github.com/gentlemouse/prompt-enhancer).

---

*This extension is open source under the MIT License. You can review the source code on GitHub.*
