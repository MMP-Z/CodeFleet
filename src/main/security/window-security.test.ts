import { describe, expect, it } from 'vitest';
import {
  buildContentSecurityPolicy,
  buildSecureWebPreferences,
  isNavigationAllowed,
} from './window-security';

describe('window-security (Luật B1)', () => {
  it('enforces contextIsolation, disables nodeIntegration, and enables sandbox', () => {
    const prefs = buildSecureWebPreferences('D:/app/out/preload/index.cjs');
    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.nodeIntegration).toBe(false);
    expect(prefs.sandbox).toBe(true);
    expect(prefs.webSecurity).toBe(true);
    expect(prefs.allowRunningInsecureContent).toBe(false);
    expect(prefs.preload).toBe('D:/app/out/preload/index.cjs');
  });

  it('builds strict production CSP with self-hosted fonts only', () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).not.toContain('fonts.googleapis.com');
    expect(csp).not.toContain('fonts.gstatic.com');
    expect(csp).toContain("object-src 'none'");
  });

  it('blocks navigation to external origins while allowing local bundle or dev server', () => {
    expect(isNavigationAllowed('file:///C:/CodeFleet/out/renderer/index.html')).toBe(true);
    expect(isNavigationAllowed('http://localhost:5173/settings', 'http://localhost:5173')).toBe(
      true,
    );
    expect(isNavigationAllowed('https://evil.example.com', 'http://localhost:5173')).toBe(false);
    expect(isNavigationAllowed('not-a-valid-url', 'http://localhost:5173')).toBe(false);
  });
});
