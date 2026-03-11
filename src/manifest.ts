import { defineManifest } from '@crxjs/vite-plugin';

/**
 * Chrome 扩展 Manifest 配置
 * P0-1.1: 权限最小化改进
 * - 移除默认全站注入，改为 activeTab
 * - host_permissions 改为 optional，按需授权
 */
export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  version: '1.3.4',
  description: '__MSG_extDescription__',
  default_locale: 'en',

  // P0-1.1: 权限最小化 - 仅请求必要权限
  permissions: [
    'storage', // 本地存储
    'activeTab', // 当前标签页（替代 host_permissions）
    'contextMenus', // 右键菜单
    'scripting', // 动态注入脚本
  ],

  // P0-1.1: 可选权限 - 按需请求
  optional_permissions: ['tabs'],

  // P0-1.1: 可选主机权限 - 仅在用户首次使用时请求
  optional_host_permissions: ['<all_urls>'],

  // 移除默认全站 content_scripts 注入
  // 改为通过 scripting API 动态注入

  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },

  web_accessible_resources: [
    {
      resources: ['icons/*.png', 'src/content/*'],
      matches: ['<all_urls>'],
    },
  ],

  // 仅用于 CRXJS 打包 content script，实际通过 scripting API 动态注入
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      css: ['src/content/styles.css'],
      run_at: 'document_idle',
    },
  ],

  // 快捷键配置
  commands: {
    enhance_prompt: {
      suggested_key: {
        default: 'Ctrl+Shift+E',
        mac: 'Command+Shift+E',
      },
      description: '__MSG_commandEnhance__',
    },
  },

  // 内容安全策略
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
});
