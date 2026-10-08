import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let child, base;
before(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'folio-test-'));
  child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '0', HOST: '127.0.0.1', FOLIO_DB: join(dir, 'test.sqlite'), OPENAI_API_KEY: '', OPENAI_MODEL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 10000); child.once('exit', () => { clearTimeout(timeout); reject(new Error('Server exited')); }); child.stdout.on('data', chunk => { const match = String(chunk).match(/http:\/\/127\.0\.0\.1:(\d+)/); if (match) { base = match[0]; clearTimeout(timeout); resolve(); } }); });
});
after(() => child?.kill('SIGTERM'));
function client() {
  let cookie = '';
  return async (path, method = 'GET', data, extra = {}) => {
    const res = await fetch(`${base}/api/${path}`, { method, headers: { Cookie: cookie, ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(data ? { body: JSON.stringify(data) } : {}) });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
}
test('documents persist and remain isolated across independent workspaces', async () => {
  const a = client(), b = client();
  const first = await a('bootstrap'); await b('bootstrap');
  assert.equal(first.body.documents.length, 5);
  assert.match(first.headers.get('set-cookie'), /HttpOnly/);
  const draft = await a('generate', 'POST', { client: '테스트 고객', title: '통합 테스트', budget: 1234567, template: 'website' });
  assert.equal(draft.body.mode, 'demo');
  const saved = await a('documents', 'POST', draft.body.document);
  assert.equal(saved.status, 201);
  assert.equal((await b(`documents/${saved.body.id}`, 'PUT', saved.body)).status, 404);
  const update = await a(`documents/${saved.body.id}`, 'PUT', { ...saved.body, title: '저장 확인', status: 'won' });
  assert.equal(update.body.title, '저장 확인');
  assert.equal((await a('bootstrap')).body.documents.find(d => d.id === saved.body.id).status, 'won');
  assert.equal((await b('bootstrap')).body.documents.length, 5);
  assert.equal((await a('documents', 'POST', { ...saved.body, items: [{ name: 'bad', quantity: -1, price: 100 }] })).status, 400);
  assert.equal((await a('clients', 'POST', { name: '침입' }, { Origin: 'https://evil.example' })).status, 403);
});
test('register, logout, and login restore original workspace without password exposure', async () => {
  const a = client(); await a('bootstrap');
  const credentials = { email: 'test@example.com', password: 'correct-horse-123', name: '테스터', company: '테스트 스튜디오' };
  assert.equal((await a('auth', 'POST', { action: 'register', ...credentials })).status, 200);
  await a('clients', 'POST', { name: '나의 고객', email: 'client@example.com', contact: '김테스트' });
  const registered = await a('bootstrap');
  assert.equal(registered.body.user.demo, false);
  assert.equal('password' in registered.body.user, false);
  await a('logout', 'POST');
  assert.equal((await a('documents', 'POST', {})).status, 401);
  await a('bootstrap');
  assert.equal((await a('auth', 'POST', { action: 'login', email: credentials.email, password: 'wrong-password' })).status, 401);
  assert.equal((await a('auth', 'POST', { action: 'login', ...credentials })).status, 200);
  const restored = (await a('bootstrap')).body;
  assert.equal(restored.user.company, '테스트 스튜디오');
  assert.equal(restored.clients.some(c => c.name === '나의 고객'), true);
});
