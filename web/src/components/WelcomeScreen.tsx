import type { Session } from '../types';

interface WelcomeScreenProps {
  onNewChat: () => void;
  recentSessions: Session[];
  onSelectSession: (session: Session) => void;
  onMentalHealth?: () => void;
}

const FEATURES = [
  { icon: '🌱', title: '情绪分析', desc: '识别你的情绪状态，帮助你更好地了解自己' },
  { icon: '💬', title: 'CBT 引导', desc: '基于认知行为疗法，帮你调整消极思维模式' },
  { icon: '🛡️', title: '危机支持', desc: '检测到危机信号时，自动提供专业帮助信息' },
  { icon: '📖', title: '心理学知识', desc: '弗洛伊德、CBT、依恋理论等专业知识随时可查' },
  { icon: '🧠', title: '心理健康自测', desc: '14 题快速评估，生成个性化改善建议和积分任务' },
];

export default function WelcomeScreen({ onNewChat, recentSessions, onSelectSession, onMentalHealth }: WelcomeScreenProps) {
  return (
    <div className='welcome-screen'>
      <div className='welcome-icon'>🌿</div>
      <h1 className='welcome-title'>你好，我是心语</h1>
      <p className='welcome-subtitle'>
        一个基于 CBT 原理的心理健康支持助手。<br />
        我会认真倾听，陪你一起面对情绪的挑战。
      </p>

      <div className='welcome-features'>
        {FEATURES.map((f) => (
          <div key={f.title} className='feature-card'>
            <div className='feature-card-icon'>{f.icon}</div>
            <div className='feature-card-title'>{f.title}</div>
            <div className='feature-card-desc'>{f.desc}</div>
          </div>
        ))}
      </div>

      {recentSessions.length > 0 && (
        <div style={{ marginTop: 32, width: '100%', maxWidth: 480 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            最近对话
          </div>
          {recentSessions.map((s) => (
            <div
              key={s.id}
              className='feature-card'
              style={{ marginBottom: 8, cursor: 'pointer' }}
              onClick={() => onSelectSession(s)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{s.title}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{new Date(s.updatedAt).toLocaleDateString('zh-CN')}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{s.messageCount} 条消息</div>
            </div>
          ))}
        </div>
      )}

      {onMentalHealth && (
        <div className='feature-card mh-mental-health-card' onClick={onMentalHealth} style={{ maxWidth: 460, width: '100%', margin: '10px auto 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: '20px 20px', border: '1px solid rgba(102,126,234,0.3)', background: 'linear-gradient(135deg, rgba(102,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%)' }}>
          <div style={{ fontSize: 32, flexShrink: 0, width: 52, height: 52, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(102,126,234,0.3)' }}>🧠</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>心理健康自测</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', lineHeight: 1.6 }}>14 道题目快速评估你的心理健康状态，生成个性化改善建议和积分任务</div>
          </div>
          <span style={{ fontSize: 20, color: '#667eea', flexShrink: 0 }}>→</span>
        </div>
      )}

      <button className='welcome-start-btn' onClick={onNewChat}>
        开始对话
      </button>

      <p style={{ marginTop: 20, fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 360 }}>
        ⚠️ 重要说明：我不是专业心理咨询师，不能替代专业帮助。<br />
        如果你正在经历严重心理困扰，请拨打全国心理援助热线：400-161-9995
      </p>
    </div>
  );
}
