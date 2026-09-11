// 心语 CLI + API 入口
// 支持两种模式：CLI（readline交互）和 API（HTTP服务器）

import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { createAgent } from './agent.js';
import {
  listSessions,
  loadSession,
  createSession,
  saveSession,
  appendMessage,
  agentMessageToSession,
  type Session,
} from './session.js';

// ─── 流式 API 模式（SSE）───
if (process.argv.includes('--stream-api')) {
  const args = process.argv;
  const inputIndex = args.indexOf('--input');
  const historyIndex = args.indexOf('--session-history');

  if (inputIndex !== -1 && historyIndex !== -1) {
    const input = args[inputIndex + 1];
    const history = JSON.parse(args[historyIndex + 1] as string);
    const { runStreamAgent } = await import('./stream-agent.js');

    await runStreamAgent({
      history,
      input,
      onSSE: (eventType, data) => {
        process.stdout.write(`event: ${eventType}\ndata: ${data}\n\n`);
      },
    });
  }
  process.exit(0);
}

// ─── API 模式 ───
if (process.argv.includes('--api')) {
  // API 模式：由 api-server.ts 调用
  const args = process.argv;
  const inputIndex = args.indexOf('--input');
  const historyIndex = args.indexOf('--session-history');

  if (inputIndex !== -1 && historyIndex !== -1) {
    const input = args[inputIndex + 1];
    const history = JSON.parse(args[historyIndex + 1] as string);

    // 创建 agent 并获取回复
    const agent = await createAgent();
    // 恢复历史消息
    agent.state.messages = history;
    await agent.prompt(input);

    const messages = agent.state.messages;
    const lastMsg = messages[messages.length - 1];
    let reply = '';
    if (lastMsg?.role === 'assistant') {
      reply = lastMsg.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');
    }

    console.log(JSON.stringify({ reply }));
  }
  process.exit(0);
}

// ─── CLI 模式 ───
const WELCOME_MSG = `




你好，我是心语，一个基于 CBT 原理的心理支持助手。
我会认真倾听你的感受，帮助你更好地理解和应对情绪。

⚠️  重要说明：我不是专业心理咨询师，不能替代专业帮助。
    如果你正在经历严重心理困扰，请打电：
    全国心理救助热线：400-161-9995（24小时）
`;

async function main() {
  console.log(WELCOME_MSG);

  let agent;
  try {
    agent = await createAgent();
  } catch (err) {
    console.error(chalk.red('启动失败：'), err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(chalk.cyan(q), resolve));

  // 会话管理...
  const session = createSession();
  console.log(chalk.green('\n✓ 新会话已创建'));
  console.log(chalk.dim('心语: 请告诉我，今天是什么让你来这里？'));

  while (true) {
    const input = (await ask(chalk.dim('\n你: '))).trim();
    if (!input) continue;

    if (input === '退出' || input === 'quit') {
      console.log(chalk.yellow('心语: 感谢你今天的信任。祝你一切顺利。'));
      break;
    }
    if (input === '帮助' || input === 'help') {
      console.log(chalk.dim('\n  命令：退出 / 帮助 / /历史 / /新建'));
      continue;
    }
    if (input === '/历史') {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log(chalk.dim('  暂无历史会话。'));
      } else {
        console.log(chalk.cyan('\n── 历史会话 ──'));
        sessions.forEach((s, i) => {
          console.log(chalk.dim('  . '));
        });
      }
      continue;
    }
    if (input === '/新建') {
      saveSession(session);
      Object.assign(session, createSession());
      console.log(chalk.green('✓ 新会话已创建'));
      continue;
    }

    console.log(chalk.dim('\n心语: 正在思考...'));
    try {
      await agent.prompt(input);
      const messages = agent.state.messages;
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'assistant') {
        const text = lastMsg.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('');
        if (text) {
          console.log(chalk.green('心语: ') + text);
          const userMsg = messages.slice(-10).reverse().find((m: any) => m.role === 'user');
          if (userMsg) {
            const sm = agentMessageToSession(userMsg);
            if (sm) appendMessage(session, 'user', sm.content);
          }
          const am = agentMessageToSession(lastMsg);
          if (am) appendMessage(session, 'assistant', am.content, am.toolCalls);
          saveSession(session);
        }
      }
    } catch (err) {
      console.error(chalk.red('错误：'), err instanceof Error ? err.message : String(err));
    }
  }

  saveSession(session);
  rl.close();
}

main().catch(console.error);
