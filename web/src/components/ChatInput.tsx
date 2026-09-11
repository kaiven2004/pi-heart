import { useState, useRef, useEffect, useCallback } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  onQuickPrompt?: (prompt: string) => void;
}

const QUICK_PROMPTS = [
  { text: '我最近压力很大', icon: '😰' },
  { text: '我总是焦虑不安', icon: '😟' },
  { text: '我睡不着觉', icon: '🌙' },
  { text: '我和家人的关系出了问题', icon: '💭' },
];

export default function ChatInput({ onSend, isLoading, onQuickPrompt }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div className='chat-input-area'>
      {onQuickPrompt && (
        <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.text}
              className='quick-prompt-btn'
              onClick={() => onQuickPrompt(p.text)}
              disabled={isLoading}
            >
              {p.icon} {p.text}
            </button>
          ))}
        </div>
      )}
      <div className='chat-input-container'>
        <textarea
          ref={textareaRef}
          className='chat-textarea'
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder='和心语说说你的感受...'
          rows={1}
          disabled={isLoading}
        />
        <button
          className='chat-send-btn'
          onClick={handleSubmit}
          disabled={isLoading || !text.trim()}
          aria-label='发送'
        >
          {isLoading ? '...' : '↑'}
        </button>
      </div>
      <div className='chat-input-hint'>按 Enter 发送，Shift+Enter 换行</div>
    </div>
  );
}
