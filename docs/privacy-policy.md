# Privacy Policy — Lynx / 灵犀

**Last Updated: February 2026**

## Overview

Lynx (灵犀) is a Chrome extension that enhances your AI prompts. We are committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights.

## Data Collection

### What We DO NOT Collect
- **No prompt content**: We never read, store, or transmit the content of your prompts or AI conversations.
- **No personal information**: We do not collect names, emails, or any personally identifiable information.
- **No browsing history**: We do not track which websites you visit.
- **No cookies or tracking pixels**: We do not use any third-party tracking.

### What We Collect (Optional, Anonymized)
If you opt in to anonymous usage statistics, we collect:
- **Usage counts**: How many times you use the enhance feature (count only, no content).
- **Strategy distribution**: Which optimization strategy was selected (e.g., "Light Polish" vs "Structural Rewrite").
- **Task type distribution**: What type of task was detected (e.g., "Code" vs "Writing").
- **Site domain**: Which AI platform you used the extension on (e.g., "chatgpt.com").
- **Success/failure rate**: Whether the enhancement completed successfully.

This data is stored locally in your browser using `chrome.storage.local` and is never transmitted to any server unless you explicitly enable sync in future versions.

### Opt-Out
You can disable anonymous statistics at any time in the extension settings. When you opt out, all collected statistics are immediately deleted.

## API Key Storage

- Your API key is encrypted using XOR encryption and stored locally in `chrome.storage.local`.
- Your API key is **never synced** to Chrome cloud storage.
- Your API key is only sent to the AI provider you configured (OpenAI, Anthropic, DeepSeek, or your custom endpoint) — never to us or any third party.

## Third-Party Services

The extension communicates with the following third-party API endpoints only when you explicitly trigger a prompt enhancement:

- **OpenAI API** (api.openai.com) — if configured as your provider
- **Anthropic API** (api.anthropic.com) — if configured as your provider
- **DeepSeek API** (api.deepseek.com) — if configured as your provider
- **Custom API** — any endpoint you configure yourself

We do not control these third-party services. Please review their respective privacy policies.

## Permissions

The extension requests the following permissions:

| Permission | Purpose |
|------------|---------|
| `storage` | Store your encrypted API key and settings locally |
| `activeTab` | Access the current tab to detect input fields |
| `contextMenus` | Provide right-click "Enhance Prompt" option |
| `scripting` | Inject the enhancement UI into web pages |

Optional permissions (`tabs`, host permissions) are requested only when needed and can be revoked at any time.

## Data Retention

- **Settings**: Stored until you uninstall the extension or clear them manually.
- **Session memory**: Stored in memory only; cleared when you close or refresh the tab.
- **Usage statistics**: Stored locally for up to 90 days, then automatically pruned.

## Children's Privacy

This extension is not directed at children under 13. We do not knowingly collect data from children.

## Changes to This Policy

We may update this policy from time to time. Changes will be reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our [GitHub repository](https://github.com/gentlemouse/prompt-enhancer).

---

*This extension is open source under the MIT License. You can review the complete source code on GitHub.*
