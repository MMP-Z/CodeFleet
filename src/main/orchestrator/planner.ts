import type { PlanStep } from './types';

export class Planner {
  public async plan(
    prompt: string,
    _context?: { readonly projectPath?: string; readonly existingFiles?: readonly string[] },
  ): Promise<PlanStep[]> {
    const trimmed = prompt.trim();
    const lower = trimmed.toLowerCase();

    // 1. Kiểm tra các yếu tố nhạy cảm (auth, payment, database migration, delete)
    const hasAuth = /đăng nhập|login|auth|xác thực|tài khoản|mật khẩu/i.test(lower);
    const hasPayment = /thanh toán|payment|giỏ hàng|checkout|tiền|đơn hàng/i.test(lower);
    const hasDelete = /xoá|delete|remove|dọn dẹp/i.test(lower);

    // 2. Nếu là yêu cầu thanh toán hoặc giỏ hàng có thanh toán
    if (hasPayment) {
      const steps: PlanStep[] = [
        {
          seq: 1,
          title: 'Khung giỏ hàng và danh sách sản phẩm',
          summary: 'Tạo cấu trúc hiển thị sản phẩm và tính toán tổng tiền đơn hàng',
          kind: 'feature',
          requiredTier: 'balanced',
          riskLevel: 'low',
          riskTags: ['user_data'],
        },
        {
          seq: 2,
          title: 'Xử lý cổng thanh toán và giao dịch',
          summary: 'Tích hợp logic xử lý thanh toán nhạy cảm, kiểm tra chữ ký giao dịch',
          kind: 'sensitive',
          requiredTier: 'strong',
          riskLevel: 'high',
          riskTags: ['payment', 'network'],
        },
        {
          seq: 3,
          title: 'Giao diện thông báo kết quả đơn hàng',
          summary: 'Trang cảm ơn và hiển thị mã đơn hàng sau khi thanh toán thành công',
          kind: 'styling',
          requiredTier: 'fast',
          riskLevel: 'low',
          riskTags: [],
        },
      ];
      return steps;
    }

    // 3. Nếu là yêu cầu đăng nhập/xác thực
    if (hasAuth) {
      return [
        {
          seq: 1,
          title: 'Giao diện biểu mẫu đăng nhập',
          summary: 'Tạo form nhập email, mật khẩu và nút gửi với giao diện thân thiện',
          kind: 'feature',
          requiredTier: 'balanced',
          riskLevel: 'low',
          riskTags: [],
        },
        {
          seq: 2,
          title: 'Cơ chế xác thực tài khoản và bảo mật mật khẩu',
          summary: 'Xử lý mã hoá mật khẩu, kiểm tra phiên đăng nhập và bảo vệ dữ liệu',
          kind: 'sensitive',
          requiredTier: 'strong',
          riskLevel: 'high',
          riskTags: ['auth', 'user_data'],
        },
      ];
    }

    // 4. Nếu có yêu cầu xoá hoặc dọn dẹp
    if (hasDelete) {
      return [
        {
          seq: 1,
          title: 'Kiểm tra và chuẩn bị danh sách mục cần xoá',
          summary: 'Rà soát các file và dữ liệu không còn sử dụng trong dự án',
          kind: 'scaffold',
          requiredTier: 'balanced',
          riskLevel: 'medium',
          riskTags: ['user_data'],
        },
        {
          seq: 2,
          title: 'Thực hiện dọn dẹp an toàn',
          summary: 'Xoá các file thừa với cơ chế tạo điểm khôi phục bảo vệ',
          kind: 'sensitive',
          requiredTier: 'strong',
          riskLevel: 'high',
          riskTags: ['user_data'],
        },
      ];
    }

    // 5. Yêu cầu tạo trang landing hoặc web tổng quát (mặc định cho "làm cho tôi trang landing đơn giản")
    return [
      {
        seq: 1,
        title: 'Tạo khung trang và cấu trúc HTML',
        summary: 'Tạo file index.html với tiêu đề, phần giới thiệu và các khối nội dung cơ bản',
        kind: 'scaffold',
        requiredTier: 'balanced',
        riskLevel: 'low',
        riskTags: [],
      },
      {
        seq: 2,
        title: 'Thiết kế giao diện và màu sắc',
        summary: 'Thêm phong cách CSS hiện đại, bố cục cân đối và hỗ trợ hiển thị di động',
        kind: 'styling',
        requiredTier: 'fast',
        riskLevel: 'low',
        riskTags: [],
      },
      {
        seq: 3,
        title: 'Thêm hiệu ứng tương tác',
        summary: 'Thêm nút kêu gọi hành động và thông báo tương tác mượt mà',
        kind: 'feature',
        requiredTier: 'balanced',
        riskLevel: 'low',
        riskTags: [],
      },
    ];
  }
}
