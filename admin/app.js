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

function modalShell(title, html, onMount) {
  $('#modalTitle').textContent = title;
  const body = $('#modalBody');
  body.innerHTML = html;
  $('#modal').hidden = false;
  const close = () => ($('#modal').hidden = true);
  $('#modalClose').onclick = close;
  if (onMount) onMount(body, close);
  return close;
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
    const groups = [
      { key: 'all', label: '全部' },
      { key: 'user', label: '普通用户' },
      { key: 'sponsor', label: '赞助用户' },
      { key: 'dev', label: '开发者' },
    ];
    const counts = Object.fromEntries(groups.map((g) => [g.key,
      g.key === 'all' ? devices.length : devices.filter((d) => (d.role || 'user') === g.key).length]));
    const active = state.deviceGroup || 'all';

    const rows = devices
      .filter((d) => active === 'all' || (d.role || 'user') === active)
      .map((d) => `<tr>
          <td data-label="设备"><code>${esc(d.deviceId).slice(0, 12)}…</code></td>
          <td data-label="用户">${esc(d.userId || '—')}</td>
          <td data-label="分类"><span class="badge ${d.role === 'dev' ? 'warn' : d.role === 'sponsor' ? 'ok' : 'off'}">${esc(d.role || 'user')}</span></td>
          <td data-label="机型" class="muted">${esc([d.model, d.os].filter(Boolean).join(' / ') || '—')}</td>
          <td data-label="版本" class="muted">${esc(d.appVersion || '—')}</td>
          <td data-label="最近登录" class="muted">${fmtTime(d.lastHeartbeat)}</td>
          <td data-label="备注">${esc(d.note || '—')}</td>
          <td class="actions"><button class="btn sm" data-dev="${esc(d.deviceId)}" data-role="${esc(d.role || 'user')}" data-note="${esc(d.note || '')}">编辑</button></td>
        </tr>`).join('');

    return `<div class="card">
      <div class="card-head"><h2>设备（${counts.all} 台）</h2>
        <div class="tabs">${groups.map((g) => `<button class="tab ${active === g.key ? 'on' : ''}" data-group="${g.key}">${g.label} ${counts[g.key]}</button>`).join('')}</div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>设备</th><th>用户</th><th>分类</th><th>机型</th><th>版本</th><th>最近登录</th><th>备注</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="8" class="empty">该分类下暂无设备</td></tr>`}</tbody></table></div></div>`;
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
      ? sources.map((s) => `<tr>
          <td data-label="名称">${esc(s.name || s.id)}<div class="sub muted">${esc(s.id)}</div></td>
          <td data-label="版本">${esc(s.version)}</td>
          <td data-label="大小" class="muted">${s.size ? (s.size / 1024).toFixed(0) + ' KB' : '—'}</td>
          <td data-label="更新时间" class="muted">${fmtTime(s.updatedAt)}</td>
          <td class="actions">
            <button class="btn sm" data-update="${esc(s.id)}" data-name="${esc(s.name || '')}" data-version="${esc(s.version || '')}">更新</button>
            <button class="btn sm" data-vers="${esc(s.id)}" data-name="${esc(s.name || '')}">回滚</button>
          </td></tr>`).join('')
      : `<tr><td colspan="5" class="empty">暂无音源</td></tr>`;
    return `<div class="card">
      <div class="card-head"><h2>内置音源</h2><button class="btn primary sm" id="pubSrc">新增音源</button></div>
      <div class="table-wrap"><table><thead><tr><th>名称</th><th>版本</th><th>大小</th><th>更新时间</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <div class="card-body muted">「更新」= 只改这一个音源并提升版本；「回滚」= 从历史版本里挑一个切回去。App 下次启动拉清单后热更新（最长 5 分钟）。</div></div>`;
  },
};

/* ---------------- 交互绑定 ---------------- */

/** 公告里可选的「App 直达链接」：选中后自动联动按钮文案。 */
const ANNOUNCEMENT_LINKS = [
  { value: '', label: '不添加按钮', text: '' },
  { value: 'https://api.xiaoshuai520.asia/latest', label: '下载最新版本', text: '立即更新' },
  { value: 'https://api.xiaoshuai520.asia/latest-beta', label: '下载测试版', text: '体验测试版' },
  { value: 'https://caz0203.github.io/lulu-music-site/sources.json', label: '内置音源清单', text: '查看音源' },
  { value: 'https://github.com/caz0203/lulu-music-site/releases', label: '全部历史版本', text: '查看历史版本' },
  { value: '__custom__', label: '自定义链接…', text: '' },
];

function openAnnouncementModal(a = null) {
  const isEdit = !!a;
  const html = `
    <label>标题<input id="aTitle" value="${esc(a?.title || '')}" /></label>
    <label>内容<textarea id="aBody">${esc(a?.body || '')}</textarea></label>
    <label>展示频率<select id="aFreq">
      ${[['once', '仅一次'], ['每次启动', '每次启动'], ['daily', '每天一次']]
        .map(([v, l]) => `<option value="${v}" ${a?.frequency === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select></label>
    <label>按钮链接<select id="aLink">
      ${ANNOUNCEMENT_LINKS.map((l) => `<option value="${l.value}" ${a?.button_url === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
    </select></label>
    <label id="aUrlWrap" hidden>自定义链接<input id="aUrl" value="${esc(a?.button_url || '')}" placeholder="https://" /></label>
    <label>按钮文案<input id="aText" value="${esc(a?.button_text || '')}" placeholder="选择链接后自动填充" /></label>
    <div class="modal-actions"><button class="btn" id="aCancel">取消</button><button class="btn primary" id="aOk">保存</button></div>`;

  modalShell(isEdit ? '编辑公告' : '新建公告', html, (body, close) => {
    const link = body.querySelector('#aLink');
    const urlWrap = body.querySelector('#aUrlWrap');
    const url = body.querySelector('#aUrl');
    const text = body.querySelector('#aText');

    const sync = () => {
      const preset = ANNOUNCEMENT_LINKS.find((l) => l.value === link.value);
      if (link.value === '__custom__') {
        urlWrap.hidden = false;
        return;
      }
      urlWrap.hidden = true;
      url.value = link.value;
      if (preset && preset.text) text.value = preset.text; // 链接名字 → 按钮文案
    };
    link.onchange = sync;

    body.querySelector('#aCancel').onclick = close;
    body.querySelector('#aOk').onclick = async () => {
      const payload = {
        title: body.querySelector('#aTitle').value.trim(),
        body: body.querySelector('#aBody').value.trim(),
        frequency: body.querySelector('#aFreq').value,
        button_url: link.value === '__custom__' ? url.value.trim() : link.value,
        button_text: text.value.trim(),
        enabled: true,
        ...(isEdit ? { id: a.id, force: !!a.force } : {}),
      };
      if (!payload.title) return toast('标题必填', true);
      try {
        await api('/api/announcements', { method: 'POST', body: payload });
        toast('已保存');
        close();
        render('announcements');
      } catch (e) { toast(e.message, true); }
    };
  });
}

/**
 * 音源发布 / 更新弹窗。
 *
 * 支持三种录入方式，对应原服务器的「上传脚本」体验：
 *  1. 选择文件（`<input type=file>`，读入文本）；
 *  2. 拖拽文件到虚线框；
 *  3. 直接粘贴脚本正文。
 *
 * 选中文件后会**自动识别** id / 名称 / 版本：
 *  - 文件名形如 `lulu.bundled.ynx.v1_2_5-1.5.2.js` → id=`lulu.bundled.ynx.v1_2_5`，版本=`1.5.2`；
 *  - 文件名只有一个版本号 `xxx-1.2.3.js` → 版本取最后一段；
 *  - 识别不出就留空，由用户手填。
 */
function openSourceModal({ id = '', name = '', version = '', lockId = false } = {}) {
  const html = `
    <div class="dropzone" id="drop">
      <div><strong>选择或拖入脚本文件</strong></div>
      <div class="sub muted">.js / .txt，最大 512KB；选中后自动识别 ID 与版本</div>
      <input type="file" id="file" accept=".js,.txt,text/javascript" hidden />
      <button class="btn sm" type="button" id="pick" style="margin-top:8px">选择文件</button>
      <div class="sub" id="fileInfo"></div>
    </div>
    <label>音源 ID<input id="sId" value="${esc(id)}" ${lockId ? 'readonly' : ''} placeholder="lulu.bundled.xxx.v1_0_0" /></label>
    <label>显示名称<input id="sName" value="${esc(name)}" /></label>
    <label>版本号<input id="sVer" value="${esc(version)}" placeholder="1.5.3" /></label>
    <label>脚本内容<textarea id="sCode" style="min-height:150px" placeholder="粘贴或导入脚本正文"></textarea></label>
    <div class="modal-actions"><button class="btn" id="sCancel">取消</button><button class="btn primary" id="sOk">校验并发布</button></div>`;

  modalShell(id ? '更新音源' : '新增音源', html, (body, close) => {
    const file = body.querySelector('#file');
    const info = body.querySelector('#fileInfo');
    const code = body.querySelector('#sCode');

    const accept = async (f) => {
      if (!f) return;
      if (f.size > 512 * 1024) return toast('文件超过 512KB', true);
      const text = await f.text();
      code.value = text;
      const base = f.name.replace(/\.(js|txt)$/i, '');
      // 版本号：文件名末尾的 x.y[.z]
      const vm = base.match(/(\d+(?:\.\d+){1,3})$/);
      // 音源 ID：去掉末尾版本段后的主体
      const idPart = vm ? base.slice(0, base.length - vm[0].length).replace(/[-_.]+$/, '') : base;
      if (idPart && !body.querySelector('#sId').value) body.querySelector('#sId').value = idPart;
      if (vm && !body.querySelector('#sVer').value) body.querySelector('#sVer').value = vm[1];
      if (!body.querySelector('#sName').value) body.querySelector('#sName').value = idPart || base;
      info.textContent = `${f.name} · ${(f.size / 1024).toFixed(1)} KB · 已读入`;
      toast('脚本已导入');
    };

    body.querySelector('#pick').onclick = () => file.click();
    file.onchange = () => accept(file.files?.[0]);

    const drop = body.querySelector('#drop');
    drop.addEventListener('click', (e) => { if (e.target === drop) file.click(); });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('on'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('on'); }));
    drop.addEventListener('drop', (e) => accept(e.dataTransfer?.files?.[0]));

    body.querySelector('#sCancel').onclick = close;
    body.querySelector('#sOk').onclick = async () => {
      const payload = {
        id: body.querySelector('#sId').value.trim(),
        name: body.querySelector('#sName').value.trim() || body.querySelector('#sId').value.trim(),
        version: body.querySelector('#sVer').value.trim(),
        code: code.value,
      };
      if (!payload.id || !payload.version || !payload.code) return toast('ID、版本、脚本内容都要填', true);
      const btn = body.querySelector('#sOk');
      btn.disabled = true; btn.textContent = '校验中…';
      try {
        const check = await api('/api/sources/check', { method: 'POST', body: { code: payload.code } });
        if (!check.ok) throw new Error('校验未通过：' + check.problems.join('；'));
        btn.textContent = '发布中…';
        await api('/api/sources/publish', { method: 'POST', body: payload });
        toast(`已发布 ${payload.id} v${payload.version}（App 最长 5 分钟生效）`);
        close();
        render('sources');
      } catch (e) {
        toast(e.message, true);
        btn.disabled = false; btn.textContent = '校验并发布';
      }
    };
  });
}

const titles = { dashboard: '概览', announcements: '公告', donors: '赞助榜', devices: '设备', feedback: '反馈', sources: '音源', audit: '审计', settings: '设置' };
let currentView = 'dashboard';
const state = { deviceGroup: 'all' };

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

  root.querySelector('#newAnn')?.addEventListener('click', () => openAnnouncementModal());

  root.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const { announcements } = await api('/api/announcements');
      const a = announcements.find((x) => String(x.id) === btn.dataset.edit);
      openAnnouncementModal(a);
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
      modal('设备分类与备注', [
        { name: 'role', label: '分类', type: 'select', value: btn.dataset.role, options: [
          { value: 'user', label: '普通用户' }, { value: 'sponsor', label: '赞助用户' }, { value: 'dev', label: '开发者' }] },
        { name: 'note', label: '备注', type: 'textarea', value: btn.dataset.note },
      ], (data) => api(`/api/devices/${encodeURIComponent(btn.dataset.dev)}`, { method: 'POST', body: data }))));

  root.querySelectorAll('[data-group]').forEach((tab) =>
    tab.addEventListener('click', () => { state.deviceGroup = tab.dataset.group; render('devices'); }));

  root.querySelector('#pubSrc')?.addEventListener('click', () => openSourceModal({}));

  root.querySelectorAll('[data-update]').forEach((btn) =>
    btn.addEventListener('click', () => openSourceModal({
      id: btn.dataset.update, name: btn.dataset.name, version: '', lockId: true,
    })));

  root.querySelectorAll('[data-vers]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const id = btn.dataset.vers;
      let versions = [];
      try {
        versions = (await api(`/api/sources/${encodeURIComponent(id)}/versions`)).versions || [];
      } catch (e) {
        toast(e.message, true);
        return;
      }
      const current = btn.closest('tr')?.querySelector('[data-label="版本"]')?.textContent?.trim();
      const list = versions.length
        ? versions.map((v) => {
            const isCurrent = current && v.version === current;
            return `<div class="ver-row">
              <div><strong>v${esc(v.version)}</strong><div class="sub muted">${esc(v.file)} · ${fmtTime(v.created_at)} · ${(v.size / 1024).toFixed(0)} KB</div></div>
              ${isCurrent
                ? '<span class="badge ok">当前</span>'
                : `<button class="btn sm" data-rb="${esc(v.version)}">回滚到此版本</button>`}
            </div>`;
          }).join('')
        : '<div class="empty">该音源还没有历史版本</div>';

      modalShell(`回滚 · ${btn.dataset.name || id}`, `<div class="ver-list">${list}</div>`, (body, close) => {
        body.querySelectorAll('[data-rb]').forEach((rb) =>
          rb.addEventListener('click', async () => {
            rb.disabled = true;
            rb.textContent = '回滚中…';
            try {
              await api(`/api/sources/${encodeURIComponent(id)}/rollback`, { method: 'POST', body: { version: rb.dataset.rb } });
              toast(`已回滚到 v${rb.dataset.rb}`);
              close();
              render('sources');
            } catch (e) {
              toast(e.message, true);
              rb.disabled = false;
              rb.textContent = '回滚到此版本';
            }
          }));
      });
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
