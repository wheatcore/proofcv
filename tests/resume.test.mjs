import test from 'node:test';
import assert from 'node:assert/strict';
import { blankResume, normalizeResume, sampleResume, toMarkdown, analyzeMatch, applyDraft } from '../dist/resume.js';

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
