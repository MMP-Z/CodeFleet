import type { Config } from 'tailwindcss';

/**
 * Design tokens từ Document/UI_SPEC.md mục 2.
 * Không thêm màu ngoài bảng nếu chưa cập nhật UI_SPEC.md (Luật T1, Prompt 1).
 */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F4F5F2',
        surface: '#FFFFFF',
        'surface-2': '#FBFBF9',
        border: '#DCE0DB',
        line: '#ECEEEA',
        dashed: '#C5CCC7',
        text: '#16201D',
        muted: '#55625D',
        primary: '#0B6B5D',
        'primary-soft': '#DDF0EA',
        'primary-ink': '#0B3F37',
        'primary-row': '#EEF7F4',
        'warn-bg': '#FFEFC9',
        'warn-ink': '#7A4F00',
        'warn-border': '#E8CF8E',
        'ok-bg': '#DDF3E6',
        'ok-ink': '#17663F',
        'info-bg': '#DDEBFA',
        'info-ink': '#0B5CAD',
        danger: '#D23B30',
        'danger-bg': '#FCE9E6',
        'danger-ink': '#9B231B',
        'bar-ok': '#2E9E65',
        'bar-low': '#D9930D',
        dark: '#0C1210',
        'dark-2': '#19231F',
        'dark-line': '#24312C',
        'dark-text': '#D8E3DE',
        'dark-muted': '#93A79F',
        'ai-claude': '#C2603A',
        'ai-codex': '#2F5FD0',
        'ai-gemini': '#7A4FD0',
        'ai-claude-d': '#E08A64',
        'ai-codex-d': '#6F9BFF',
        'ai-gemini-d': '#B79CFF',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        base: ['14px', { lineHeight: '1.5' }],
        small: ['12px', { lineHeight: '1.45' }],
        code: ['12.5px', { lineHeight: '1.7' }],
        'page-title': ['22px', { lineHeight: '1.3' }],
        'card-title': ['17px', { lineHeight: '1.3' }],
        'sub-title': ['15px', { lineHeight: '1.3' }],
      },
      borderRadius: {
        pill: '999px',
        card: '12px',
        btn: '8px',
        input: '10px',
        dialog: '14px',
      },
      boxShadow: {
        pop: '0 8px 24px rgba(22, 32, 29, 0.14)',
        tab: '0 1px 2px rgba(22, 32, 29, 0.15)',
        dialog: '0 20px 48px rgba(12, 18, 16, 0.28)',
      },
    },
  },
  plugins: [],
} satisfies Config;
