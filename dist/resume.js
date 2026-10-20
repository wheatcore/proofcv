export const STORAGE_KEY = 'proofcv.resume.v1';

export const blankResume = () => ({
  personal: { name: '', title: '', email: '', phone: '', city: '', link: '' },
  summary: '',
  skills: [],
  experiences: [],
  projects: [],
  education: [],
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
    target: { role: clean(target.role, 160), description: clean(target.description, 5000) },
  };
}

export function toMarkdown(resume) {
  const r = normalizeResume(resume);
  const p = r.personal;
  const out = [`# ${p.name || '姓名'}`, [p.title, p.city, p.phone, p.email, p.link].filter(Boolean).join(' · ')];
  if (r.summary) out.push('', '## 个人简介', r.summary);
  if (r.skills.length) out.push('', '## 核心技能', r.skills.join(' · '));
  for (const [heading, list, title] of [
    ['工作经历', r.experiences, item => `${item.role}｜${item.company}`],
    ['项目经历', r.projects, item => `${item.name}｜${item.role}`],
  ]) if (list.length) {
    out.push('', `## ${heading}`);
    for (const item of list) out.push('', `### ${title(item)}`, item.period, ...item.bullets.map(b => `- ${b}`));
  }
  if (r.education.length) {
    out.push('', '## 教育经历');
    for (const item of r.education) out.push('', `### ${item.school}｜${item.degree}`, item.period, item.details);
  }
  return out.filter((line, index, array) => line !== '' || array[index - 1] !== '').join('\n').trim() + '\n';
}

const STOP = new Set(['工作', '经验', '负责', '要求', '熟悉', '能够', '相关', '优先', '以及', '具有', '岗位', '能力', '我们', '团队', '技术', '进行', '参与']);
export function analyzeMatch(resume) {
  const r = normalizeResume(resume);
  const text = [r.summary, ...r.skills, ...r.experiences.flatMap(e => e.bullets), ...r.projects.flatMap(e => e.bullets)].join(' ').toLowerCase();
  const terms = [...new Set((r.target.description.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}|[\u4e00-\u9fff]{2,6}/g) || []).map(x => x.trim()))]
    .filter(x => !STOP.has(x) && x.length > 1).slice(0, 30);
  const matched = terms.filter(term => text.includes(term));
  const missing = terms.filter(term => !text.includes(term));
  const completeness = [r.personal.name, r.personal.title, r.personal.email, r.summary, r.skills.length, r.experiences.length || r.projects.length, r.education.length].filter(Boolean).length;
  return { matched, missing, completeness: Math.round(completeness / 7 * 100), keywordCoverage: terms.length ? Math.round(matched.length / terms.length * 100) : null };
}

export function applyDraft(resume, draft) {
  const base = normalizeResume(resume);
  const safe = normalizeResume({ ...base, ...draft, personal: base.personal, target: base.target, education: base.education });
  return safe;
}
