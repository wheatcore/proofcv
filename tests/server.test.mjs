import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { callAI, createApp, validateAIResult } from '../server.mjs';

test('无密钥时状态如实报告且 AI 请求失败', async t => {
  const server = createApp({});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const status = await (await fetch(`${origin}/api/status`)).json();
  assert.equal(status.aiReady, false);
  const result = await fetch(`${origin}/api/ai`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'polish', bullet: '负责后台表单重构' }) });
  assert.equal(result.status, 503);
});

test('AI 使用服务端密钥调用兼容接口并解析建议', async t => {
  let request;
  const mock = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    request = { path: req.url, auth: req.headers.authorization, body: JSON.parse(body) };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ rewrite: '重构后台表单流程，改善操作体验。', rationale: '更具体。' }) } }] }));
  });
  mock.listen(0, '127.0.0.1'); await once(mock, 'listening');
  t.after(() => mock.close());
  const result = await callAI({ kind: 'polish', bullet: '负责后台表单重构' }, { OPENAI_API_KEY: 'test-only', OPENAI_BASE_URL: `http://127.0.0.1:${mock.address().port}/v1`, OPENAI_MODEL: 'mock-model' });
  assert.equal(request.path, '/v1/chat/completions');
  assert.equal(request.auth, 'Bearer test-only');
  assert.equal(request.body.model, 'mock-model');
  assert.match(result.rewrite, /后台表单/);
});

test('AI 结果缺少正文时拒绝应用', () => {
  assert.throws(() => validateAIResult('polish', { rationale: '空结果' }), /没有返回改写内容/);
});

test('服务端只暴露允许的静态文件', async t => {
  const server = createApp({}); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(origin)).status, 200);
  assert.equal((await fetch(`${origin}/../../server.mjs`)).status, 404);
});
