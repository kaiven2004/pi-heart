import type { Message, Session } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error('API error: ' + res.status);
  return res.json();
}

export const api = {
  async listSessions(): Promise<Session[]> {
    return request<Session[]>('/sessions');
  },
  async createSession(): Promise<Session> {
    return request<Session>('/sessions', { method: 'POST' });
  },
  async deleteSession(id: string): Promise<void> {
    await request('/sessions/' + encodeURIComponent(id), { method: 'DELETE' });
  },
  async getMessages(sessionId: string): Promise<Message[]> {
    return request<Message[]>('/sessions/' + encodeURIComponent(sessionId) + '/messages');
  },
  async sendMessage(sessionId: string, text: string): Promise<{ message: string; sessionUpdated?: Session }> {
    return request('/sessions/' + encodeURIComponent(sessionId) + '/messages', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },
};

export const mentalHealthApi = {
  async start(): Promise<{ questions: any[]; totalQuestions: number; maxScore: number }> {
    return request('/mental-health', { method: "POST", body: JSON.stringify({ action: "start" }) });
  },
  async submit(answers: Record<string, number>): Promise<any> {
    return request('/mental-health', { method: "POST", body: JSON.stringify({ action: "submit", answers }) });
  },
  async history(): Promise<{ history: any[] }> {
    return request('/mental-health', { method: "POST", body: JSON.stringify({ action: "history" }) });
  },
  async completeTask(taskId: string): Promise<any> {
    return request('/mental-health', { method: "POST", body: JSON.stringify({ action: "complete_task", taskId }) });
  },
};