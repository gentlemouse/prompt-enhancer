# Chrome Web Store Privacy Remediation

## Privacy Policy URL

After pushing the latest changes to GitHub, use this public URL in the Chrome Web Store dashboard:

`https://github.com/gentlemouse/prompt-enhancer-docs/blob/main/privacy-policy.md`

## Privacy Practices Copy

Paste the following text into the Chrome Web Store privacy form.

### Single purpose

```text
Lynx is a prompt enhancement extension. When the user explicitly triggers enhancement, it reads the current prompt or selected text, analyzes it, and rewrites it into a clearer and more effective prompt for use on AI chat platforms. In free mode, the prompt is sent to the Lynx proxy service to generate the enhanced result and enforce trial limits. In BYOK mode, the prompt is sent directly to the AI provider or custom endpoint chosen by the user. That is the extension's single purpose.
```

### Why `storage` is required

```text
Required to store the user's encrypted API key, selected AI provider, model preferences, onboarding flags, local anonymous usage statistics, and local free-trial state. Free-trial counters and the random device fingerprint may also be synchronized through chrome.storage.sync when Chrome Sync is enabled.
```

### Why `activeTab` is required

```text
Required to detect and access the currently active tab only when the user explicitly triggers prompt enhancement, so the extension can read the current input or selected text and write the enhanced result back into the page.
```

### Why `contextMenus` is required

```text
Required to add a right-click menu action that lets the user enhance selected text from the page as an alternative to using the popup or keyboard shortcut.
```

### Why `scripting` is required

```text
Required to inject the content script and enhancement UI into the page only when the user activates the extension, instead of running on every page by default.
```

### Why optional `tabs` is required

```text
Listed as an optional permission. It is requested only when needed to obtain active tab URL metadata for site-specific behavior adjustments and is not required for installation.
```

### Why optional host permissions are required

```text
Listed as optional host permissions (`<all_urls>`). The extension must be able to work on any website where the user interacts with an AI text input, including ChatGPT, Claude, Gemini, DeepSeek, Kimi, Qwen, and self-hosted tools. Access is requested at runtime when needed, not at install time.
```

### Remote code

Select:

```text
No, I do not use remote code.
```

## Data Usage Selections

Select these data types:

- `Authentication information`
- `Network records`
- `User activity`
- `Website content`

Do not select data types that the extension does not currently handle.

## Why These Data Types Apply

### Authentication information

The extension stores a user-provided API key locally in encrypted form and sends it only to the AI provider or custom endpoint selected by the user for authentication.

### Network records

When requests are sent to the Lynx proxy service, the chosen AI provider, or a custom endpoint, standard HTTPS metadata such as IP address, user agent, and request time may be received by those services.

### User activity

The extension stores local anonymous usage statistics such as enhancement count, selected strategy, task type, site domain, success or failure state, and follow-up counts.

### Website content

When the user explicitly triggers enhancement, the extension reads prompt text, selected text, and limited nearby conversation context needed to improve the result.

## Privacy Policy Notes

The privacy policy and the dashboard selections must stay consistent with the current implementation:

- free mode uses the Lynx proxy service;
- BYOK mode sends prompt text directly to the selected AI provider or custom endpoint;
- API keys are stored locally and are not sent to Lynx servers in BYOK mode;
- free-trial counters and the random device fingerprint may be stored in both `chrome.storage.local` and `chrome.storage.sync`;
- local anonymous statistics are stored locally and can be disabled.

## Appeal / Review Notes

Use the following text when submitting an appeal or additional review explanation.

```text
Hello Chrome Web Store Review Team,

I have updated the extension and its privacy disclosures to address the Purple Nickel privacy policy issue.

What I changed:
1. I rewrote the privacy policy so it now explicitly describes data collection, processing, storage, retention, and sharing.
2. I clearly disclosed that, in free mode, prompt text is sent to the Lynx proxy service for prompt enhancement and quota enforcement.
3. I clearly disclosed that, in BYOK mode, prompt text is sent directly to the AI provider or custom endpoint selected by the user.
4. I disclosed that API keys are stored locally in encrypted form and are not sent to Lynx servers in BYOK mode.
5. I disclosed that free-trial counters and a random device fingerprint may be stored in chrome.storage.local and chrome.storage.sync for quota management.
6. I disclosed local anonymous usage statistics and the user opt-out behavior.
7. I updated the Chrome Web Store privacy form so it matches the extension's current behavior.

Updated privacy policy URL:
https://github.com/gentlemouse/prompt-enhancer-docs/blob/main/privacy-policy.md

I believe the privacy disclosures now accurately reflect the extension's current implementation. Please re-review the item.

Thank you.
```
