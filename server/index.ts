import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createAgent } from '../src/agent.js';
import {
  listSessions,
  loadSession,
  createSession,
  saveSession,
  appendMessage,
  agentMessageToSession,
  type Session,
  type SessionMessage,
} from '../src/session.js';

// 加载 .env
function loadEnv() {
  const envPath = 'D:/pi-项目/pi-心理/.env';
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0 && !(t.slice(0, i).trim() in process.env)) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
}
loadEnv();

const PORT = parseInt(process.env.PORT ?? '8081', 10);
const SESSIONS_DIR = join(homedir(), '.pi-心理', 'sessions');

if (!existsSync(SESSIONS_DIR)) {
  mkdirSync(SESSIONS_DIR, { recursive: true });
}

function json(res: any, data: any, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
  });
}

function toSessionSummary(session: any) {
  return {
    id: session.meta.sessionId,
    title: (session.lastMessage || "新对话").substring(0, 30) + (session.lastMessage && session.lastMessage.length > 30 ? "..." : ""),
    createdAt: session.meta.createdAt,
    updatedAt: session.meta.updatedAt,
    messageCount: session.meta.messageCount,
  };
}

let agentInstance: any = null;

async function getAgent() {
  if (!agentInstance) {
    agentInstance = await createAgent();
  }
  return agentInstance;
}

async function getAgentReply(text: string, historyMessages: SessionMessage[]): Promise<string> {
  const agent = await getAgent();
  agent.state.messages = historyMessages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }));
  await agent.prompt(text);
  const messages = agent.state.messages;
  // Extract text from all assistant messages
  let reply = '';
  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const texts = msg.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');
      if (texts) reply = texts;
    }
  }
  if (reply) return reply;
  for (let j = 0; j < messages.length; j++) {
    const m = messages[j];
    const isArr = Array.isArray(m.content);
  }
  return '\u62b1\u6b49\uff0c\u6211\u6682\u65f6\u65e0\u6cd5\u56de\u5e94\u3002';
}


const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (path === '/api/sessions' && req.method === 'GET') {
    try {
      const sessions = listSessions();
      return json(res, sessions.map(toSessionSummary));
    } catch { return json(res, []); }
  }

  if (path === '/api/sessions' && req.method === 'POST') {
    try {
      const session = createSession();
      saveSession(session);
      return json(res, toSessionSummary(session), 201);
    } catch (err) { console.log('MH catch:', err);
        return json(res, { error: (err as Error).message }, 500); }
  }

  const deleteMatch = path.match(/^\/api\/sessions\/(.+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    try {
      const file = join(SESSIONS_DIR, decodeURIComponent(deleteMatch[1]) + '.json');
      if (existsSync(file)) unlinkSync(file);
      return json(res, { ok: true });
    } catch (err) { return json(res, { error: (err as Error).message }, 500); }
  }

  const msgsMatch = path.match(/^\/api\/sessions\/(.+)\/messages$/);
  if (msgsMatch && req.method === 'GET') {
    try {
      const session = loadSession(decodeURIComponent(msgsMatch[1]));
      if (!session) return json(res, { error: 'not found' }, 404);
      const messages = session.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ id: 'msg_' + m.timestamp, role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp }));
      return json(res, messages);
    } catch (err) { return json(res, { error: (err as Error).message }, 500); }
  }

  // 流式消息端点
  const streamMatch = path.match(/^\/api\/sessions\/(.+)\/messages\/stream$/);
  if (streamMatch && req.method === 'POST') {
    const sessionId = decodeURIComponent(streamMatch[1]);
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body);
        if (!text) return json(res, { error: 'Missing text' }, 400);

        const session = loadSession(sessionId);
        if (!session) return json(res, { error: 'Session not found' }, 404);

        // 保存用户消息
        appendMessage(session, 'user', text);
        saveSession(session);

        // SSE 响应
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        const history = session.messages
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
          .map((m: any) => ({ role: m.role, content: m.content, timestamp: m.timestamp }));

        const { runStreamAgent } = await import('../../../dist/stream-agent.js') as any;

        await runStreamAgent({
          history,
          input: text,
          onSSE: (eventType: string, data: string) => {
            res.write(`event: ${eventType}\ndata: ${data}\n\n`);
          },
        });

        // 保存 assistant 消息
        try {
          const updated = JSON.parse(readFileSync(join(SESSIONS_DIR, sessionId + '.json'), 'utf-8'));
          const lastMsg = updated.messages[updated.messages.length - 1];
          if (lastMsg?.role === 'assistant') {
            res.write(`event: session_updated\ndata: ${JSON.stringify(toSessionSummary(updated))}\n\n`);
          }
        } catch {}

        res.end();
      } catch (err) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
        res.end();
      }
    });
    return;
  }

  if (msgsMatch && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { text } = JSON.parse(body);
      if (!text) return json(res, { error: 'missing text' }, 400);
      const session = loadSession(decodeURIComponent(msgsMatch[1]));
      if (!session) return json(res, { error: 'not found' }, 404);
      appendMessage(session, 'user', text);
      saveSession(session);
      const history = session.messages.filter((m: any) => m.role === 'user' || m.role === 'assistant');
      const reply = await getAgentReply(text, history.slice(0, -1));
      appendMessage(session, 'assistant', reply);
      saveSession(session);
      return json(res, { message: reply, sessionUpdated: toSessionSummary(session) });
    } catch (err) { return json(res, { error: (err as Error).message }, 500); }
  }

  // 心理健康评估 API
  if (path === '/api/mental-health' && req.method === 'POST') {
    try {
      const bodyStr = await readBody(req);
      const { action, answers, taskId } = JSON.parse(bodyStr);
      const { generateTool } = await import('../src/tools/mental_health.js');
      const tool = generateTool();
      const result = await tool.execute("mental_health_api", { action, answers, taskId });
      const text = Array.isArray(result.content) ? result.content.map((x: any) => x.text).join('') : (result as any).text || '';
      return json(res, JSON.parse(text));
    } catch (err) { return json(res, { error: (err as Error).message }, 500); }
  }

  return json(res, { error: 'not found' }, 404);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  心语 API 服务器已启动');
  console.log('  → http://localhost:' + PORT);
  console.log('  → 前端 http://localhost:3000');
  console.log('');
});
