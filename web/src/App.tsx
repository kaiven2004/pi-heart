import { useState, useRef, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import WelcomeScreen from './components/WelcomeScreen';
import MentalHealthAssessment from './components/MentalHealthAssessment';
import type { Message, Session } from './types';
import { api } from './api';

type ViewMode = 'welcome' | 'chat' | 'assessment';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mentalHealthView, setMentalHealthView] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await api.listSessions();
      setSessions(data);
    } catch { /* 静默失败 */ }
  };

  const handleNewSession = async () => {
    const session = await api.createSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session);
    setMessages([]);
    setViewMode('chat');
    setSidebarOpen(false);
    setMentalHealthView(false);
  };

  const handleSelectSession = async (session: Session) => {
    const msgs = await api.getMessages(session.id);
    setActiveSession(session);
    setMessages(msgs);
    setViewMode('chat');
    setSidebarOpen(false);
    setMentalHealthView(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await api.deleteSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setMessages([]);
      setViewMode('welcome');
      setMentalHealthView(false);
    }
  };

  const handleSend = async (text: string) => {
    if (!activeSession || isLoading) return;

    const userMessage: Message = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setIsTyping(true);

    // 先尝试流式
    const streamDone = await handleSendStream(activeSession.id, text, userMessage.id);
    if (streamDone) {
      setIsLoading(false);
      setIsTyping(false);
      return;
    }

    // 降级到同步请求
    try {
      const response = await api.sendMessage(activeSession.id, text);
      setIsTyping(false);

      if (response.message) {
        const assistantMessage: Message = {
          id: 'msg_' + (Date.now() + 1),
          role: 'assistant',
          content: response.message,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      if (response.sessionUpdated) {
        setActiveSession(response.sessionUpdated);
        setSessions((prev) =>
          prev.map((s) => s.id === response.sessionUpdated!.id ? response.sessionUpdated! : s)
        );
      }
    } catch {
      setIsTyping(false);
      const errorMsg: Message = {
        id: 'msg_' + Date.now(),
        role: 'assistant',
        content: '抱歉，我遇到了一些问题，请稍后再试。',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // 流式发送：返回 true 表示成功，false 表示降级
  const handleSendStream = async (sessionId: string, text: string, userMsgId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/sessions/' + encodeURIComponent(sessionId) + '/messages/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok || !res.body) return false;

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let currentText = '';
      let assistantMsgId = 'msg_' + (Date.now() + 1);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按 \n\n 分割 SSE 事件
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const lines = part.trim().split('\n');
          let eventType = '';
          let eventData = '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            else if (line.startsWith('data:')) eventData = line.slice(5).trim();
          }
          if (!eventData) continue;

          if (eventType === 'text_delta') {
            const { text: delta } = JSON.parse(eventData);
            currentText += delta;
            setMessages((prev) => {
              const updated = prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: currentText } : m
              );
              if (!updated.find((m) => m.id === assistantMsgId)) {
                updated.push({ id: assistantMsgId, role: 'assistant', content: currentText, timestamp: Date.now() });
              }
              return updated;
            });
          } else if (eventType === 'done') {
            const { reply } = JSON.parse(eventData);
            // 确保最终文本完整
            setMessages((prev) => prev.map((m) => m.id === assistantMsgId ? { ...m, content: reply } : m));
            setIsTyping(false);
          } else if (eventType === 'session_updated') {
            const updated = JSON.parse(eventData);
            setActiveSession(updated);
            setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
          } else if (eventType === 'error') {
            const { error } = JSON.parse(eventData);
            setMessages((prev) => [...prev, { id: 'msg_err', role: 'assistant', content: '抱歉，处理消息时出现错误：' + error, timestamp: Date.now() }]);
            setIsTyping(false);
          }
        }
      }

      reader.releaseLock();
      return true;
    } catch {
      return false;
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    void handleSend(prompt);
  };

  const handleMentalHealth = () => {
    setMentalHealthView(true);
    setViewMode('assessment');
  };

  return (
    <div className='app-container'>
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSession?.id}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className='chat-main'>
        {viewMode === 'chat' && activeSession ? (
          <>
            <ChatHeader
              session={activeSession}
              onMenuClick={() => setSidebarOpen(true)}
            />
            <MessageList
              messages={messages}
              isTyping={isTyping}
              endRef={messagesEndRef}
            />
            <ChatInput
              onSend={handleSend}
              isLoading={isLoading}
              onQuickPrompt={handleQuickPrompt}
            />
          </>
        ) : (
            mentalHealthView ? (
              <div className="assessment-view"><MentalHealthAssessment /></div>
            ) : (
              <WelcomeScreen
                onNewChat={handleNewSession}
                recentSessions={sessions.slice(0, 4)}
                onSelectSession={handleSelectSession}
                onMentalHealth={handleMentalHealth}
              />
            )
        )}
      </div>
    </div>
  );
}
