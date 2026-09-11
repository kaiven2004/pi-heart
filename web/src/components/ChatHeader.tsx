import type { Session } from '../types';

interface ChatHeaderProps {
  session: Session;
  onMenuClick: () => void;
}

export default function ChatHeader({ session, onMenuClick }: ChatHeaderProps) {
  return (
    <header className='chat-header'>
      <div className='chat-header-left'>
        <button className='sidebar-toggle' onClick={onMenuClick}>☰</button>
        <div className='chat-header-avatar'>🌿</div>
        <div className='chat-header-info'>
          <h1>心语</h1>
          <p>{session.title}</p>
        </div>
      </div>
      <div className='chat-header-status'>
        <span className='status-dot' />
        在线
      </div>
    </header>
  );
}
