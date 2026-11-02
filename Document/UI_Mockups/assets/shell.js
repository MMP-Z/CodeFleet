/* =========================================================
   shell.js — phần dùng chung cho mọi màn hình mockup:
   - Thanh điều hướng mockup (trước/sau, về danh sách)
   - Header app: logo, dự án, chip hạn mức + bảng chi tiết
   Dữ liệu là MINH HOẠ, tên model chỉ để minh hoạ (mục 6.9).
   ========================================================= */
(function () {
  const SCREENS = [
    ['01-khoi-dong.html', 'Khởi động lần đầu'],
    ['02-chon-du-an.html', 'Chọn / tạo dự án'],
    ['03-man-hinh-chinh.html', 'Màn hình chính (chat + 3 tab)'],
    ['04-xin-phep.html', 'Xin phép hành động rủi ro'],
    ['05-xung-dot.html', 'Xung đột với phần bạn tự sửa'],
    ['06-tu-sua.html', 'Tự sửa trực tiếp'],
    ['07-het-han-muc.html', 'Hết hạn mức / chuyển AI'],
    ['08-han-muc.html', 'Chi tiết hạn mức'],
    ['09-nhat-ky.html', 'Lịch sử, nhật ký quyết định, bản đồ dự án'],
    ['10-plugin.html', 'Plugin'],
    ['11-cai-dat.html', 'Cài đặt'],
    ['12-trang-thai-loi.html', 'Lỗi và trạng thái trống']
  ];
  window.MOCK_SCREENS = SCREENS;

  /* ---------- Dữ liệu hạn mức mặc định (giống mẫu C) ---------- */
  const DEFAULT_QUOTA = {
    Claude: {
      cls: 'claude', state: '', text: '62%',
      sourceLabel: 'Số liệu từ CLI (chính thức)', sourceCls: 'ok',
      windows: [
        { label: '5 giờ', p: 62, reset: 'Làm mới lúc 22:40' },
        { label: 'Tuần', p: 38, reset: 'Làm mới Thứ Hai' }
      ],
      scope: 'Dùng chung cho mọi model của Claude. Model mạnh tốn hạn mức nhanh hơn.',
      note: 'Dưới 80% nên app vẫn ưu tiên dùng bình thường.'
    },
    Codex: {
      cls: 'codex', state: 'low', text: '81% · ước lượng',
      sourceLabel: 'Ước lượng từ log trên máy bạn', sourceCls: 'warn',
      windows: [
        { label: '5 giờ', p: 81, reset: 'Làm mới khoảng 23:15' },
        { label: 'Tuần', p: 54, reset: 'Làm mới Thứ Hai' }
      ],
      scope: 'Chưa rõ có tách theo model hay không, app tạm coi là dùng chung.',
      note: 'CLI này chưa cho số liệu chính thức nên con số có thể lệch. Từ 80% trở lên app giảm ưu tiên.'
    },
    Gemini: {
      cls: 'gemini', state: 'low', text: 'Pro hết · Flash 23%',
      sourceLabel: 'Pro: đã phát hiện · Flash: ước lượng', sourceCls: 'warn',
      windows: [
        { label: 'Pro · ngày', p: 100, reset: 'Làm mới lúc 00:00 (đã phát hiện)' },
        { label: 'Flash · ngày', p: 23, reset: 'Làm mới lúc 00:00 (ước lượng)' }
      ],
      scope: 'Tính riêng từng model: Pro hết, Flash còn.',
      note: 'Bước 4 là phần đăng nhập nhạy cảm nên app không hạ xuống Flash mà chuyển sang Claude Opus 5.5.'
    }
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const barCls = (p) => (p >= 100 ? 'out' : p >= 80 ? 'low' : '');
  window.mockEsc = esc;
  window.mockBarCls = barCls;

  function renderMockNav() {
    const file = location.pathname.split('/').pop() || 'index.html';
    const i = SCREENS.findIndex((s) => s[0] === file);
    const nav = document.createElement('div');
    nav.className = 'mock-nav';
    const prev = i > 0 ? `<a href="${SCREENS[i - 1][0]}">← ${esc(SCREENS[i - 1][1])}</a>` : '';
    const next = i >= 0 && i < SCREENS.length - 1 ? `<a href="${SCREENS[i + 1][0]}">${esc(SCREENS[i + 1][1])} →</a>` : '';
    nav.innerHTML = `
      <a href="index.html">☰ Danh sách màn hình</a>
      <span>Mockup ${i >= 0 ? String(i + 1).padStart(2, '0') + '/' + SCREENS.length : ''}</span>
      <span class="title">${i >= 0 ? esc(SCREENS[i][1]) : ''}</span>
      <span class="grow"></span>${prev}${next}`;
    document.body.prepend(nav);
  }

  function renderHeader(el) {
    const quota = Object.assign({}, DEFAULT_QUOTA, window.MOCK_QUOTA || {});
    const project = el.dataset.project ?? 'Tiệm Bánh Nhỏ · Documents/tiem-banh';
    const active = el.dataset.active || '';
    const hideQuota = el.dataset.noQuota === 'true';
    const tools = [
      ['03-man-hinh-chinh.html', 'chat', 'Chat'],
      ['09-nhat-ky.html', 'log', 'Lịch sử'],
      ['10-plugin.html', 'plugin', 'Plugin'],
      ['11-cai-dat.html', 'settings', 'Cài đặt']
    ];
    el.classList.add('app-header');
    el.innerHTML = `
      <div class="logo"><div class="logo-mark" aria-hidden="true"></div><strong>CodeFleet</strong></div>
      ${project ? `<a class="project-pill" href="02-chon-du-an.html" style="text-decoration:none" title="Đổi dự án">${esc(project)} ▾</a>` : ''}
      <span class="demo-badge">Dữ liệu minh hoạ</span>
      <nav class="header-tools" aria-label="Điều hướng app">
        ${tools.map((t) => `<a class="icon-btn" style="text-decoration:none" href="${t[0]}" ${active === t[1] ? 'aria-current="page"' : ''}>${t[2]}</a>`).join('')}
      </nav>
      <div class="grow"></div>
      ${hideQuota ? '' : `
      <div class="quota-bar">
        <span class="small muted">Hạn mức:</span>
        ${Object.keys(quota).map((n) => `
          <button class="quota-chip ${quota[n].state}" data-q="${n}" aria-expanded="false">
            <span class="dot ${quota[n].cls}" aria-hidden="true"></span><span>${n}</span><strong>${esc(quota[n].text)}</strong>
          </button>`).join('')}
      </div>
      <div class="popover hidden" role="dialog" aria-label="Chi tiết hạn mức"></div>`}`;

    if (hideQuota) return;
    const pop = el.querySelector('.popover');
    let open = null;
    function show(name) {
      el.querySelectorAll('.quota-chip').forEach((b) => b.setAttribute('aria-expanded', b.dataset.q === name ? 'true' : 'false'));
      if (!name) { pop.classList.add('hidden'); open = null; return; }
      const q = quota[name];
      open = name;
      pop.innerHTML = `
        <div class="row"><span class="dot lg ${q.cls}" aria-hidden="true"></span><strong style="font-size:15px">${name}</strong>
          <button class="btn sm" style="margin-left:auto" data-close>Đóng</button></div>
        <span class="pill ${q.sourceCls}" style="align-self:flex-start">${esc(q.sourceLabel)}</span>
        <div class="small" style="font-weight:600">${esc(q.scope)}</div>
        ${q.windows.map((w) => `
          <div>
            <div class="row" style="justify-content:space-between;font-size:13px"><span>${esc(w.label)}</span><strong>${w.p == null ? 'không rõ' : w.p + '%'}</strong></div>
            <div class="progress" style="margin:4px 0"><div class="${barCls(w.p || 0)}" style="width:${w.p || 0}%"></div></div>
            <div class="small muted">${esc(w.reset)}</div>
          </div>`).join('')}
        <div class="small muted">${esc(q.note)}</div>
        <div class="row small muted" style="justify-content:space-between">
          <span>Cập nhật lúc 20:41</span><a href="08-han-muc.html">Xem tất cả →</a>
        </div>`;
      pop.classList.remove('hidden');
      pop.querySelector('[data-close]').onclick = () => show(null);
    }
    el.querySelectorAll('.quota-chip').forEach((b) => (b.onclick = () => show(open === b.dataset.q ? null : b.dataset.q)));
    if (el.dataset.openQuota) show(el.dataset.openQuota);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderMockNav();
    document.querySelectorAll('[data-app-header]').forEach(renderHeader);
  });
})();

