/** LuluMusic 控制台 —— 纯 ES Module，无构建步骤。 */

const params = new URLSearchParams(location.search);
const API = (params.get('api') || localStorage.getItem('lulu_api') || 'https://api.xiaoshuai520.asia').replace(/\/$/, '');
localStorage.setItem('lulu_api', API);

const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : '—');

/* ---------------- 基础能力 ---------------- */

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' err' : '');
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 2600);
}

function modal(title, fields, onSubmit) {
  $('#modalTitle').textContent = title;
  const body = $('#modalBody');
  body.innerHTML =
    fields.map((f) => {
      if (f.type === 'textarea') {
        return `<label>${f.label}<textarea name="${f.name}" placeholder="${f.placeholder || ''}">${esc(f.value || '')}</textarea></label>`;
      }
      if (f.type === 'select') {
        const opts = f.options.map((o) => `<option value="${o.value}" ${o.value === f.value ? 'selected' : ''}>${o.label}</option>`).join('');
        return `<label>${f.label}<select name="${f.name}">${opts}</select></label>`;
      }
      return `<label>${f.label}<input name="${f.name}" value="${esc(f.value || '')}" placeholder="${f.placeholder || ''}" /></label>`;
    }).join('') +
    `<div class="modal-actions"><button class="btn" id="modalCancel">取消</button><button class="btn primary" id="modalOk">保存</button></div>`;

  $('#modal').hidden = false;
  const close = () => ($('#modal').hidden = true);
  $('#modalCancel').onclick = close;
  $('#modalClose').onclick = close;
  $('#modalOk').onclick = async () => {
    const data = {};
    new FormData(body.querySelector('form') || body).forEach?.(() => {});
    body.querySelectorAll('[name]').forEach((el) => (data[el.name] = el.value));
    try {
      await onSubmit(data);
      close();
      toast('已保存');
      render(currentView);
    } catch (e) {
      toast(e.message, true);
    }
  };
}

/* ---------------- 视图 ---------------- */

const views = {
  async dashboard() {
    const d = await api('/api/dashboard');
    const stat = (k, v) => `<div class="card stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    return `<div class="stat-grid">
      ${stat('设备总数', d.devices ?? 0)}
      ${stat('24 小时活跃', d.online24h ?? 0)}
      ${stat('待处理反馈', d.feedbackOpen ?? 0)}
      ${stat('启用公告', d.announcements ?? 0)}
      ${stat('内置音源', d.sources ?? 0)}
      ${stat('赞助人数', d.donors ?? 0)}
    </div>
    <div class="card"><div class="card-head"><h2>说明</h2></div><div class="card-body muted">
      静态清单（版本 / 音源脚本 / 赞助榜 / 角色）由 GitHub Pages 分发；本控制台管理的是需要写库的部分。
    </div></div>`;
  },

  async announcements() {
    const { announcements } = await api('/api/announcements');
    const rows = announcements.length
      ? announcements.map((a) => `<tr>
          <td>${esc(a.title)}</td>
          <td class="muted">${esc((a.body || '').slice(0, 40))}${(a.body || '').length > 40 ? '…' : ''}</td>
          <td>${a.enabled ? '<span class="badge ok">启用</span>' : '<span class="badge off">停用</span>'}</td>
          <td>${a.force ? '<span class="badge warn">强制</span>' : '—'}</td>
          <td class="muted">${fmtTime(a.updated_at)}</td>
          <td class="actions">
            <button class="btn sm" data-edit="${a.id}">编辑</button>
            <button class="btn sm" data-toggle="${a.id}">${a.enabled ? '停用' : '启用'}</button>
          </td></tr>`).join('')
      : `<tr><td colspan="6" class="empty">暂无公告</td></tr>`;
    return `<div class="card">
      <div class="card-head"><h2>公告</h2><button class="btn primary sm" id="newAnn">新建公告</button></div>
      <table><thead><tr><th>标题</th><th>内容</th><th>状态</th><th>强制</th><th>更新时间</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  },

  async donors() {
    const { donors } = await api('/api/donors');
    const rows = donors.length
      ? donors.map((d) => `<tr><td>${esc(d.name)}</td><td>¥ ${Number(d.amount).toFixed(2)}</td>
          <td class="muted">${esc(d.message || '—')}</td><td class="muted">${esc(d.date || '')}</td></tr>`).join('')
      : `<tr><td colspan="4" class="empty">暂无赞助记录</td></tr>`;
    return `<div class="card">
      <div class="card-head"><h2>赞助榜</h2><button class="btn primary sm" id="newDonor">添加记录</button></div>
      <table><thead><tr><th>昵称</th><th>金额</th><th>留言</th><th>日期</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="card-body muted">写入数据库后，记得同步更新 Pages 上的 <code>donors.json</code>，App 端读的是静态清单。</div></div>`;
  },

  async devices() {
    const { devices } = await api('/api/devices');
    const rows = devices.length
      ? devices.map((d) => `<tr>
          <td><code>${esc(d.deviceId).slice(0, 12)}…</code></td>
          <td>${esc(d.userId || '—')}</td>
          <td>${esc(d.role || 'user')}</td>
          <td class="muted">${esc([d.model, d.os].filter(Boolean).join(' / ') || '—')}</td>
          <td class="muted">${esc(d.appVersion || '—')}</td>
          <td class="muted">${fmtTime(d.lastHeartbeat)}</td>
          <td>${esc(d.note || '—')}</td>
          <td class="actions"><button class="btn sm" data-dev="${esc(d.deviceId)}">备注</button></td>
        </tr>`).join('')
      : `<tr><td colspan="8" class="empty">暂无设备</td></tr>`;
    return `<div class="card">
      <div class="card-head"><h2>设备（最近 ${devices.length} 台）</h2></div>
      <table><thead><tr><th>设备</th><th>用户</th><th>角色</th><th>机型</th><th>版本</th><th>心跳</th><th>备注</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  },

  async feedback() {
    const { feedback } = await api('/api/feedback');
    const rows = feedback.length
      ? feedback.map((f) => `<tr>
          <td>${esc(f.body || '').slice(0, 60)}</td>
          <td class="muted">${esc(f.contact || '—')}</td>
          <td class="muted">${esc(f.app_version || '—')}</td>
          <td>${f.status === 'resolved' ? '<span class="badge ok">已处理</span>' : '<span class="badge warn">待处理</span>'}</td>
          <td class="muted">${fmtTime(f.created_at)}</td>
          <td class="actions">${f.status === 'resolved' ? '' : `<button class="btn sm" data-resolve="${f.id}">标记已处理</button>`}</td>
        </tr>`).join('')
      : `<tr><td colspan="6" class="empty">暂无反馈</td></tr>`;
    return `<div class="card">
      <div class="card-head"><h2>用户反馈</h2></div>
      <table><thead><tr><th>内容</th><th>联系方式</th><th>版本</th><th>状态</th><th>提交时间</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  },

  async audit() {
    const { audit } = await api('/api/audit');
    const rows = audit.length
      ? audit.map((a) => `<tr><td class="muted">${fmtTime(a.created_at)}</td><td>${esc(a.actor)}</td>
          <td><code>${esc(a.action)}</code></td><td class="muted">${esc(a.detail || '—')}</td>
          <td class="muted">${esc(a.ip || '—')}</td></tr>`).join('')
      : `<tr><td colspan="5" class="empty">暂无记录</td></tr>`;
    return `<div class="card"><div class="card-head"><h2>审计日志（最近 200 条）</h2></div>
      <table><thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>详情</th><th>IP</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  },

  async settings() {
    const { config } = await api('/api/config');
    const rows = config.length
      ? config.map((c) => `<tr><td><code>${esc(c.key)}</code></td><td class="muted">${esc(String(c.value).slice(0, 60))}</td>
          <td class="muted">${fmtTime(c.updated_at)}</td></tr>`).join('')
      : `<tr><td colspan="3" class="empty">暂无配置项</td></tr>`;
    return `<div class="card"><div class="card-head"><h2>管理员口令</h2>
        <button class="btn primary sm" id="chPwd">修改口令</button></div>
      <div class="card-body muted">口令保存在数据库（优先于环境变量），改完立即生效，旧会话不受影响。</div></div>
      <div class="card"><div class="card-head"><h2>运行时配置</h2>
        <button class="btn sm" id="addCfg">新增配置</button></div>
      <table><thead><tr><th>键</th><th>值</th><th>更新时间</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  },

  async sources() {
    const { sources } = await api('/api/sources');
    const rows = sources.length
      ? sources.map((s) => `<tr><td>${esc(s.name || s.id)}</td><td>${esc(s.version)}</td>
          <td class="muted"><code>${esc(s.file || '—')}</code></td>
          <td class="muted">${s.size ? (s.size / 1024).toFixed(0) + ' KB' : '—'}</td>
          <td class="muted">${fmtTime(s.updatedAt)}</td>
          <td class="actions"><button class="btn sm" data-vers="${esc(s.id)}">版本</button></td></tr>`).join('')
      : `<tr><td colspan="6" class="empty">暂无音源</td></tr>`;
    return `<div class="card">
      <div class="card-head"><h2>内置音源</h2><button class="btn primary sm" id="pubSrc">发布 / 更新</button></div>
      <table><thead><tr><th>名称</th><th>版本</th><th>文件</th><th>大小</th><th>更新时间</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <div class="card-body muted">发布 = 写入 GitHub Pages（脚本 + sources.json），App 下次启动拉清单后热更新；回滚可切回任一历史版本。</div></div>`;
  },
};

/* ---------------- 交互绑定 ---------------- */

const titles = { dashboard: '概览', announcements: '公告', donors: '赞助榜', devices: '设备', feedback: '反馈', sources: '音源', audit: '审计', settings: '设置' };
let currentView = 'dashboard';

async function render(view) {
  currentView = view;
  $('#title').textContent = titles[view] || view;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  $('#view').innerHTML = '<div class="card"><div class="card-body muted">加载中…</div></div>';
  try {
    $('#view').innerHTML = await views[view]();
    bind(view);
  } catch (e) {
    $('#view').innerHTML = `<div class="card"><div class="card-body muted">加载失败：${esc(e.message)}</div></div>`;
    if (/未登录|401/.test(e.message)) showLogin();
  }
}

function bind(view) {
  const root = $('#view');

  root.querySelector('#newAnn')?.addEventListener('click', () =>
    modal('新建公告', [
      { name: 'title', label: '标题' },
      { name: 'body', label: '内容', type: 'textarea' },
      { name: 'frequency', label: '频率', type: 'select', value: 'once', options: [
        { value: 'once', label: '仅一次' }, { value: '每次启动', label: '每次启动' }, { value: 'daily', label: '每天一次' }] },
      { name: 'button_text', label: '按钮文案（可选）' },
      { name: 'button_url', label: '按钮链接（可选）' },
    ], (data) => api('/api/announcements', { method: 'POST', body: { ...data, enabled: true } })));

  root.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const { announcements } = await api('/api/announcements');
      const a = announcements.find((x) => String(x.id) === btn.dataset.edit);
      modal('编辑公告', [
        { name: 'title', label: '标题', value: a.title },
        { name: 'body', label: '内容', type: 'textarea', value: a.body },
        { name: 'button_text', label: '按钮文案', value: a.button_text },
        { name: 'button_url', label: '按钮链接', value: a.button_url },
      ], (data) => api('/api/announcements', { method: 'POST', body: { ...data, id: a.id, enabled: !!a.enabled, force: !!a.force } }));
    }));

  root.querySelectorAll('[data-toggle]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      try {
        await api(`/api/announcements/${btn.dataset.toggle}/toggle`, { method: 'POST' });
        toast('状态已切换');
        render(view);
      } catch (e) { toast(e.message, true); }
    }));

  root.querySelector('#newDonor')?.addEventListener('click', () =>
    modal('添加赞助记录', [
      { name: 'name', label: '昵称' },
      { name: 'amount', label: '金额（元）' },
      { name: 'message', label: '留言（可选）', type: 'textarea' },
      { name: 'date', label: '日期（YYYY-MM-DD，可选）' },
    ], (data) => api('/api/donors', { method: 'POST', body: data })));

  root.querySelectorAll('[data-dev]').forEach((btn) =>
    btn.addEventListener('click', () =>
      modal('设备备注', [
        { name: 'note', label: '备注' },
        { name: 'role', label: '角色', type: 'select', value: 'user', options: [
          { value: 'user', label: '普通用户' }, { value: 'sponsor', label: '赞助用户' }, { value: 'dev', label: '开发者' }] },
      ], (data) => api(`/api/devices/${encodeURIComponent(btn.dataset.dev)}`, { method: 'POST', body: data }))));

  root.querySelector('#pubSrc')?.addEventListener('click', () =>
    modal('发布音源', [
      { name: 'id', label: '音源 ID（如 lulu.bundled.ynx.v1_2_5）' },
      { name: 'name', label: '显示名称' },
      { name: 'version', label: '版本号（如 1.5.3）' },
      { name: 'code', label: '脚本内容（整段粘贴）', type: 'textarea' },
    ], async (data) => {
      const check = await api('/api/sources/check', { method: 'POST', body: { code: data.code } });
      if (!check.ok) throw new Error('校验未通过：' + check.problems.join('；'));
      await api('/api/sources/publish', { method: 'POST', body: data });
    }));

  root.querySelectorAll('[data-vers]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const { versions } = await api(`/api/sources/${encodeURIComponent(btn.dataset.vers)}/versions`);
      modal(`版本历史 · ${btn.dataset.vers}`, [{ name: '_', label: '选择要回滚的版本（填版本号）' }],
        (data) => api(`/api/sources/${encodeURIComponent(btn.dataset.vers)}/rollback`, { method: 'POST', body: { version: data._ } }));
      const list = versions.length
        ? versions.map((v) => `<div class="muted" style="padding:4px 0">v${esc(v.version)} · ${esc(v.file)} · ${fmtTime(v.created_at)}</div>`).join('')
        : '<div class="muted">暂无历史</div>';
      document.querySelector('#modalBody').insertAdjacentHTML('afterbegin', `<div>${list}</div>`);
    }));

  root.querySelector('#chPwd')?.addEventListener('click', () =>
    modal('修改口令', [{ name: 'password', label: '新口令（至少 8 位）' }],
      (data) => api('/api/password', { method: 'POST', body: data })));

  root.querySelector('#addCfg')?.addEventListener('click', () =>
    modal('新增配置', [{ name: 'key', label: '键' }, { name: 'value', label: '值', type: 'textarea' }],
      (data) => api('/api/config', { method: 'POST', body: data })));

  root.querySelectorAll('[data-resolve]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      try {
        await api(`/api/feedback/${btn.dataset.resolve}/resolve`, { method: 'POST' });
        toast('已标记处理');
        render(view);
      } catch (e) { toast(e.message, true); }
    }));
}

/* ---------------- 登录 / 启动 ---------------- */

function showLogin() {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#password').focus();
}

function showApp(username) {
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#who').textContent = username || 'admin';
  render('dashboard');
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginHint').textContent = '';
  try {
    const r = await api('/api/login', {
      method: 'POST',
      body: { username: $('#username').value.trim(), password: $('#password').value },
    });
    showApp(r.username);
  } catch (err) {
    $('#loginHint').textContent = err.message === 'Failed to fetch' ? `接口不可达：${API}` : err.message;
  }
});

$('#logout').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  showLogin();
});

$('#nav').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-view]');
  if (a) render(a.dataset.view);
});

$('#refresh').addEventListener('click', () => render(currentView));

(async () => {
  try {
    const me = await api('/api/me');
    showApp(me.username);
  } catch {
    showLogin();
  }
})();
