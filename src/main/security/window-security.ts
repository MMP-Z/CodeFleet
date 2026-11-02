import type { WebPreferences } from 'electron';

/**
 * Cấu hình bảo mật cửa sổ Electron theo Luật B1:
 * contextIsolation: true, nodeIntegration: false, sandbox: true, có CSP.
 */
export function buildSecureWebPreferences(preloadPath: string): WebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: false,
  };
}

/**
 * Chính sách Content-Security-Policy (Luật B1 + Prompt 1: không tải font từ mạng).
 */
export function buildContentSecurityPolicy(isDev: boolean): string {
  const scriptSrc = isDev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'";
  const connectSrc = isDev
    ? "connect-src 'self' ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:*"
    : "connect-src 'self'";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data:",
    connectSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Chỉ cho phép điều hướng nội bộ trong origin của renderer (hoặc file:// đóng gói).
 */
export function isNavigationAllowed(targetUrl: string, allowedRendererUrl?: string): boolean {
  try {
    const parsedTarget = new URL(targetUrl);
    if (parsedTarget.protocol === 'file:') {
      return true;
    }
    if (!allowedRendererUrl) {
      return false;
    }
    const parsedAllowed = new URL(allowedRendererUrl);
    return parsedTarget.origin === parsedAllowed.origin;
  } catch {
    return false;
  }
}

