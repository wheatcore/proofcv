import test from 'node:test';
import assert from 'node:assert/strict';
import { blankResume, normalizeResume, sampleResume, toMarkdown, analyzeMatch, applyDraft, moveModule } from '../dist/resume.js';

test('Markdown 导出保留核心简历内容', () => {
  const md = toMarkdown(sampleResume());
  assert.match(md, /# 林予安/);
  assert.match(md, /## 工作经历/);
  assert.match(md, /InsightBoard/);
  assert.match(md, /TypeScript/);
});

test('导入数据被规范化，拒绝超长和错误字段类型', () => {
  const r = normalizeResume({ personal: { name: 'A'.repeat(300) }, skills: 'not array', experiences: [{ company: 'X', bullets: [1, '真实要点'] }] });
  assert.equal(r.personal.name.length, 160);
  assert.deepEqual(r.skills, []);
  assert.deepEqual(r.experiences[0].bullets, ['1', '真实要点']);
});

test('AI 草稿只覆盖建议区块，保留联系方式和教育', () => {
  const source = sampleResume();
  const next = applyDraft(source, { summary: '新的摘要', personal: { email: 'wrong@example.com' }, education: [], experiences: [] });
  assert.equal(next.summary, '新的摘要');
  assert.equal(next.personal.email, source.personal.email);
  assert.equal(next.education.length, 1);
  assert.deepEqual(next.modules, source.modules);
});

test('旧版简历自动获得默认模块，且自定义模块能按顺序导出', () => {
  const legacy = sampleResume();
  delete legacy.modules;
  assert.equal(normalizeResume(legacy).modules.length, 5);
  const r = sampleResume();
  r.modules.unshift({ id: 'custom-awards', type: 'custom', title: '荣誉奖项', visible: true, items: [{ id: 'award-1', title: '创新奖', subtitle: '团队成员', period: '2024', details: '负责交互原型' }] });
  r.modules.find(m => m.id === 'skills').visible = false;
  const md = toMarkdown(r);
  assert.ok(md.indexOf('## 荣誉奖项') < md.indexOf('## 个人简介'));
  assert.match(md, /创新奖/);
  assert.doesNotMatch(md, /## 核心技能/);
  assert.ok(analyzeMatch(r).keywordCoverage < 100);
  assert.ok(analyzeMatch(r).missing.includes('typescript'));
});

test('模块上移下移不会丢失内容', () => {
  const r = sampleResume();
  r.modules.push({ id: 'custom-cert', type: 'custom', title: '资格证书', visible: true, items: [{ id: 'cert-1', title: '证书 A', subtitle: '', period: '', details: '' }] });
  const moved = moveModule(r.modules, 5, -1);
  assert.equal(moved[4].id, 'custom-cert');
  assert.equal(moved[4].items[0].title, '证书 A');
});

test('关键词覆盖和空岗位说明有明确结果', () => {
  const r = blankResume();
  assert.equal(analyzeMatch(r).keywordCoverage, null);
  r.target.description = 'TypeScript React';
  r.skills = ['TypeScript'];
  const analysis = analyzeMatch(r);
  assert.equal(analysis.keywordCoverage, 50);
  assert.deepEqual(analysis.missing, ['react']);
});
