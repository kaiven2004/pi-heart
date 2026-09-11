// 心语后端 API 服务器
// 为前端提供 HTTP API 接口

import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ─── 会话存储（与 src/session.ts 共享同一目录）───
function getSessionsDir(): string {
  const dir = join(homedir(), '.pi-心理', 'sessions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

interface SessionMeta {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  sentimentHistory: any[];
}

interface SessionMessage {
  role: 'user' | 'assistant' | 'toolResult';
  content: string;
  timestamp: number;
}

interface Session {
  meta: SessionMeta;
  messages: SessionMessage[];
}

// ─── API 路由处理 ───
const routes: Record<string, (req: any, res: any) => void> = {};

function json(res: any, data: any, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function cors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function handleRequest(req: any, res: any) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  // GET /api/sessions
  if (path === '/api/sessions' && req.method === 'GET') {
    const dir = getSessionsDir();
    if (!existsSync(dir)) return json(res, []);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort((a, b) => {
      const mA = JSON.parse(readFileSync(join(dir, a), 'utf-8')) as Session;
      const mB = JSON.parse(readFileSync(join(dir, b), 'utf-8')) as Session;
      return mB.meta.updatedAt - mA.meta.updatedAt;
    });
    const sessions = files.map((file) => {
      const session = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as Session;
      const lastMsg = session.messages[session.messages.length - 1];
      return {
        id: session.meta.sessionId,
        title: session.messages[0]?.content?.substring(0, 30) + '...' || '新对话',
        createdAt: session.meta.createdAt,
        updatedAt: session.meta.updatedAt,
        messageCount: session.messages.filter((m) => m.role !== 'toolResult').length,
      };
    });
    return json(res, sessions);
  }

  // POST /api/sessions
  if (path === '/api/sessions' && req.method === 'POST') {
    const now = Date.now();
    const session: Session = {
      meta: {
        sessionId: 'session_' + now + '_' + Math.random().toString(36).substring(2, 8),
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        sentimentHistory: [],
      },
      messages: [],
    };
    const dir = getSessionsDir();
    const filename = session.meta.sessionId + '.json';
    writeFileSync(join(dir, filename), JSON.stringify(session, null, 2));
    return json(res, {
      id: session.meta.sessionId,
      title: '新对话',
      createdAt: session.meta.createdAt,
      updatedAt: session.meta.updatedAt,
      messageCount: 0,
    });
  }

  // DELETE /api/sessions/:id
  const deleteMatch = path.match(/^\/api\/sessions\/(.+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const id = decodeURIComponent(deleteMatch[1]);
    const dir = getSessionsDir();
    const file = dir + '/' + id + '.json';
    if (existsSync(file)) {
      readFileSync(file, 'utf-8'); // just to check
      require('node:fs').unlinkSync(file);
    }
    return json(res, { ok: true });
  }

  // GET /api/sessions/:id/messages
  const msgsMatch = path.match(/^\/api\/sessions\/(.+)\/messages$/);
  if (msgsMatch && req.method === 'GET') {
    const id = decodeURIComponent(msgsMatch[1]);
    const dir = getSessionsDir();
    const file = join(dir, id + '.json');
    if (!existsSync(file)) return json(res, { error: 'Session not found' }, 404);
    const session = JSON.parse(readFileSync(file, 'utf-8')) as Session;
    const messages = session.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        id: 'msg_' + m.timestamp,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp,
      }));
    return json(res, messages);
  }

  // POST /api/sessions/:id/messages/stream (SSE 流式)
  const streamMatch = path.match(/^\/api\/sessions\/(.+)\/messages\/stream$/);
  if (streamMatch && req.method === 'POST') {
    const id = decodeURIComponent(streamMatch[1]);
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body);
        if (!text) return json(res, { error: 'Missing text' }, 400);

        // 加载会话
        const dir = getSessionsDir();
        const file = join(dir, id + '.json');
        if (!existsSync(file)) return json(res, { error: 'Session not found' }, 404);
        const sessionRaw = readFileSync(file, 'utf-8');
        const session = JSON.parse(sessionRaw) as Session;

        // 添加用户消息
        const userMsg = { role: 'user', content: text, timestamp: Date.now() };
        session.messages.push(userMsg);
        session.meta.updatedAt = Date.now();
        session.meta.messageCount = session.messages.length;
        writeFileSync(file, JSON.stringify(session, null, 2));

        // 准备 SSE 响应
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        const history = session.messages.slice(0, -1);
        const { runStreamAgent } = await import('../dist/stream-agent.js');

        await runStreamAgent({
          history,
          input: text,
          onSSE: (eventType, data) => {
            res.write(`event: ${eventType}\ndata: ${data}\n\n`);
          },
        });

        // 流结束后保存 assistant 消息
        try {
          const updated = JSON.parse(readFileSync(file, 'utf-8')) as Session;
          const lastMsg = updated.messages[updated.messages.length - 1];
          if (lastMsg?.role === 'assistant') {
            res.write(`event: session_updated\ndata: ${JSON.stringify({
              id: updated.meta.sessionId,
              title: updated.messages[0]?.content?.substring(0, 30) + '...' || '新对话',
              createdAt: updated.meta.createdAt,
              updatedAt: updated.meta.updatedAt,
              messageCount: updated.messages.filter((m: any) => m.role !== 'toolResult').length,
            })}\n\n`);
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

  // POST /api/sessions/:id/messages
  const sendMatch = path.match(/^\/api\/sessions\/(.+)\/messages$/);
  if (sendMatch && req.method === 'POST') {
    const id = decodeURIComponent(sendMatch[1]);
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body);
        if (!text) return json(res, { error: 'Missing text' }, 400);

        // 加载会话
        const dir = getSessionsDir();
        const file = join(dir, id + '.json');
        if (!existsSync(file)) return json(res, { error: 'Session not found' }, 404);
        const session = JSON.parse(readFileSync(file, 'utf-8')) as Session;

        // 添加用户消息
        session.messages.push({ role: 'user', content: text, timestamp: Date.now() });
        session.meta.updatedAt = Date.now();
        session.meta.messageCount = session.messages.length;
        writeFileSync(file, JSON.stringify(session, null, 2));

        // 调用 Agent 获取回复
        const reply = await getAgentReply(text, session.messages.slice(0, -1));

        // 添加助手消息
        session.messages.push({ role: 'assistant', content: reply, timestamp: Date.now() });
        session.meta.updatedAt = Date.now();
        session.meta.messageCount = session.messages.length;
        writeFileSync(file, JSON.stringify(session, null, 2));

        // 返回结果
        const lastMsg = session.messages[session.messages.length - 1];
        return json(res, {
          message: lastMsg.content,
          sessionUpdated: {
            id: session.meta.sessionId,
            title: session.messages[0]?.content?.substring(0, 30) + '...' || '新对话',
            createdAt: session.meta.createdAt,
            updatedAt: session.meta.updatedAt,
            messageCount: session.messages.filter((m) => m.role !== 'toolResult').length,
          },
        });
      } catch (err) {
        return json(res, { error: (err as Error).message }, 500);
      }
    });
    return;
  }

  return json(res, { error: 'Not found' }, 404);
}

// ─── Agent 调用（直接导入 dist 模块）───
async function getAgentReply(text: string, history: any[]): Promise<string> {
  // 使用子进程调用 Node.js agent
  const { spawn } = require('node:child_process');
  const { resolve } = require('node:path');

  return new Promise((resolve, reject) => {
    const proc = spawn('node', [
      resolve('dist/index.js'),
      '--api',
      '--session-history', JSON.stringify(history),
      '--input', text,
    ], {
      cwd: resolve(__dirname, '..'),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    proc.on('close', (code: number) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed.reply || stdout.trim());
        } catch {
          resolve(stdout.trim() || '抱歉，我暂时无法回应。');
        }
      } else {
        resolve('抱歉，处理你的消息时出现了问题。');
      }
    });
    proc.on('error', () => resolve('抱歉，服务暂时不可用。'));
  });
}

// ─── 启动服务器 ───
const PORT = parseInt(process.env.PORT ?? '8080', 10);
const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`心语 API 服务器运行在 http://localhost:${PORT}`);
  console.log(`前端开发服务器: http://localhost:3000`);
});
