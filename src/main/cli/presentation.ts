/* eslint-disable no-control-regex -- Untrusted terminal output requires control-character filtering. */
export const BANNER = [
  '========================================',
  'CodeFleet CLI - Giao diện dòng lệnh',
  'Gõ /help để xem danh sách lệnh hỗ trợ.',
  '========================================',
].join('\n');

export const HELP = [
  'Danh sách lệnh CodeFleet CLI:',
  '  /help              Hiển thị trợ giúp',
  '  /agents            Kiểm tra agent và xem gợi ý cài đặt',
  '  /agent <id|auto>   Chọn agent cụ thể hoặc chế độ tự động (auto)',
  '  /models [id|auto]  Kiểm tra model của agent hiện tại hoặc agent chỉ định',
  '  /model <id>        Đổi model sử dụng',
  '  /history           Xem lịch sử hội thoại',
  '  /input telex|vni|system  Chọn cách gõ tiếng Việt',
  '  /mode agent|subagent  Chọn một agent hoặc để agent chính phân công',
  '  /team <yêu cầu>     Dùng chế độ subagent cho một lượt',
  '  /skill             Xem skill; /skill install <link-git> để cài (/skill help)',
  '  /new               Bắt đầu phiên hội thoại mới',
  '  /exit              Thoát chương trình',
].join('\n');

const ANSI_ESCAPE_REGEX =
  /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]|\u009b[0-?]*[ -/]*[@-~]/g;
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

function sanitizeText(value: unknown): string {
  if (typeof value === 'string') {
    return value
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '')
      .replace(ANSI_ESCAPE_REGEX, '')
      .replace(CONTROL_CHARS_REGEX, '');
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickNestedRecord(root: Record<string, unknown>, key: string): Record<string, unknown> {
  const nested = asRecord(root[key]);
  return nested ?? root;
}

export function formatEvent(event: { type: string; data: unknown }): string {
  if (!event || typeof event.type !== 'string') {
    return '';
  }

  const { type, data } = event;

  switch (type) {
    case 'message_added': {
      const root = asRecord(data);
      if (!root) {
        return '';
      }
      const msg = pickNestedRecord(root, 'message');
      const role = sanitizeText(msg.role).trim().toLowerCase();
      if (role !== 'assistant') {
        return '';
      }
      const content = sanitizeText(msg.content ?? msg.text);
      if (!content.trim()) {
        return '';
      }
      return content;
    }

    case 'log_entry': {
      const root = asRecord(data);
      if (!root) {
        return '';
      }
      const entry = pickNestedRecord(root, 'entry');
      const source = sanitizeText(entry.source).trim();
      const text = sanitizeText(entry.text ?? entry.message);
      if (!text.trim()) {
        return '';
      }
      return source ? `[${source}] ${text}` : text;
    }

    case 'system_line': {
      if (typeof data === 'string') {
        const text = sanitizeText(data);
        return text.trim() ? text : '';
      }
      const root = asRecord(data);
      if (!root) {
        return '';
      }
      const text = sanitizeText(root.text ?? root.message);
      return text.trim() ? text : '';
    }

    case 'step_updated': {
      const root = asRecord(data);
      if (!root) {
        return '';
      }
      const step = pickNestedRecord(root, 'step');
      const seq = sanitizeText(step.seq ?? step.index ?? step.id).trim();
      const status = sanitizeText(step.status).trim();
      const summary = sanitizeText(step.summary ?? step.title ?? step.text);

      const parts: string[] = [];
      if (seq) {
        parts.push(`[Bước ${seq}]`);
      } else {
        parts.push('[Bước]');
      }
      if (status) {
        parts.push(`(${status})`);
      }
      if (summary.trim()) {
        parts.push(summary);
      }
      return parts.length > 1 || seq ? parts.join(' ') : '';
    }

    case 'execution_paused': {
      if (typeof data === 'string') {
        const reason = sanitizeText(data);
        return reason.trim() ? `[Tạm dừng] ${reason}` : '[Tạm dừng]';
      }
      const root = asRecord(data);
      const reason = root ? sanitizeText(root.reason ?? root.message ?? root.text) : '';
      return reason.trim() ? `[Tạm dừng] ${reason}` : '[Tạm dừng]';
    }

    case 'execution_done': {
      const root = asRecord(data);
      const detail = root ? sanitizeText(root.summary ?? root.message ?? root.text) : '';
      return detail.trim() ? `[Hoàn tất] ${detail}` : '[Hoàn tất]';
    }

    case 'execution_stopped': {
      const root = asRecord(data);
      const detail = root ? sanitizeText(root.reason ?? root.message ?? root.text) : '';
      return detail.trim() ? `[Đã dừng] ${detail}` : '[Đã dừng]';
    }

    case 'permission_requested':
    default:
      return '';
  }
}
