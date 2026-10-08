import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeDraft } from './domain.js';

export function createStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT NOT NULL, company TEXT NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, contact TEXT NOT NULL, email TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL, kind TEXT NOT NULL, created TEXT NOT NULL);
  `);
  function activity(user, text, kind = 'document') { db.prepare('INSERT INTO activity VALUES (?, ?, ?, ?, ?)').run(randomUUID(), user, text, kind, new Date().toISOString()); }
  function addDocument(user, data, time = new Date().toISOString()) {
    const id = randomUUID();
    db.prepare('INSERT INTO documents VALUES (?, ?, ?, ?, ?)').run(id, user, JSON.stringify(data), time, time);
    activity(user, `${data.title} 문서를 만들었습니다.`, 'create');
    return { id, ...data, created: time, updated: time };
  }
  function createDemo() {
    const id = randomUUID(), now = new Date().toISOString();
    db.prepare('INSERT INTO users VALUES (?, NULL, NULL, ?, ?, ?)').run(id, '크리에이터', '스튜디오 폴리오', now);
    const samples = [
      ['오브제 브랜드 리뉴얼 제안', '오브제 스튜디오', 'branding', 'proposal', 'review', 15000000],
      ['루미 웹사이트 구축 견적', '루미 코퍼레이션', 'website', 'quote', 'draft', 24000000],
      ['2026 가을 디지털 캠페인', '무드앤코', 'marketing', 'proposal', 'won', 18000000],
      ['노트 앱 UX/UI 디자인 제안', '노트랩', 'website', 'proposal', 'draft', 8500000],
      ['브랜드 전략 컨설팅 견적', '아틀리에 서울', 'consulting', 'quote', 'won', 12000000]
    ];
    samples.forEach(([title, client, template, type, status, budget], i) => {
      const data = makeDraft({ title, client, template, type, budget, brief: '브랜드의 가치를 일관된 고객 경험으로 연결하는 프로젝트입니다.' });
      data.status = status;
      const date = new Date(Date.now() - i * 86400000).toISOString();
      data.due = new Date(Date.now() + (i + 3) * 86400000).toISOString().slice(0, 10);
      addDocument(id, data, date);
      db.prepare('INSERT INTO clients VALUES (?, ?, ?, ?, ?)').run(randomUUID(), id, client, ['김지은', '박준호', '이서연', '정민수', '한수빈'][i], `hello@sample-${i + 1}.example`);
    });
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
  const parseDoc = row => row ? { ...JSON.parse(row.data), id: row.id, created: row.created, updated: row.updated } : null;
  return {
    db, activity, addDocument, createDemo,
    documents: user => db.prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY updated DESC').all(user).map(parseDoc),
    document: (user, id) => parseDoc(db.prepare('SELECT * FROM documents WHERE user_id = ? AND id = ?').get(user, id)),
    updateDocument(user, id, data) {
      const time = new Date().toISOString();
      db.prepare('UPDATE documents SET data = ?, updated = ? WHERE user_id = ? AND id = ?').run(JSON.stringify(data), time, user, id);
      activity(user, `${data.title} 문서를 수정했습니다.`);
      return this.document(user, id);
    },
    clients: user => db.prepare('SELECT id, name, contact, email FROM clients WHERE user_id = ? ORDER BY name').all(user),
    activities: user => db.prepare('SELECT text, kind, created FROM activity WHERE user_id = ? ORDER BY created DESC LIMIT 8').all(user)
  };
}
