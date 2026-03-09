# Lynx — Smart Prompt Enhancer

[![CI](https://github.com/gentlemouse/prompt-enhancer/actions/workflows/ci.yml/badge.svg)](https://github.com/gentlemouse/prompt-enhancer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-green.svg)](https://github.com/gentlemouse/prompt-enhancer/releases)
[![Test Coverage](https://img.shields.io/badge/coverage-97.99%25-brightgreen.svg)](#testing)

**[简体中文](README.zh-CN.md)** | English

> 心有灵犀一点通 — Instant understanding, every time.

**Lynx** is a browser extension that acts as an intelligent layer between you and any AI. It reads your prompt, figures out exactly what it needs, and upgrades it — automatically, in under a second — before you hit send.

Works on ChatGPT, Claude, Gemini, DeepSeek, Kimi, and 50+ other platforms. No API keys needed to get started.

---

## The Problem It Solves

You type a quick question into an AI and get a mediocre answer. You rewrite the prompt — adding structure, constraints, a role, output requirements — and *then* the AI gives you what you actually wanted.

**Great prompts are a skill. Using it every single time is exhausting.**

Most "prompt enhancers" just make your prompt longer. Lynx is different: it **understands what your specific prompt needs** and applies a targeted strategy.

---

## Why Lynx Beats the Other Tools

| | Generic Tools | Lynx |
|---|---|---|
| Short commands like `"translate this"` | Bloat them with unnecessary structure | Light polish — just fills the gaps |
| Complex requests | Apply one fixed template | Selects from 5 strategies based on 15+ signal dimensions |
| Your carefully written prompt | Rewrite it anyway | Detects good structure, only fine-tunes |
| Follow-up questions like `"can you elaborate?"` | Treat as a standalone new prompt | Understands it's a follow-up, resolves the vague reference |
| Corrections like `"also make it async"` | Ignore the correction context | Merges your new constraint into the original request |
| Bilingual users | Pick one language | Auto-detects Chinese/English, preserves your language |

---

## How It Works: 3-Stage Pipeline

```
Your prompt  →  [Analyze]  →  [Strategize]  →  [Build]  →  Enhanced prompt
```

### Stage 1 · Multi-Dimensional Analysis

Every prompt is analyzed across **5 dimensions simultaneously:**

| Dimension | What it measures |
|-----------|-----------------|
| **Task Type** | One of 8 categories: Code, Writing, Analysis, Q&A, Planning, Research, Chat, Extraction |
| **Complexity** | Detects chain-of-thought signals, multi-part questions, reflection markers |
| **Context** | New topic, follow-up, or correction — using a 5-turn session memory |
| **Structure** | Does the prompt already have role/task/constraints? |
| **Language** | Chinese or English — preserved throughout |

### Stage 2 · Strategy Selection

Based on the analysis, one of **5 strategies** is chosen — each built for a different scenario:

```
Is it a correction? ("also add...", "remove...", "change...")
  → CONSTRAINT APPEND  — merges new requirements into original

Is it a follow-up? (references prior context)
  → INTENT CLARIFY     — resolves ambiguous references, stays conversational

Is the prompt very short? (< 30 chars)
  → LIGHT POLISH       — fills critical gaps without over-expanding

Is it already well-structured?
  → SHARPEN            — tightens wording, adds specificity, preserves structure

Otherwise:
  → STRUCTURAL REWRITE — builds a full role/task/constraints/output framework
```

### Stage 3 · Prompt Building

The chosen strategy generates a **specialized system prompt** that instructs the LLM precisely how to optimize your text — tuned not just for strategy, but also for task type and reasoning depth. The result replaces your original input in the text box.

---

## Real Examples

### Light Polish — Short commands get smarter, not longer

| | |
|---|---|
| **Before** | `Translate this paragraph` |
| **After** | `Translate the following paragraph into English. Preserve the original tone and style. For technical terms, keep the source term in parentheses.` |

### Structural Rewrite — Complex requests get a clear framework

| | |
|---|---|
| **Before** | `Help me write a Python web scraper for news sites` |
| **After** | `Role: Senior Python developer experienced with web scraping.`<br><br>`Task: Build a configurable news site scraper that extracts: title, publish date, author, body text. Handle pagination automatically.`<br><br>`Constraints: Use requests + BeautifulSoup. Rate-limit to 1 req/sec. Graceful error handling — log and skip on failure, don't abort.`<br><br>`Output: Complete, runnable Python script with a usage example.` |

### Intent Clarify — Vague follow-ups become precise

| | |
|---|---|
| **Before** | `Can you go into more detail on that?` |
| **After** | `Please elaborate on the "data storage architecture" section from your previous response. Specifically, compare the trade-offs between SQL and NoSQL for this use case and give a recommendation.` |

### Sharpen — Already good prompts get polished

| | |
|---|---|
| **Before** | `Role: marketing expert. Task: write ad copy. Requirements: make it engaging.` |
| **After** | `Role: Senior marketing copywriter with 10+ years in consumer electronics. Task: Write 3 variations of ad copy for our new wireless earbuds. Tone: energetic, youth-oriented. Length: 50–80 words per variation. Include one CTA per variation. Avoid: generic superlatives, competitor comparisons.` |

### Constraint Append — Corrections get properly integrated

| | |
|---|---|
| **Before** | `Add error handling and make it async` |
| **After** | `Based on the previous code, make these modifications: 1. Convert all sync I/O to async/await. 2. Add error handling: network timeout → retry 3× with exponential backoff; invalid data → log warning and skip; permission error → raise immediately. 3. Keep all existing functionality unchanged.` |

---

## Features at a Glance

- **5 Dynamic Strategies** — Automatically matched to each prompt's characteristics
- **8 Task Types** — Code, Writing, Analysis, Q&A, Planning, Research, Chat, Extraction
- **3 Reasoning Modes** — Simple / Deep Thinking / Expert, selected by complexity signals
- **5-Turn Session Memory** — Tracks conversation context for accurate follow-up handling
- **Anti-Injection Protection** — Prevents prompt injection attacks during optimization
- **10 Free Enhancements** — No setup, no API key required to get started
- **BYOK Mode** — Bring your own key from OpenAI, Anthropic, DeepSeek, Kimi, MiniMax, Qwen, Zhipu, or any custom endpoint
- **50+ Platforms** — ChatGPT, Claude, Gemini, DeepSeek, Kimi, Qwen, and many more
- **Privacy First** — Prompts are processed only when requested, API keys stay local, and analytics can be disabled
- **Keyboard Shortcut** — `Cmd/Ctrl+Shift+E` to enhance · `Ctrl+Z` to undo

---

## Install

### Chrome Web Store
> Coming soon.

### Edge Add-ons
> Coming soon.

### Build from Source

```bash
git clone https://github.com/gentlemouse/prompt-enhancer.git
cd prompt-enhancer
npm install
npm run build
```

1. Open `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge)
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist` folder

---

## Usage

### Free Mode (No setup)

Install → visit any AI chat page → press `Cmd+Shift+E` or click the ✦ button. Done. 10 free enhancements.

### BYOK Mode (Unlimited)

1. Click the extension icon → open settings
2. Select a provider: OpenAI / Anthropic / DeepSeek / Kimi / Qwen / Custom
3. Enter your API key → Save
4. Unlimited enhancements, forever

### Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Enhance prompt | `⌘⇧E` | `Ctrl+Shift+E` |
| Undo | `⌘Z` | `Ctrl+Z` |

---

## Architecture

```
src/
├── background/
│   ├── analyzer.ts         # Multi-dimensional analysis engine (5 dims, 15+ signals)
│   ├── prompt-builder.ts   # 5 strategy templates with task-type guidance
│   ├── enhancer.ts         # Orchestrator
│   └── providers/          # API adapters: OpenAI / Anthropic / DeepSeek / Proxy
├── content/
│   ├── services/
│   │   ├── input-detector.ts   # Detects input fields on 50+ platforms
│   │   └── session-memory.ts   # 5-turn sliding window session memory
│   └── ui/                     # Shadow DOM isolated UI components
├── shared/
│   ├── analytics.ts        # Anonymous, opt-out usage analytics
│   ├── fingerprint.ts      # Device fingerprint for free tier anti-abuse
│   ├── trial.ts            # Free trial management
│   └── utils/              # Encryption, retry, validation
├── popup/                  # Settings page + onboarding flow
└── manifest.ts             # Chrome Extension Manifest V3
```

---

## Testing

Core module test coverage: **97.99%** across 146 test cases.

| Module | Statements | Branches | Functions | Lines |
|--------|-----------|----------|-----------|-------|
| analyzer.ts | 98.83% | 98.11% | 100% | 98.64% |
| prompt-builder.ts | 100% | 80% | 100% | 100% |
| session-memory.ts | 100% | 100% | 100% | 100% |
| analytics.ts | 95% | 86.11% | 100% | 94.52% |
| validation.ts | 100% | 100% | 100% | 100% |
| retry.ts | 96.96% | 91.3% | 100% | 96.55% |

```bash
npm run test            # Run tests
npm run test:coverage   # Tests + coverage report
```

---

## Development

```bash
npm run dev            # Dev mode with HMR
npm run build          # Production build
npm run lint           # ESLint
npm run type-check     # TypeScript check
```

---

## Tech Stack

- **TypeScript** — Strict mode, full type safety
- **Vite + CRXJS** — Modern build tooling with HMR
- **Vitest** — Unit tests + coverage
- **ESLint + Prettier + Husky** — Code quality gates
- **GitHub Actions** — CI/CD pipeline
- **Cloudflare Workers** — API proxy layer
- **Chrome Extension Manifest V3**

---

## Privacy

- **On-demand prompt processing** — In free mode, prompts are sent to the Lynx proxy; in BYOK mode, prompts are sent directly to your chosen AI provider
- **Encrypted API keys** — Stored in `chrome.storage.local`, never synced to cloud
- **HTTPS enforced** — Custom endpoints require HTTPS
- **Opt-out analytics** — Anonymous usage data can be disabled anytime

See full [Privacy Policy](docs/privacy-policy.md).

---

## Contributing

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push and open a Pull Request

---

## License

[MIT](LICENSE) © mouse 张
