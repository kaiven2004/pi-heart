import { useState } from "react";
import type { Session } from "../types";
import { api } from "../api";

interface SidebarProps {
  sessions: Session[];
  activeSessionId?: string;
  onSelectSession: (session: Session) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession, isOpen, onClose }: SidebarProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleting(id);
    try {
      await api.deleteSession(id);
      onDeleteSession(id);
    } catch {
      alert("删除失败，请稍后重试");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">🌿</div>
            <div>
              <div className="logo-text">心语</div>
              <div className="logo-subtitle">心理健康支持助手</div>
            </div>
          </div>
        </div>

        <button className="sidebar-new-btn" onClick={onNewSession}>
          <span>✦</span> 新对话
        </button>

        <div className="sidebar-section">
          <div className="sidebar-section-title">历史对话</div>
          {sessions.length === 0 ? (
            <div style={{ padding: "16px 8px", fontSize: 13, color: "var(--color-text-muted)", textAlign: "center" }}>
              还没有对话记录
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={"session-item" + (activeSessionId === session.id ? " active" : "")}
                onClick={() => onSelectSession(session)}
              >
                <div className="session-item-header">
                  <span className="session-item-title">{session.title}</span>
                  <span className="session-item-time">{new Date(session.updatedAt).toLocaleDateString("zh-CN")}</span>
                </div>
                <div className="session-item-preview">
                  {session.messageCount} 条消息
                </div>
                <button
                  className="session-delete-btn"
                  onClick={(e) => handleDelete(e, session.id)}
                  disabled={deleting === session.id}
                  title="删除此对话"
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-text-muted)",
                    fontSize: 14,
                    padding: 4,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    opacity: 0,
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                >
                  {deleting === session.id ? "…" : "✕"}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          你的隐私受到保护<br />
          所有对话仅保存在本地
        </div>
      </aside>
    </>
  );
}
