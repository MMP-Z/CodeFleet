import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type EditableKind = 'text' | 'color' | 'number';

export interface EditableLocator {
  readonly line: number;
  readonly col: number;
  readonly length: number;
  readonly originalSnippet: string;
}

export interface EditableItem {
  readonly id: string;
  readonly kind: EditableKind;
  readonly label: string;
  readonly value: string;
  readonly file: string;
  readonly locator: EditableLocator;
}

export class EditableScanner {
  private static readonly IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'out',
    'build',
    '.next',
    '.nuxt',
  ]);

  public static scanProject(projectPath: string): EditableItem[] {
    const items: EditableItem[] = [];
    if (!fs.existsSync(projectPath)) return items;

    function walk(currentDir: string): void {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (EditableScanner.IGNORED_DIRS.has(entry.name)) continue;
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const relPath = path.relative(projectPath, fullPath).replace(/\\/g, '/');
          const ext = path.extname(entry.name).toLowerCase();

          if (['.html', '.jsx', '.tsx', '.vue'].includes(ext)) {
            items.push(...EditableScanner.scanHtmlJsx(projectPath, relPath));
          } else if (['.css', '.scss'].includes(ext)) {
            items.push(...EditableScanner.scanCss(projectPath, relPath));
          } else if (['.json'].includes(ext) && !entry.name.includes('package')) {
            items.push(...EditableScanner.scanJson(projectPath, relPath));
          }
        }
      }
    }

    try {
      walk(projectPath);
    } catch {
      // bỏ qua lỗi đọc thư mục
    }

    return items;
  }

  public static scanHtmlJsx(projectPath: string, relPath: string): EditableItem[] {
    const items: EditableItem[] = [];
    const fullPath = path.join(projectPath, relPath);
    if (!fs.existsSync(fullPath)) return items;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    // Tìm chuỗi text nằm giữa các thẻ HTML >...<
    const tagContentRegex = /<([a-zA-Z0-9]+)[^>]*>([^<>\n\r]{2,80})<\/\1>/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineText = lines[lineIdx];
      let match: RegExpExecArray | null;
      tagContentRegex.lastIndex = 0;

      while ((match = tagContentRegex.exec(lineText)) !== null) {
        const tagName = match[1];
        const textValue = match[2].trim();
        if (textValue.length === 0 || textValue.startsWith('{') || textValue.startsWith('<!--')) {
          continue;
        }

        // Tính cột bắt đầu của textValue
        const fullMatch = match[0];
        const textOffsetInMatch = fullMatch.indexOf(textValue);
        const col = match.index + textOffsetInMatch;

        const id = crypto.createHash('md5').update(`${relPath}:${lineIdx + 1}:${col}`).digest('hex');

        items.push({
          id,
          kind: 'text',
          label: `${tagName.toUpperCase()} (${textValue.slice(0, 24)}${textValue.length > 24 ? '…' : ''})`,
          value: textValue,
          file: relPath,
          locator: {
            line: lineIdx + 1,
            col: col + 1,
            length: textValue.length,
            originalSnippet: textValue,
          },
        });
      }
    }
    return items;
  }

  public static scanCss(projectPath: string, relPath: string): EditableItem[] {
    const items: EditableItem[] = [];
    const fullPath = path.join(projectPath, relPath);
    if (!fs.existsSync(fullPath)) return items;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    // Tìm mã màu hex #123456 hoặc #123
    const hexColorRegex = /#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineText = lines[lineIdx];
      let match: RegExpExecArray | null;
      hexColorRegex.lastIndex = 0;

      while ((match = hexColorRegex.exec(lineText)) !== null) {
        const colorValue = match[0];
        const col = match.index;
        const id = crypto.createHash('md5').update(`${relPath}:${lineIdx + 1}:${col}`).digest('hex');

        items.push({
          id,
          kind: 'color',
          label: `Màu sắc (${colorValue})`,
          value: colorValue,
          file: relPath,
          locator: {
            line: lineIdx + 1,
            col: col + 1,
            length: colorValue.length,
            originalSnippet: colorValue,
          },
        });
      }
    }
    return items;
  }

  public static scanJson(projectPath: string, relPath: string): EditableItem[] {
    const items: EditableItem[] = [];
    const fullPath = path.join(projectPath, relPath);
    if (!fs.existsSync(fullPath)) return items;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    // Tìm số nguyên hoặc số thực "key": 50000
    const numberPropRegex = /"([^"]+)"\s*:\s*(-?[0-9]+(\.[0-9]+)?)/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineText = lines[lineIdx];
      let match: RegExpExecArray | null;
      numberPropRegex.lastIndex = 0;

      while ((match = numberPropRegex.exec(lineText)) !== null) {
        const propName = match[1];
        const numValue = match[2];
        const matchStr = match[0];
        const numOffset = matchStr.lastIndexOf(numValue);
        const col = match.index + numOffset;

        const id = crypto.createHash('md5').update(`${relPath}:${lineIdx + 1}:${col}`).digest('hex');

        items.push({
          id,
          kind: 'number',
          label: `${propName}`,
          value: numValue,
          file: relPath,
          locator: {
            line: lineIdx + 1,
            col: col + 1,
            length: numValue.length,
            originalSnippet: numValue,
          },
        });
      }
    }
    return items;
  }

  public static applyEdit(
    projectPath: string,
    relPath: string,
    locator: EditableLocator,
    newValue: string,
  ): { ok: boolean; newContentHash: string; error?: string } {
    const fullPath = path.join(projectPath, relPath);
    if (!fs.existsSync(fullPath)) {
      return { ok: false, newContentHash: '', error: 'File not found' };
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const targetLineIdx = locator.line - 1;

    if (targetLineIdx < 0 || targetLineIdx >= lines.length) {
      return { ok: false, newContentHash: '', error: 'Invalid line index' };
    }

    const lineText = lines[targetLineIdx];
    const targetColIdx = locator.col - 1;

    // Kiểm tra đoạn cần thay thế có khớp originalSnippet không
    const snippetAtLoc = lineText.substring(targetColIdx, targetColIdx + locator.length);
    if (snippetAtLoc !== locator.originalSnippet) {
      // Nếu vị trí lệch dòng một chút, thử tìm originalSnippet trên cùng dòng
      const actualColIdx = lineText.indexOf(locator.originalSnippet);
      if (actualColIdx === -1) {
        return {
          ok: false,
          newContentHash: '',
          error: `Original snippet "${locator.originalSnippet}" not found at line ${locator.line}`,
        };
      }
      lines[targetLineIdx] =
        lineText.substring(0, actualColIdx) +
        newValue +
        lineText.substring(actualColIdx + locator.originalSnippet.length);
    } else {
      lines[targetLineIdx] =
        lineText.substring(0, targetColIdx) +
        newValue +
        lineText.substring(targetColIdx + locator.length);
    }

    const updatedContent = lines.join('\n');
    fs.writeFileSync(fullPath, updatedContent, 'utf8');

    const newContentHash = crypto.createHash('sha256').update(updatedContent).digest('hex');
    return { ok: true, newContentHash };
  }
}
