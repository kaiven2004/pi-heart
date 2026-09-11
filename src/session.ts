// 会话持久化管理
// 将对话历史保存到本地 JSON 文件，支持恢复和继续

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// 会话数据格式
export interface SessionMessage {
  role: "user" | "assistant" | "toolResult";
  content: string;
  timestamp: number;
  toolCalls?: Array<{ id: string; name: string; arguments: any }>;
}

export interface SessionMeta {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  sentimentHistory: Array<{ emotion: string; intensity: number; timestamp: number }>;
}

export interface Session {
  meta: SessionMeta;
  messages: SessionMessage[];
}

/** 会话存储根目录: ~/.pi-心理/sessions/ */
function getSessionsDir(): string {
  const dir = join(homedir(), ".pi-心理", "sessions");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** 生成本地唯一会话 ID */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/** 格式化日期 */
function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 相对时间描述 */
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return `${Math.floor(days / 30)} 个月前`;
}

/**
 * 列出所有会话（按更新时间倒序）
 */
export function listSessions(): Array<{ id: string; meta: SessionMeta; lastMessage: string }> {
  const dir = getSessionsDir();
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => {
      const mA = JSON.parse(readFileSync(join(dir, a), "utf-8")) as Session;
      const mB = JSON.parse(readFileSync(join(dir, b), "utf-8")) as Session;
      return mB.meta.updatedAt - mA.meta.updatedAt;
    });

  return files.map((file) => {
    const session = JSON.parse(readFileSync(join(dir, file), "utf-8")) as Session;
    const lastMsg = session.messages[session.messages.length - 1];
    return {
      id: session.meta.sessionId,
      meta: session.meta,
      lastMessage: lastMsg?.content?.substring(0, 50) ?? "(空会话)",
    };
  });
}

/**
 * 加载指定会话
 */
export function loadSession(sessionId: string): Session | null {
  const dir = getSessionsDir();
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const session = JSON.parse(readFileSync(join(dir, file), "utf-8")) as Session;
    if (session.meta.sessionId === sessionId) {
      return session;
    }
  }
  return null;
}

/**
 * 保存会话
 */
export function saveSession(session: Session): void {
  const dir = getSessionsDir();
  session.meta.updatedAt = Date.now();
  session.meta.messageCount = session.messages.length;
  const filename = `${session.meta.sessionId}.json`;
  writeFileSync(join(dir, filename), JSON.stringify(session, null, 2), "utf-8");
}

/**
 * 创建新会话
 */
export function createSession(): Session {
  const now = Date.now();
  return {
    meta: {
      sessionId: generateSessionId(),
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      sentimentHistory: [],
    },
    messages: [],
  };
}

/**
 * 向会话追加消息
 */
export function appendMessage(session: Session, role: "user" | "assistant", content: string, toolCalls?: Session["messages"][0]["toolCalls"]): void {
  session.messages.push({ role, content, timestamp: Date.now(), toolCalls });
  session.meta.updatedAt = Date.now();
  session.meta.messageCount = session.messages.length;
}

/**
 * 将 AgentMessage 转换为可序列化的 SessionMessage
 */
export function agentMessageToSession(msg: any): SessionMessage | null {
  if (msg.role !== "user" && msg.role !== "assistant") return null;
  const content = Array.isArray(msg.content)
    ? msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("")
    : typeof msg.content === "string" ? msg.content : "";
  return {
    role: msg.role as "user" | "assistant",
    content,
    timestamp: msg.timestamp ?? Date.now(),
    toolCalls: msg.toolCalls,
  };
}

/**
 * 格式化会话信息供显示
 */
export function formatSessionInfo(session: Session): string {
  const date = formatDate(session.meta.createdAt);
  const ago = timeAgo(session.meta.updatedAt);
  const lastMsg = session.messages[session.messages.length - 1];
  const preview = lastMsg?.content?.substring(0, 40) ?? "(空)";
  return `  [${session.meta.sessionId.slice(-8)}] ${date} (${ago})\n    消息数: ${session.meta.messageCount}\n    最后: ${preview}`;
}

