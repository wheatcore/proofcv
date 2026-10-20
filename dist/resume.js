export const STORAGE_KEY = 'proofcv.resume.v1';

export const defaultModules = () => [
  { id: 'summary', type: 'summary', title: '个人简介', visible: true },
  { id: 'skills', type: 'skills', title: '核心技能', visible: true },
  { id: 'experiences', type: 'experiences', title: '工作经历', visible: true },
  { id: 'projects', type: 'projects', title: '项目经历', visible: true },
  { id: 'education', type: 'education', title: '教育经历', visible: true },
];

const builtIn = new Set(defaultModules().map(module => module.id));

export const blankResume = () => ({
  personal: { name: '', title: '', email: '', phone: '', city: '', link: '' },
  summary: '',
  skills: [],
  experiences: [],
  projects: [],
  education: [],
  modules: defaultModules(),
  target: { role: '', description: '' },
});

export const sampleResume = () => ({
  personal: {
    name: '林予安', title: '前端开发工程师', email: 'hello@example.com',
    phone: '138 0000 0000', city: '上海', link: 'github.com/example',
  },
  summary: '3 年前端开发经验，关注复杂业务界面的性能和可维护性。曾负责数据看板与组件库建设，能独立推进从需求拆解到上线复盘。',
  skills: ['TypeScript', 'React', 'Vue', '性能优化', '数据可视化', '组件设计'],
  experiences: [
    { id: 'exp-demo', company: '示例科技', role: '前端开发工程师', period: '2022.07 — 至今', bullets: [
      '负责运营数据看板重构，拆分复用组件并优化首屏加载体验。',
      '建立组件规范与文档，推动团队统一常用表单和图表交互。',
    ] },
  ],
  projects: [
    { id: 'project-demo', name: 'InsightBoard 数据分析平台', role: '前端负责人', period: '2023.03 — 2023.10', bullets: [
      '设计多维筛选和图表联动方案，支持运营人员自助分析核心指标。',
    ] },
  ],
  education: [{ id: 'edu-demo', school: '示例大学', degree: '计算机科学与技术 · 本科', period: '2018 — 2022', details: '' }],
  modules: defaultModules(),
  target: { role: '前端开发工程师', description: 'TypeScript React 数据可视化 性能优化 组件库' },
});

const clean = (value, limit = 300) => String(value ?? '').trim().slice(0, limit);
const cleanList = (value, limit = 20, itemLimit = 240) => Array.isArray(value)
  ? value.slice(0, limit).map(item => clean(item, itemLimit)).filter(Boolean) : [];
const cleanItems = (value, kind) => Array.isArray(value) ? value.slice(0, 12).map((item, index) => {
  const base = { id: clean(item?.id, 80) || `${kind}-${index + 1}`, period: clean(item?.period, 80) };
  if (kind === 'education') return { ...base, school: clean(item?.school), degree: clean(item?.degree), details: clean(item?.details, 500) };
  if (kind === 'projects') return { ...base, name: clean(item?.name), role: clean(item?.role), bullets: cleanList(item?.bullets, 8, 400) };
  return { ...base, company: clean(item?.company), role: clean(item?.role), bullets: cleanList(item?.bullets, 8, 400) };
}) : [];

export function normalizeModules(value) {
  const defaults = defaultModules();
  if (!Array.isArray(value)) return defaults;
  const seen = new Set();
  const modules = [];
  for (const raw of value.slice(0, 20)) {
    if (!raw || typeof raw !== 'object') continue;
    const type = builtIn.has(raw.type) && raw.id === raw.type ? raw.type : raw.type === 'custom' ? 'custom' : null;
    const id = clean(raw.id, 80);
    if (!type || !id || seen.has(id) || (type === 'custom' && (!/^custom-[a-zA-Z0-9-]+$/.test(id) || builtIn.has(id)))) continue;
    seen.add(id);
    const fallback = defaults.find(item => item.id === id)?.title || '自定义模块';
    const module = { id, type, title: clean(raw.title, 40) || fallback, visible: raw.visible !== false };
    if (type === 'custom') module.items = Array.isArray(raw.items) ? raw.items.slice(0, 12).filter(item => item && typeof item === 'object').map((item, index) => ({
      id: clean(item.id, 80) || `custom-item-${index + 1}`,
      title: clean(item.title, 180), subtitle: clean(item.subtitle, 180), period: clean(item.period, 80), details: clean(item.details, 1200),
    })) : [];
    modules.push(module);
  }
  for (const module of defaults) if (!seen.has(module.id)) modules.push(module);
  return modules;
}

export function moveModule(modules, index, offset) {
  const next = normalizeModules(modules);
  const target = index + offset;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function normalizeResume(input = {}) {
  const personal = input.personal || {};
  const target = input.target || {};
  return {
    personal: Object.fromEntries(['name', 'title', 'email', 'phone', 'city', 'link'].map(key => [key, clean(personal[key], 160)])),
    summary: clean(input.summary, 1500),
    skills: cleanList(input.skills, 30, 80),
    experiences: cleanItems(input.experiences, 'experiences'),
    projects: cleanItems(input.projects, 'projects'),
    education: cleanItems(input.education, 'education'),
    modules: normalizeModules(input.modules),
    target: { role: clean(target.role, 160), description: clean(target.description, 5000) },
  };
}

export function toMarkdown(resume) {
  const r = normalizeResume(resume);
  const p = r.personal;
  const out = [`# ${p.name || '姓名'}`, [p.title, p.city, p.phone, p.email, p.link].filter(Boolean).join(' · ')];
  for (const module of r.modules.filter(module => module.visible)) {
    if (module.type === 'summary' && r.summary) out.push('', `## ${module.title}`, r.summary);
    if (module.type === 'skills' && r.skills.length) out.push('', `## ${module.title}`, r.skills.join(' · '));
    if (['experiences', 'projects'].includes(module.type) && r[module.type].length) {
      out.push('', `## ${module.title}`);
      for (const item of r[module.type]) {
        const title = module.type === 'experiences' ? `${item.role}｜${item.company}` : `${item.name}｜${item.role}`;
        out.push('', `### ${title}`, item.period, ...item.bullets.map(b => `- ${b}`));
      }
    }
    if (module.type === 'education' && r.education.length) {
      out.push('', `## ${module.title}`);
      for (const item of r.education) out.push('', `### ${item.school}｜${item.degree}`, item.period, item.details);
    }
    if (module.type === 'custom' && module.items.length) {
      const items = module.items.filter(item => item.title || item.subtitle || item.period || item.details);
      if (items.length) out.push('', `## ${module.title}`);
      for (const item of items) out.push('', `### ${item.title}`, [item.subtitle, item.period].filter(Boolean).join(' · '), item.details);
    }
  }
  return out.filter((line, index, array) => line !== '' || array[index - 1] !== '').join('\n').trim() + '\n';
}

const STOP = new Set(['工作', '经验', '负责', '要求', '熟悉', '能够', '相关', '优先', '以及', '具有', '岗位', '能力', '我们', '团队', '技术', '进行', '参与']);
export function analyzeMatch(resume) {
  const r = normalizeResume(resume);
  const visible = new Set(r.modules.filter(module => module.visible).map(module => module.type));
  const text = [visible.has('summary') ? r.summary : '', ...(visible.has('skills') ? r.skills : []), ...(visible.has('experiences') ? r.experiences.flatMap(e => e.bullets) : []), ...(visible.has('projects') ? r.projects.flatMap(e => e.bullets) : []), ...r.modules.filter(module => module.visible && module.type === 'custom').flatMap(module => module.items.flatMap(item => [item.title, item.subtitle, item.details]))].join(' ').toLowerCase();
  const terms = [...new Set((r.target.description.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}|[\u4e00-\u9fff]{2,6}/g) || []).map(x => x.trim()))]
    .filter(x => !STOP.has(x) && x.length > 1).slice(0, 30);
  const matched = terms.filter(term => text.includes(term));
  const missing = terms.filter(term => !text.includes(term));
  const completeness = [r.personal.name, r.personal.title, r.personal.email, r.summary, r.skills.length, r.experiences.length || r.projects.length, r.education.length].filter(Boolean).length;
  return { matched, missing, completeness: Math.round(completeness / 7 * 100), keywordCoverage: terms.length ? Math.round(matched.length / terms.length * 100) : null };
}

export function applyDraft(resume, draft) {
  const base = normalizeResume(resume);
  const safe = normalizeResume({ ...base, ...draft, personal: base.personal, target: base.target, education: base.education, modules: base.modules });
  return safe;
}
