import { useRef, useEffect } from "react";
import type { Message } from "../types";

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
  endRef: React.RefObject<HTMLDivElement>;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageList({ messages, isTyping, endRef }: MessageListProps) {
  const prevLength = useRef(messages.length);

  useEffect(() => {
    if (messages.length > prevLength.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLength.current = messages.length;
  }, [messages, endRef]);

  if (messages.length === 0 && !isTyping) {
    return null;
  }

  return (
    <div className="chat-messages">
      {messages.map((msg, i) => {
        const prevMsg = messages[i - 1];
        const showAvatar = !prevMsg || prevMsg.role !== msg.role;
        return (
          <div key={msg.id} className="message-group">
            {showAvatar && msg.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-primary-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 4 }}>
                🌿
              </div>
            )}
            {showAvatar && msg.role === "user" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 4, color: "white" }}>
                👤
              </div>
            )}
            {!showAvatar && <div style={{ width: 28 }} />}
            <div className="message-bubble">{msg.content}</div>
            <div className="message-time">{formatTime(msg.timestamp)}</div>
          </div>
        );
      })}
      {isTyping && (
        <div className="message-group agent">
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-primary-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 4 }}>🌿</div>
          <div className="typing-indicator">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
