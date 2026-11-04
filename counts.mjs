import assert from 'node:assert/strict';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

let directory;
const pending = new Map();
let nextId = 1;
let running = false;
let timer;
const send = message => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');

function listSessions() {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Session snapshot timed out')); }, 5000);
    pending.set(id, { resolve, reject, timeout });
    send({ id, method: 'sessions.list', params: {} });
  });
}

async function refresh() {
  try {
    const snapshot = await listSessions();
    assert(Array.isArray(snapshot?.sessions), 'Invalid session snapshot');
    const counts = { working: 0, waiting: 0, idle: 0 };
    for (const session of snapshot.sessions) {
      if (session.provider === 'terminal' || session.exitCode != null || ['done', 'failed'].includes(session.status)) continue;
      if (session.status === 'working') counts.working++;
      else if (session.status === 'needs_approval') counts.waiting++;
      else if (['idle', 'unavailable'].includes(session.status)) counts.idle++;
    }
    assert(Object.values(counts).every(value => Number.isInteger(value) && value >= 0), 'Invalid counts');
    await mkdir(directory, { recursive: true });
    const temporary = join(directory, 'counts.json.tmp');
    await writeFile(temporary, JSON.stringify({ version: 1, fetchedAt: Date.now(), counts }), { mode: 0o600 });
    await rename(temporary, join(directory, 'counts.json'));
  } catch (error) {
    send({ method: 'log', params: { level: 'warn', message: `Times Frame counts: ${error.message}` } });
  }
  if (running) timer = setTimeout(refresh, 3000);
}

createInterface({ input: process.stdin }).on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.method === 'canvastty.initialize') {
    if (typeof message.params?.dataDir !== 'string' || !message.params.dataDir) return;
    directory = message.params.dataDir;
    if (!running) { running = true; refresh(); }
    return;
  }
  if (message.method === 'canvastty.shutdown') { running = false; clearTimeout(timer); process.exit(0); }
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  clearTimeout(waiter.timeout);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
}).on('close', () => process.exit(0));
