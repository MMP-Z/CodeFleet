import type { StepSummaryResult } from './types';

export interface SummarizeInput {
  readonly stepTitle: string;
  readonly stepSummary: string;
  readonly files: ReadonlyArray<{
    readonly path: string;
    readonly change: 'added' | 'modified' | 'deleted';
  }>;
  readonly userPrompt?: string;
}

export class Summarizer {
  public summarize(input: SummarizeInput): StepSummaryResult {
    const fileCount = input.files.length;
    const addedFiles = input.files.filter((f) => f.change === 'added').map((f) => f.path);
    const modifiedFiles = input.files.filter((f) => f.change === 'modified').map((f) => f.path);

    const summaryLines: string[] = [];
    if (fileCount === 0) {
      summaryLines.push(`Đã hoàn tất bước: ${input.stepTitle}.`);
    } else if (addedFiles.length > 0 && modifiedFiles.length === 0) {
      summaryLines.push(
        `Đã tạo mới ${addedFiles.length} file: ${addedFiles.join(', ')} phục vụ cho ${input.stepTitle.toLowerCase()}.`,
      );
    } else if (modifiedFiles.length > 0 && addedFiles.length === 0) {
      summaryLines.push(
        `Đã cập nhật ${modifiedFiles.length} file: ${modifiedFiles.join(', ')} theo yêu cầu.`,
      );
    } else {
      summaryLines.push(
        `Đã hoàn thành ${input.stepTitle}: tạo ${addedFiles.join(', ')} và cập nhật ${modifiedFiles.join(', ')}.`,
      );
    }

    const explainLines: string[] = [];
    for (const file of input.files) {
      const action =
        file.change === 'added' ? 'Thêm mới' : file.change === 'modified' ? 'Chỉnh sửa' : 'Xoá';
      explainLines.push(`${action} file \`${file.path}\` để hiện thực cấu trúc và logic của bước.`);
    }

    const why =
      input.files.length > 0
        ? `Tách biệt cấu trúc mã nguồn rõ ràng giúp dễ kiểm tra, hoàn tác từng phần và bảo vệ các file người dùng tự sửa.`
        : null;

    return {
      summary: summaryLines,
      explain: explainLines,
      why,
    };
  }
}
