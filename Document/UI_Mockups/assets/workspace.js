/* =========================================================
   workspace.js — bố cục C: chat ở giữa + khung phải 3 tab.
   Dùng lại cho các màn 03, 04, 05, 06, 07.
   Tuỳ biến bằng window.MOCK_WS trước khi nạp file này.
   ========================================================= */
(function () {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const vnd = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
  const O = Object.assign({
    tab: 'code', step: 3, level: 'diff',
    running: true,
    userMsg: 'Làm cho mình web bán bánh có giỏ hàng và đăng nhập nhé',
    intro: 'Mình chia việc thành 5 bước và tự chọn AI cho từng bước. Bấm “Xem code” ở bước nào để đọc phần AI đã viết, ở khung bên phải.',
    systemLine: 'Gemini Pro đã hết hạn mức. Bước 4 nhạy cảm nên không dùng Gemini Flash, app chuyển sang Claude Opus 5.5',
    tail: 'Codex đang làm giỏ hàng… bạn có thể thử giỏ hàng ở thẻ “Xem trước”.',
    extraChat: '',
    stepsOverride: null
  }, window.MOCK_WS || {});

  const S = { tab: O.tab, step: O.step, level: O.level, undone: {}, cart: { 1: 1, 2: 0, 3: 2 } };

  const STEPS = O.stepsOverride || [
    { id: 1, text: 'Dựng khung trang chủ: tiêu đề, banner và menu', ai: 'Claude', model: 'Sonnet 5.5', status: 'done' },
    { id: 2, text: 'Thêm danh sách bánh có tên và giá', ai: 'Codex', model: 'GPT-5.5', status: 'done' },
    { id: 3, text: 'Làm giỏ hàng: thêm bánh, đổi số lượng, tính tổng tiền', ai: 'Codex', model: 'GPT-5.5', status: 'running' },
    { id: 4, text: 'Thêm đăng nhập bằng email và mật khẩu', ai: 'Claude', model: 'Opus 5.5', status: 'waiting',
      note: 'Đổi từ Gemini Pro vì hết hạn mức', risk: 'Liên quan đăng nhập: nên đọc kỹ' },
    { id: 5, text: 'Chạy thử toàn bộ và sửa lỗi', ai: 'Claude', model: 'Sonnet 5.5', status: 'waiting' }
  ];
  const TONE = {
    done: ['Xong', 'ok'], running: ['Đang làm', 'run'], waiting: ['Chờ', 'wait'],
    undone: ['Đã hoàn tác', 'wait'], paused: ['Tạm dừng', 'warn'], conflict: ['Cần bạn xác nhận', 'warn'],
    ask: ['Đang chờ bạn cho phép', 'warn'], failed: ['Chưa làm được', 'danger']
  };
  const CODE = {
    1: {
      file: 'index.html', risk: 'Thấp',
      files: [['index.html', 'added'], ['style.css', 'added'], ['app.js', 'added']],
      summary: ['Tạo trang chủ có tiêu đề, menu và banner.', 'Thêm 3 file: index.html, style.css, app.js.', 'Chưa có chức năng bán hàng, mới chỉ là khung.'],
      diff: [['+', '<header class="top">'], ['+', '  <h1>Tiệm Bánh Nhỏ</h1>'], ['+', '  <nav><a href="#banh">Bánh</a> <a href="#gio">Giỏ hàng</a></nav>'], ['+', '</header>'], ['+', '<section class="banner">Bánh nướng mỗi sáng</section>']],
      explain: ['Phần <header> là thanh trên cùng, chứa tên tiệm và menu.', 'Phần <section class="banner"> là dải chữ lớn ở đầu trang.'],
      full: ['<!doctype html>', '<html lang="vi">', '<head><title>Tiệm Bánh Nhỏ</title></head>', '<body>', '<header class="top">', '  <h1>Tiệm Bánh Nhỏ</h1>', '  <nav><a href="#banh">Bánh</a> <a href="#gio">Giỏ hàng</a></nav>', '</header>', '<section class="banner">Bánh nướng mỗi sáng</section>', '</body>', '</html>'],
      why: 'Dùng HTML thuần vì trang còn đơn giản, chưa cần framework nặng.'
    },
    2: {
      file: 'products.js', risk: 'Thấp',
      files: [['products.js', 'added'], ['index.html', 'modified']],
      summary: ['Thêm danh sách 3 loại bánh gồm tên và giá.', 'Mỗi bánh hiện thành một thẻ trên trang chủ.', 'Giá lưu bằng số (đồng) để sau này tính tổng dễ hơn.'],
      diff: [['+', 'const cakes = ['], ['+', "  { id: 1, name: 'Bánh mì bơ tỏi', price: 25000 },"], ['+', "  { id: 2, name: 'Bánh su kem', price: 18000 },"], ['+', "  { id: 3, name: 'Tart trứng', price: 22000 },"], ['+', '];']],
      explain: ['Mỗi dòng trong ngoặc là một món bánh. Muốn đổi giá chỉ cần sửa số ở đây.', 'id là mã riêng của từng bánh, giỏ hàng dùng nó để nhận ra bánh nào.'],
      full: ['const cakes = [', "  { id: 1, name: 'Bánh mì bơ tỏi', price: 25000 },", "  { id: 2, name: 'Bánh su kem', price: 18000 },", "  { id: 3, name: 'Tart trứng', price: 22000 },", '];', '', 'function renderCakes() {', '  // vẽ từng bánh thành một thẻ trên trang', '}'],
      why: 'Để dữ liệu bánh trong một mảng riêng. Sau này đổi giá hay thêm bánh chỉ sửa một chỗ.'
    },
    3: {
      file: 'cart.js', risk: 'Thấp',
      files: [['cart.js', 'modified'], ['index.html', 'modified']],
      summary: ['Thêm hàm addToCart: bấm Thêm thì bánh vào giỏ, bấm lại thì tăng số lượng.', 'Giỏ hàng đang nằm trong bộ nhớ trang, tải lại trang sẽ mất.', 'Còn thiếu: nút bớt số lượng và tổng tiền (đang làm).'],
      diff: [[' ', 'let cart = [];'], ['-', '// TODO: giỏ hàng'], ['+', 'function addToCart(cake) {'], ['+', '  const item = cart.find((i) => i.id === cake.id);'], ['+', '  if (item) item.qty += 1;'], ['+', '  else cart.push({ ...cake, qty: 1 });'], ['+', '  renderCart();'], ['+', '}']],
      explain: ['Dòng “cart.find” kiểm tra bánh này đã có trong giỏ chưa.', 'Có rồi thì tăng số lượng thêm 1, chưa có thì thêm mới với số lượng 1.'],
      full: ['let cart = [];', '', 'function addToCart(cake) {', '  const item = cart.find((i) => i.id === cake.id);', '  if (item) item.qty += 1;', '  else cart.push({ ...cake, qty: 1 });', '  renderCart();', '}', '', 'function total() {', '  return cart.reduce((s, i) => s + i.price * i.qty, 0);', '}'],
      why: 'Chưa lưu giỏ hàng lâu dài vì chưa có đăng nhập. Bước 4 sẽ nối giỏ hàng với tài khoản.'
    }
  };
  const CHANGE_LABEL = { added: ['Thêm mới', 'ok'], modified: ['Sửa', 'run'], deleted: ['Xoá', 'danger'] };
  const PRODUCTS = [
    { id: 1, name: 'Bánh mì bơ tỏi', price: 25000, tone: '#E9C98F' },
    { id: 2, name: 'Bánh su kem', price: 18000, tone: '#F3DDB5' },
    { id: 3, name: 'Tart trứng', price: 22000, tone: '#F0C26B' }
  ];

  function stepsHtml() {
    const doneCount = STEPS.filter((s) => s.status === 'done').length;
    return `
      <div class="plan-card">
        <div class="plan-head">
          <div class="row eyebrow" style="justify-content:space-between"><span>Kế hoạch</span><span>${doneCount} / ${STEPS.length} bước xong</span></div>
          <div class="progress thin" style="margin-top:6px"><div class="brand" style="width:${(doneCount / STEPS.length) * 100}%"></div></div>
        </div>
        ${STEPS.map((s) => {
          const t = TONE[S.undone[s.id] ? 'undone' : s.status];
          return `
          <div class="step ${S.step === s.id && S.tab === 'code' ? 'active' : ''}">
            <div class="step-n">${s.id}</div>
            <div class="step-main">
              <div class="step-title">${esc(s.text)}</div>
              <div class="step-meta">
                <span class="who"><span class="dot ${s.ai.toLowerCase()}" aria-hidden="true"></span>${esc(s.ai)} · ${esc(s.model)}</span>
                ${s.note ? `<span>${esc(s.note)}</span>` : ''}
                ${s.risk ? `<span class="pill warn" style="font-weight:600">${esc(s.risk)}</span>` : ''}
              </div>
            </div>
            <span class="pill ${t[1]}">${t[0]}</span>
            ${CODE[s.id] || s.forceCode ? `<button class="btn sm" data-view="${s.id}">Xem code</button>` : ''}
          </div>`;
        }).join('')}
      </div>`;
  }

  function chatHtml() {
    return `
      <div class="chat-scroll">
        <div class="bubble-user">${esc(O.userMsg)}</div>
        <div class="bot"><div class="bot-avatar" aria-hidden="true"></div>
          <div class="bot-body">
            <div>${esc(O.intro)}</div>
            <div data-steps>${stepsHtml()}</div>
            ${O.systemLine ? `<div class="system-line">${esc(O.systemLine)}</div>` : ''}
            ${O.tail ? `<div class="muted">${O.tail}</div>` : ''}
            ${O.extraChat}
          </div>
        </div>
      </div>
      <div class="composer">
        <div class="composer-row">
          <input class="input" type="text" aria-label="Nhập yêu cầu tiếp theo" placeholder="Nhập yêu cầu tiếp theo…">
          ${O.running ? '<button class="btn lg danger" type="button">■ Dừng</button>' : ''}
          <button class="btn lg primary" type="button">Gửi</button>
        </div>
        <div class="row small muted" style="gap:14px">
          <label class="ai-pick">AI làm việc:
            <select aria-label="Chọn AI">
              <option>Để app tự chọn (khuyên dùng)</option>
              <option>Ghim Claude</option><option>Ghim Codex</option><option>Ghim Gemini</option>
              <option>Ghim AI + model… (Nâng cao)</option>
            </select>
          </label>
          <span>Mọi thay đổi đều hoàn tác được.</span>
        </div>
      </div>`;
  }

  function previewHtml() {
    const count = PRODUCTS.reduce((a, p) => a + S.cart[p.id], 0);
    const total = PRODUCTS.reduce((a, p) => a + S.cart[p.id] * p.price, 0);
    return `
      <div class="row small muted" style="justify-content:space-between">
        <span class="row" style="gap:6px"><span class="dot" style="background:var(--bar-ok)"></span>Đang chạy thử · localhost:5173</span>
        <span class="row" style="gap:6px"><button class="btn sm">↻ Làm mới</button><button class="btn sm">Mở trong trình duyệt</button></span>
      </div>
      <div class="card" style="overflow:hidden">
        <div class="row" style="justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line)">
          <strong>Tiệm Bánh Nhỏ</strong>
          <span style="padding:3px 12px;border-radius:999px;background:#16201D;color:#FFF;font-size:12px">Giỏ hàng (${count})</span>
        </div>
        <div style="padding:22px 16px;background:#F3E3C8;font-size:18px;font-weight:600">Bánh nướng mỗi sáng</div>
        <div class="col" style="padding:16px;gap:10px">
          ${PRODUCTS.map((p) => `
            <div class="row" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px">
              <div aria-hidden="true" style="flex:none;width:44px;height:44px;border-radius:8px;background:${p.tone}"></div>
              <div style="flex:1 1 120px;min-width:0"><div style="font-size:13px;font-weight:600">${p.name}</div><div class="small muted">${vnd(p.price)}</div></div>
              ${S.cart[p.id] > 0 ? `<button class="btn sm" data-rm="${p.id}" aria-label="Bớt một" style="width:36px;padding:0">−</button><strong style="min-width:20px;text-align:center">${S.cart[p.id]}</strong>` : ''}
              <button class="btn sm primary" data-add="${p.id}">Thêm</button>
            </div>`).join('')}
          <div class="row" style="justify-content:space-between;padding:8px 4px 0;font-weight:600"><span>Tổng tiền</span><span>${vnd(total)}</span></div>
        </div>
      </div>
      <div class="small muted">Đây là bản chạy thử ngay trong app. Giỏ hàng này chỉ nằm trong bộ nhớ, tải lại trang là mất.</div>`;
  }

  function codeHtml() {
    const cur = STEPS.find((s) => s.id === S.step) || STEPS[2];
    const c = CODE[cur.id];
    const t = TONE[S.undone[cur.id] ? 'undone' : cur.status];
    const riskLabel = cur.risk ? cur.risk : c ? 'Rủi ro: ' + c.risk.toLowerCase() : 'Chưa đánh giá';
    const levels = [['summary', 'Tóm tắt'], ['diff', 'Đoạn chính'], ['full', 'Toàn bộ']];
    let body = '';
    if (!c) {
      body = '<div class="notice neutral">Bước này chưa chạy. Khi AI làm xong, phần code sẽ hiện ở đây.</div>';
    } else {
      let level = '';
      if (S.level === 'summary') {
        level = `<div class="col" style="gap:8px">${c.summary.map((x) => `<div style="padding:10px 12px;border-radius:8px;background:var(--bg)">${esc(x)}</div>`).join('')}</div>`;
      } else if (S.level === 'diff') {
        level = `
          <div class="small muted">Chỉ phần thay đổi chính · ${c.file}</div>
          <div class="code">${c.diff.map((l) => `<div class="ln ${l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : ''}"><span class="s">${l[0]}</span><span class="t">${esc(l[1])}</span></div>`).join('')}</div>
          <div class="eyebrow">Giải thích ngắn</div>
          ${c.explain.map((x) => `<div style="padding:8px 12px;border-radius:8px;background:var(--primary-soft);color:var(--primary-ink)">${esc(x)}</div>`).join('')}`;
      } else {
        level = `
          <div class="row" style="justify-content:space-between"><span class="file-tag">${c.file}</span><button class="btn sm" onclick="location.href='06-tu-sua.html'">✎ Tự sửa chữ / màu / số</button></div>
          <div class="code">${c.full.map((x, i) => `<div class="ln ${i >= 2 && i <= 7 ? 'mark' : ''}"><span class="g">${i + 1}</span><span class="t">${esc(x)}</span></div>`).join('')}</div>
          <div class="notice info small"><span class="icon">?</span><div><strong>Bạn đã bôi đen dòng 3–8.</strong> <a href="#" onclick="return false">Hỏi “đoạn này làm gì?”</a></div></div>`;
      }
      body = `
        <div class="col" style="gap:6px">
          <div class="eyebrow">File đã đổi</div>
          <div class="row" style="gap:6px">${c.files.map((f) => `<span class="pill ${CHANGE_LABEL[f[1]][1]}" style="font-weight:500"><span class="mono">${f[0]}</span> · ${CHANGE_LABEL[f[1]][0]}</span>`).join('')}</div>
        </div>
        <div class="seg" role="group" aria-label="Mức xem code">${levels.map((l) => `<button data-level="${l[0]}" aria-pressed="${S.level === l[0]}">${l[1]}</button>`).join('')}</div>
        ${level}
        <div class="dashed-box"><div class="eyebrow">Vì sao chọn cách này</div><div>${esc(c.why)}</div></div>
        ${cur.status === 'done' ? `<div class="row"><button class="btn" data-undo="${cur.id}">${S.undone[cur.id] ? 'Làm lại bước này' : '↶ Hoàn tác bước này'}</button><span class="small muted">Khôi phục file về lúc trước bước ${cur.id}.</span></div>` : ''}`;
    }
    return `
      <div class="card card-pad col">
        <div class="row" style="gap:8px 10px"><strong style="flex:1 1 200px;min-width:0">Bước ${cur.id}: ${esc(cur.text)}</strong><span class="pill ${t[1]}">${t[0]}</span></div>
        <div class="row small" style="gap:6px 10px">
          <span class="pill ${cur.risk ? 'warn' : 'ok'}">${esc(riskLabel)}</span>
          <span class="muted">${cur.ai} · ${cur.model} viết bước này</span>
        </div>
        ${body}
      </div>`;
  }

  function detailHtml() {
    const reasons = O.reasons || [
      ['Bước 2 → Codex · GPT-5.5', 'Viết danh sách nhanh, hạn mức còn nhiều.'],
      ['Bước 3 → Codex · GPT-5.5', 'Việc dài, ít rủi ro. Hạn mức ước lượng 81%, vẫn dùng được.'],
      ['Bước 4 → Claude · Opus 5.5', 'Đăng nhập là phần nhạy cảm, cần model mạnh. Gemini Pro hết hạn mức; Gemini Flash còn nhưng thuộc bậc nhanh nên bị bỏ qua.']
    ];
    const log = O.log || [
      ['20:35:12', 'Codex', 'Xong bước 2: danh sách bánh'],
      ['20:35:13', 'Điều phối', 'Hạn mức Codex ước lượng 81%'],
      ['20:38:50', 'Codex', 'Đang làm bước 3: giỏ hàng'],
      ['20:40:21', 'Gemini', 'Pro từ chối nhận việc: hết hạn mức'],
      ['20:40:22', 'Điều phối', 'Flash còn nhưng bước 4 nhạy cảm, bỏ qua'],
      ['20:40:23', 'Điều phối', 'Bước 4 chuyển sang Claude Opus 5.5'],
      ['20:41:03', 'Codex', 'Sửa cart.js: thêm 24 dòng, bớt 3 dòng']
    ];
    const lc = { 'Điều phối': 'c-app', Claude: 'c-claude', Codex: 'c-codex', Gemini: 'c-gemini' };
    return `
      <div class="term">
        <div class="eyebrow-d">VÌ SAO APP CHỌN AI VÀ MODEL NÀY</div>
        ${reasons.map((r) => `<div class="reason"><b>${r[0]}</b>${r[1]}</div>`).join('')}
        <div class="eyebrow-d">NHẬT KÝ TRỰC TIẾP</div>
        <div>${log.map((r) => `<div class="log-row"><span class="tm">${r[0]}</span><span class="who ${lc[r[1]]}">${r[1]}</span><span style="flex:1 1 0;min-width:0">${r[2]}</span></div>`).join('')}</div>
      </div>
      <div class="small muted">Mặc định thẻ này ẩn sau tab. Người mới không cần mở, người muốn xem sâu thì bấm vào.</div>`;
  }

  function sideHtml() {
    const tabs = [['preview', 'Xem trước'], ['code', 'Code của bước'], ['detail', 'Điều phối chi tiết']];
    return `
      <div class="tabs" role="tablist" aria-label="Khung bên phải">${tabs.map((t) => `<button role="tab" data-tab="${t[0]}" aria-selected="${S.tab === t[0]}">${t[1]}</button>`).join('')}</div>
      ${S.tab === 'preview' ? previewHtml() : S.tab === 'code' ? codeHtml() : detailHtml()}`;
  }

  function render() {
    const root = document.querySelector('[data-workspace]');
    if (!root) return;
    root.classList.add('workspace');
    root.innerHTML = `<main class="chat">${chatHtml()}</main><aside class="side">${sideHtml()}</aside>`;
    root.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => { S.tab = 'code'; S.step = +b.dataset.view; render(); }));
    root.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; render(); }));
    root.querySelectorAll('[data-level]').forEach((b) => (b.onclick = () => { S.level = b.dataset.level; render(); }));
    root.querySelectorAll('[data-undo]').forEach((b) => (b.onclick = () => { S.undone[b.dataset.undo] = !S.undone[b.dataset.undo]; render(); }));
    root.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => { S.cart[b.dataset.add]++; render(); }));
    root.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { S.cart[b.dataset.rm] = Math.max(0, S.cart[b.dataset.rm] - 1); render(); }));
    if (typeof window.MOCK_AFTER_RENDER === 'function') window.MOCK_AFTER_RENDER(root);
  }
  document.addEventListener('DOMContentLoaded', render);
})();

