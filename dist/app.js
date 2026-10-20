import { STORAGE_KEY, blankResume, sampleResume, normalizeResume, normalizeModules, toMarkdown, analyzeMatch, applyDraft, moveModule } from './resume.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const id = () => globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let resume;
let demoMode = false;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved?.resume) { resume = normalizeResume(saved.resume); demoMode = Boolean(saved.demoMode); }
} catch { /* invalid old save: start with the example */ }
if (!resume) { resume = sampleResume(); demoMode = true; }
let activeTab = 'profile';
let aiReady = false;
let notes = '';
let proposal = null;
let toastTimer;

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.add('hidden'), 4200);
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ resume, demoMode }));
    $('#save-status').textContent = '已在浏览器本地保存';
  } catch { $('#save-status').textContent = '浏览器无法本地保存'; }
}

function update() { persist(); renderPreview(); renderInsights(); }

function field(label, value, attr, placeholder = '', wide = false, rows = 0, hint = '') {
  const control = rows
    ? `<textarea ${attr} aria-label="${esc(label)}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
    : `<input ${attr} aria-label="${esc(label)}" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
  return `<div class="field ${wide ? 'wide' : ''}"><label>${label}</label>${control}${hint ? `<small>${hint}</small>` : ''}</div>`;
}

function heading(kicker, title, copy) {
  return `<div class="section-kicker"><span>${kicker}</span><span>PROOFCV / EDITOR</span></div><h3 class="section-title">${title}</h3><p class="section-copy">${copy}</p>`;
}

function renderProfile() {
  const p = resume.personal;
  return heading('01 / THE BASICS', '先让人认识你。', '联系方式和个人定位，会出现在简历最显眼的位置。') +
    `<div class="form-grid">${field('姓名', p.name, 'data-field="personal.name"', '你的姓名')}${field('求职定位', p.title, 'data-field="personal.title"', '例如：产品经理')}${field('邮箱', p.email, 'data-field="personal.email"', 'you@example.com')}${field('电话', p.phone, 'data-field="personal.phone"', '联系电话')}${field('所在城市', p.city, 'data-field="personal.city"', '例如：上海')}${field('作品 / 个人链接', p.link, 'data-field="personal.link"', 'github.com/you')}
    </div><div class="divider"></div><div class="form-grid">${field('个人简介', resume.summary, 'data-field="summary"', '用 2–3 句话说清你的领域、经验和擅长解决的问题。', true, 5, '具体、可核实，比形容词更有说服力。')}</div>`;
}

function renderBullets(section, index, bullets) {
  return `<div class="bullet-list"><div class="bullet-top"><span>工作要点 / 成果</span><button class="mini-add" data-action="add-bullet" data-section="${section}" data-index="${index}">＋ 增加一条</button></div>${bullets.map((bullet, bIndex) => `<div class="bullet-row"><textarea data-bullet="${section}|${index}|${bIndex}" aria-label="第 ${bIndex + 1} 条要点" placeholder="写具体做了什么、怎样做、结果如何">${esc(bullet)}</textarea><button class="spark-button" data-action="polish" data-section="${section}" data-index="${index}" data-bullet-index="${bIndex}" title="用 AI 润色该要点" aria-label="AI 润色第 ${bIndex + 1} 条要点">✳</button><button class="icon-button remove-bullet" data-action="remove-bullet" data-section="${section}" data-index="${index}" data-bullet-index="${bIndex}" title="删除要点">×</button></div>`).join('')}</div>`;
}

function renderCards(section) {
  const experience = section === 'experiences';
  const list = resume[section];
  return heading(experience ? '02 / YOUR EXPERIENCE' : '03 / SELECTED WORK', experience ? '把工作写成证据。' : '让项目有脉络。', experience ? '尽量交代场景、行动和结果。没有证据的数字可以不写。' : '突出你的个人贡献，不把团队成果全部归在自己名下。') +
    (list.length ? list.map((item, index) => `<div class="entry-card"><div class="entry-head"><span class="entry-index">${String(index + 1).padStart(2, '0')} / ${experience ? '工作经历' : '项目经历'}</span><button class="icon-button" data-action="remove-entry" data-section="${section}" data-index="${index}" title="删除这段经历">×</button></div><div class="form-grid">${field(experience ? '公司 / 组织' : '项目名称', experience ? item.company : item.name, `data-item="${section}|${index}|${experience ? 'company' : 'name'}"`, experience ? '公司名称' : '项目名称')}${field('你的角色', item.role, `data-item="${section}|${index}|role"`, '例如：前端负责人')}${field('时间范围', item.period, `data-item="${section}|${index}|period"`, '例如：2023.01 — 2024.06', true)}</div>${renderBullets(section, index, item.bullets)}</div>`).join('') : `<div class="empty-state"><strong>从一段经历开始</strong><p>添加公司或项目，再用简洁的要点说出你的贡献。</p></div>`) + `<button class="add-button" data-action="add-entry" data-section="${section}">＋ 添加${experience ? '工作经历' : '项目经历'}</button>`;
}

function renderProjects() {
  return renderCards('projects') + `<div class="divider"></div><div class="section-kicker"><span>CORE SKILLS</span></div><h3 class="section-title">你的工具箱。</h3><p class="section-copy">填写真正会使用的技能，用逗号或换行分隔。</p><div class="form-grid">${field('核心技能', resume.skills.join('，'), 'data-field="skills"', 'TypeScript，用户研究，数据分析…', true, 3)}</div>`;
}

function renderEducation() {
  return heading('04 / EDUCATION', '学习的路径。', '写清学校、学历和时间；补充信息可选。') +
    (resume.education.length ? resume.education.map((item, index) => `<div class="entry-card"><div class="entry-head"><span class="entry-index">${String(index + 1).padStart(2, '0')} / 教育经历</span><button class="icon-button" data-action="remove-entry" data-section="education" data-index="${index}">×</button></div><div class="form-grid">${field('学校', item.school, `data-item="education|${index}|school"`, '学校名称')}${field('学历 / 专业', item.degree, `data-item="education|${index}|degree"`, '本科 · 计算机科学')}${field('时间范围', item.period, `data-item="education|${index}|period"`, '2019 — 2023')}${field('补充信息', item.details, `data-item="education|${index}|details"`, '相关课程、荣誉等', true, 3)}</div></div>`).join('') : `<div class="empty-state"><strong>还没有教育经历</strong><p>点击下方按钮添加学校与专业。</p></div>`) + `<button class="add-button" data-action="add-entry" data-section="education">＋ 添加教育经历</button>`;
}

function renderModules() {
  return heading('05 / MAKE IT YOURS', '按你的故事排版。', '调整模块标题与顺序；隐藏的模块保留数据，但不会出现在预览和导出中。') +
    `<div class="module-list">${resume.modules.map((module, index) => `<section class="module-card"><div class="module-row"><span class="module-order">${String(index + 1).padStart(2, '0')}</span><div class="module-name"><label for="module-title-${index}">模块标题</label><input id="module-title-${index}" data-module-title="${index}" value="${esc(module.title)}" maxlength="40" aria-label="第 ${index + 1} 个模块标题"></div><div class="module-controls"><button data-action="move-module" data-index="${index}" data-direction="-1" aria-label="将 ${esc(module.title)} 上移" ${index === 0 ? 'disabled' : ''}>↑</button><button data-action="move-module" data-index="${index}" data-direction="1" aria-label="将 ${esc(module.title)} 下移" ${index === resume.modules.length - 1 ? 'disabled' : ''}>↓</button><button class="module-visibility ${module.visible ? 'on' : ''}" data-action="toggle-module" data-index="${index}" aria-label="${module.visible ? '隐藏' : '显示'} ${esc(module.title)}">${module.visible ? '显示中' : '已隐藏'}</button>${module.type === 'custom' ? `<button class="module-delete" data-action="delete-module" data-index="${index}" aria-label="删除 ${esc(module.title)}">×</button>` : ''}</div></div>${module.type === 'custom' ? renderCustomItems(module, index) : ''}</section>`).join('')}</div><div class="new-module"><label for="new-module-name">添加自定义模块</label><div><input id="new-module-name" placeholder="例如：荣誉奖项、证书、开源贡献" maxlength="40"><button class="primary-button" data-action="add-module">＋ 添加模块</button></div><small>自定义模块可以添加多条记录，每条包含标题、说明、时间和详情。</small></div>`;
}

function renderCustomItems(module, moduleIndex) {
  return `<div class="custom-items"><div class="custom-head"><span>模块内容 · ${module.items.length} 条</span><button class="mini-add" data-action="add-custom-item" data-index="${moduleIndex}">＋ 添加记录</button></div>${module.items.map((item, itemIndex) => `<div class="custom-item"><div class="custom-item-head"><strong>记录 ${itemIndex + 1}</strong><button class="icon-button" data-action="remove-custom-item" data-index="${moduleIndex}" data-item-index="${itemIndex}" aria-label="删除第 ${itemIndex + 1} 条记录">×</button></div><div class="form-grid">${field('标题', item.title, `data-custom-item="${moduleIndex}|${itemIndex}|title"`, '例如：全国大学生设计竞赛')}${field('角色 / 说明', item.subtitle, `data-custom-item="${moduleIndex}|${itemIndex}|subtitle"`, '例如：一等奖')}${field('时间', item.period, `data-custom-item="${moduleIndex}|${itemIndex}|period"`, '例如：2024.06')}${field('详情', item.details, `data-custom-item="${moduleIndex}|${itemIndex}|details"`, '写清可核实的事实。', true, 3)}</div></div>`).join('')}</div>`;
}

function renderAI() {
  return `<div class="ai-hero"><span>✳ EVIDENCE IN, CLARITY OUT</span><h3>AI 是编辑，不是编剧。</h3><p>把你的真实事实交给 AI 整理；每次生成和润色都会先展示建议，由你选择是否应用。</p></div>
    <div class="ai-config ${aiReady ? '' : 'offline'}" id="ai-status">${aiReady ? 'AI 服务已连接。输入事实笔记即可生成草稿。' : '公开演示可编辑和导出。要使用 AI，请按 README 在本机配置 OPENAI_API_KEY 并运行服务。'}</div>
    <div class="form-grid">${field('目标岗位', resume.target.role, 'data-field="target.role"', '例如：高级产品经理')}${field('岗位描述 / 关键词', resume.target.description, 'data-field="target.description"', '粘贴岗位 JD，右侧会显示关键词提示。', true, 4, '关键词提示只是辅助检查，请勿为了匹配而添加不真实的经历。')}</div>
    <div class="divider"></div><div class="section-kicker"><span>FROM RAW NOTES TO RESUME</span></div><h3 class="section-title">把事实交给 AI 整理。</h3><p class="section-copy">写下公司、项目、职责、使用的工具与可核实的结果。生成内容会先进入审核窗口。</p><div class="form-grid">${field('原始经历笔记', notes, 'data-notes="true"', '例如：2022 年加入 XX 公司，负责订单后台。用 React 重构表单流程，和设计师协作……', true, 9, '只输入愿意发送给你配置的 AI 服务提供商的信息。')}</div><div class="ai-button-row"><button class="primary-button" id="generate-button" ${aiReady ? '' : 'disabled'}>✳ 生成简历草稿</button><span>AI 结果可能不准确。<br>请逐项核对后应用。</span></div>`;
}

function renderTab() {
  $('.tabs .active')?.classList.remove('active');
  $(`.tab[data-tab="${activeTab}"]`)?.classList.add('active');
  $('#tab-content').innerHTML = ({ profile: renderProfile, experience: () => renderCards('experiences'), projects: renderProjects, education: renderEducation, modules: renderModules, ai: renderAI })[activeTab]();
  $('#demo-banner').classList.toggle('hidden', !demoMode);
}

function previewEntry(item, title, subtitle) {
  return `<div class="paper-entry"><div class="paper-entry-top"><strong>${esc(title)}</strong><em>${esc(item.period)}</em></div>${subtitle ? `<div class="paper-entry-sub">${esc(subtitle)}</div>` : ''}${item.bullets?.length ? `<ul>${item.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`;
}

function renderPreview() {
  const r = resume; const p = r.personal;
  const block = (title, body) => body ? `<section class="paper-section"><div class="paper-heading">${esc(title)}</div>${body}</section>` : '';
  const sections = r.modules.filter(module => module.visible).map(module => {
    if (module.type === 'summary') return block(module.title, r.summary ? `<p class="paper-summary">${esc(r.summary)}</p>` : '<p class="paper-empty">用两三句话概括你的核心优势。</p>');
    if (module.type === 'skills') return block(module.title, r.skills.length ? `<div class="paper-skill-list">${r.skills.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : '');
    if (module.type === 'experiences') return block(module.title, r.experiences.map(e => previewEntry(e, [e.role, e.company].filter(Boolean).join(' · '), '')).join(''));
    if (module.type === 'projects') return block(module.title, r.projects.map(e => previewEntry(e, e.name, e.role)).join(''));
    if (module.type === 'education') return block(module.title, r.education.map(e => `<div class="paper-entry"><div class="paper-entry-top"><strong>${esc(e.school)}</strong><em>${esc(e.period)}</em></div><div class="paper-entry-sub">${esc(e.degree)}</div>${e.details ? `<p>${esc(e.details)}</p>` : ''}</div>`).join(''));
    if (module.type === 'custom') return block(module.title, module.items.filter(e => e.title || e.subtitle || e.period || e.details).map(e => `<div class="paper-entry"><div class="paper-entry-top"><strong>${esc(e.title)}</strong><em>${esc(e.period)}</em></div>${e.subtitle ? `<div class="paper-entry-sub">${esc(e.subtitle)}</div>` : ''}${e.details ? `<p class="paper-summary">${esc(e.details)}</p>` : ''}</div>`).join(''));
    return '';
  }).join('');
  $('#resume-preview').innerHTML = `<header class="paper-top"><h2 class="paper-name">${esc(p.name || '你的名字')}</h2><p class="paper-role">${esc(p.title || '你的求职定位')}</p><div class="paper-contact">${[p.city, p.phone, p.email, p.link].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div></header>
    ${sections}`;
}

function renderInsights() {
  const result = analyzeMatch(resume);
  $('#coverage-score').textContent = result.keywordCoverage === null ? '—' : `${result.keywordCoverage}%`;
  $('#keyword-summary').textContent = result.keywordCoverage === null
    ? '在 AI 工作台填写目标岗位描述，即可查看关键词提示。'
    : `简历信息完整度 ${result.completeness}%。已出现 ${result.matched.length} 个关键词，可核对 ${result.missing.length} 个未出现的词。`;
  $('#keyword-tags').innerHTML = [...result.matched.slice(0, 4).map(x => `<span>${esc(x)}</span>`), ...result.missing.slice(0, 4).map(x => `<span class="missing">${esc(x)}</span>`)].join('');
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filename(extension) { return `${resume.personal.name.trim() || '我的简历'}-ProofCV.${extension}`; }

async function runAI(kind, payload) {
  const button = kind === 'generate' ? $('#generate-button') : document.activeElement;
  if (button) { button.disabled = true; button.dataset.original = button.textContent; button.textContent = '正在整理…'; }
  try {
    const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, ...payload }) });
    let data; try { data = await response.json(); } catch { throw new Error('AI 服务不可用；请在本机运行 Node 服务。'); }
    if (!response.ok) throw new Error(data.error || 'AI 请求失败');
    return data.result;
  } finally { if (button) { button.disabled = false; button.textContent = button.dataset.original; } }
}

function openProposal(info) {
  proposal = info;
  $('#proposal-title').textContent = info.kind === 'polish' ? '要点润色建议' : '生成的简历草稿';
  if (info.kind === 'polish') {
    $('#proposal-body').innerHTML = `<div class="compare-grid"><div class="compare-card"><span>原文 / BEFORE</span><p>${esc(info.before)}</p></div><div class="compare-card new"><span>建议 / AFTER</span><p>${esc(info.result.rewrite)}</p></div></div><p class="rationale">${esc(info.result.rationale)}</p>`;
  } else {
    const draft = applyDraft(resume, info.result);
    $('#proposal-body').innerHTML = `<p class="rationale">AI 根据你的笔记整理出以下内容。联系方式和教育信息会保留原样；接受后才会写入编辑器。</p><div class="draft-preview">${esc(toMarkdown(draft))}</div>`;
  }
  $('#proposal-backdrop').classList.remove('hidden');
  $('#accept-proposal').focus();
}

function closeProposal() { proposal = null; $('#proposal-backdrop').classList.add('hidden'); }

$('.tabs').addEventListener('click', event => {
  const tab = event.target.closest('[data-tab]'); if (!tab) return;
  activeTab = tab.dataset.tab; renderTab();
});

$('#tab-content').addEventListener('input', event => {
  const el = event.target;
  if (el.dataset.field) {
    const path = el.dataset.field.split('.');
    if (path[0] === 'skills') resume.skills = el.value.split(/[,，\n]/).map(s => s.trim()).filter(Boolean).slice(0, 30);
    else if (path.length === 1) resume[path[0]] = el.value;
    else resume[path[0]][path[1]] = el.value;
    update();
  } else if (el.dataset.item) {
    const [section, index, key] = el.dataset.item.split('|');
    resume[section][Number(index)][key] = el.value; update();
  } else if (el.dataset.bullet) {
    const [section, index, bIndex] = el.dataset.bullet.split('|');
    resume[section][Number(index)].bullets[Number(bIndex)] = el.value; update();
  } else if (el.dataset.moduleTitle !== undefined) {
    resume.modules[Number(el.dataset.moduleTitle)].title = el.value.slice(0, 40); update();
  } else if (el.dataset.customItem) {
    const [moduleIndex, itemIndex, key] = el.dataset.customItem.split('|');
    resume.modules[Number(moduleIndex)].items[Number(itemIndex)][key] = el.value; update();
  } else if (el.dataset.notes) notes = el.value;
});

$('#tab-content').addEventListener('focusout', event => {
  if (event.target.dataset.moduleTitle === undefined) return;
  resume.modules = normalizeModules(resume.modules);
  event.target.value = resume.modules[Number(event.target.dataset.moduleTitle)].title;
  update();
});

$('#tab-content').addEventListener('click', async event => {
  const action = event.target.closest('[data-action]');
  if (action) {
    const { section, index, bulletIndex } = action.dataset;
    const i = Number(index); const b = Number(bulletIndex);
    if (action.dataset.action === 'add-module') {
      const name = $('#new-module-name').value.trim();
      if (!name) return toast('请先输入模块名称。');
      if (resume.modules.length >= 20) return toast('最多支持 20 个模块。');
      resume.modules.push({ id: `custom-${id()}`, type: 'custom', title: name.slice(0, 40), visible: true, items: [] });
    } else if (action.dataset.action === 'move-module') resume.modules = moveModule(resume.modules, i, Number(action.dataset.direction));
    else if (action.dataset.action === 'toggle-module') resume.modules[i].visible = !resume.modules[i].visible;
    else if (action.dataset.action === 'delete-module') {
      if (resume.modules[i].type !== 'custom') return;
      if (!confirm(`删除「${resume.modules[i].title}」及其中全部记录？建议先导出 JSON 备份。`)) return;
      resume.modules.splice(i, 1);
    } else if (action.dataset.action === 'add-custom-item') {
      if (resume.modules[i].items.length >= 12) return toast('每个模块最多添加 12 条记录。');
      resume.modules[i].items.push({ id: id(), title: '', subtitle: '', period: '', details: '' });
    } else if (action.dataset.action === 'remove-custom-item') resume.modules[i].items.splice(Number(action.dataset.itemIndex), 1);
    else if (action.dataset.action === 'add-entry') {
      resume[section].push(section === 'education' ? { id: id(), school: '', degree: '', period: '', details: '' } : { id: id(), ...(section === 'projects' ? { name: '', role: '' } : { company: '', role: '' }), period: '', bullets: [''] });
    } else if (action.dataset.action === 'remove-entry') resume[section].splice(i, 1);
    else if (action.dataset.action === 'add-bullet') resume[section][i].bullets.push('');
    else if (action.dataset.action === 'remove-bullet') resume[section][i].bullets.splice(b, 1);
    else if (action.dataset.action === 'polish') {
      const bullet = resume[section][i].bullets[b];
      if (!bullet?.trim()) return toast('先写一条要点，再用 AI 润色。');
      try { const result = await runAI('polish', { bullet, role: resume.target.role || resume.personal.title }); openProposal({ kind: 'polish', section, index: i, bulletIndex: b, before: bullet, result }); }
      catch (error) { toast(error.message); }
      return;
    }
    update(); renderTab(); return;
  }
  if (event.target.id === 'generate-button') {
    if (notes.trim().length < 20) return toast('请先写至少 20 字真实经历笔记。');
    try { const result = await runAI('generate', { notes, role: resume.target.role || resume.personal.title }); openProposal({ kind: 'generate', result }); }
    catch (error) { toast(error.message); }
  }
});

$('#accept-proposal').addEventListener('click', () => {
  if (!proposal) return;
  if (proposal.kind === 'polish') {
    resume[proposal.section][proposal.index].bullets[proposal.bulletIndex] = proposal.result.rewrite;
  } else resume = applyDraft(resume, proposal.result);
  closeProposal(); update(); renderTab(); toast('建议已应用，内容已在本地保存。');
});
$('#reject-proposal').addEventListener('click', closeProposal);
$('#close-proposal').addEventListener('click', closeProposal);
$('#proposal-backdrop').addEventListener('click', event => { if (event.target.id === 'proposal-backdrop') closeProposal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeProposal(); $('#export-popover').classList.add('hidden'); } });

$('#reset-button').addEventListener('click', () => {
  if (!confirm('要清空当前简历并新建空白文档吗？建议先导出 JSON 备份。')) return;
  resume = blankResume(); demoMode = false; notes = ''; activeTab = 'profile'; update(); renderTab(); toast('已创建空白简历。');
});
$('#dismiss-demo').addEventListener('click', () => { demoMode = false; persist(); renderTab(); });
$('#export-menu-button').addEventListener('click', () => $('#export-popover').classList.toggle('hidden'));
$('#export-popover').addEventListener('click', event => {
  const choice = event.target.closest('[data-export]')?.dataset.export; if (!choice) return;
  $('#export-popover').classList.add('hidden');
  if (demoMode) toast('提示：当前仍含虚构示例，请核实全部内容后使用。');
  if (choice === 'pdf') window.print();
  if (choice === 'markdown') download(filename('md'), toMarkdown(resume), 'text/markdown;charset=utf-8');
  if (choice === 'json') download(filename('json'), JSON.stringify({ version: 1, resume }, null, 2), 'application/json;charset=utf-8');
});
$('#import-button').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    if (file.size > 300_000) throw new Error('JSON 文件过大。');
    const data = JSON.parse(await file.text());
    if (!data || typeof (data.resume || data) !== 'object') throw new Error('文件中没有简历数据。');
    resume = normalizeResume(data.resume || data); demoMode = false; activeTab = 'profile'; update(); renderTab(); toast('简历已导入。');
  } catch (error) { toast(`导入失败：${error.message}`); }
  event.target.value = '';
});

renderTab(); renderPreview(); renderInsights(); persist();
fetch('/api/status').then(r => r.ok ? r.json() : null).then(data => { aiReady = Boolean(data?.aiReady); if (activeTab === 'ai') renderTab(); }).catch(() => {});
