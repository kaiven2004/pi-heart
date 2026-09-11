import { useState } from 'react';
import { mentalHealthApi } from '../api';

interface Question {
  id: string;
  question: string;
  category: string;
  options: string[];
}

interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  checked: boolean;
}

interface CategoryScores {
  mood?: number;
  anxiety?: number;
  social?: number;
  sleep?: number;
  self_worth?: number;
  work?: number;
}

interface AssessmentResult {
  score: number;
  maxScore: number;
  level: string;
  levelLabel: string;
  categoryScores: CategoryScores;
  suggestions: Suggestion[];
}

interface HistoryItem {
  date: string;
  score: number;
  maxScore: number;
  level: string;
  levelLabel: string;
  categoryScores: CategoryScores;
  suggestions: Suggestion[];
}

type Step = 'idle' | 'questions' | 'results' | 'history';

const CATEGORY_LABELS: Record<string, string> = {
  mood: '情绪状态',
  anxiety: '焦虑水平',
  social: '社交关系',
  sleep: '睡眠质量',
  self_worth: '自我价值',
  work: '工作/学习',
};

const DIFFICULTY_LABELS = { easy: '简单', medium: '中等', hard: '困难' };
const DIFFICULTY_COLORS = { easy: '#4ade80', medium: '#facc15', hard: '#f87171' };
const CAT_COLORS: Record<string, string> = {
  mood: '#818cf8',
  anxiety: '#f472b6',
  social: '#34d399',
  sleep: '#60a5fa',
  self_worth: '#fbbf24',
  work: '#fb923c',
};

export default function MentalHealthAssessment() {
  const [step, setStep] = useState<Step>('idle');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);

  const startAssessment = async () => {
    setLoading(true);
    try {
      const data = await mentalHealthApi.start();
      setQuestions(data.questions);
      setStep('questions');
    } catch {
      alert('加载评估题目失败');
    } finally {
      setLoading(false);
    }
  };

  const submitAssessment = async () => {
    setLoading(true);
    try {
      const data = await mentalHealthApi.submit(answers);
      setResult(data);
      setStep('results');
    } catch {
      alert('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await mentalHealthApi.history();
      setHistory(data.history);
      setStep('history');
    } catch {
      setHistory([]);
      setStep('history');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!result) return;
    const task = result.suggestions.find(s => s.id === taskId);
    if (!task || task.checked) return;
    try {
      const data = await mentalHealthApi.completeTask(taskId);
      if (data.success) {
        setResult({
          ...result,
          suggestions: result.suggestions.map(s => s.id === taskId ? { ...s, checked: true } : s),
        });
      }
    } catch {
      alert('更新失败');
    }
  };

  const handleViewHistory = (item: HistoryItem) => {
    setSelectedHistory(item);
  };

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  if (step === 'idle') {
    return (
      <div className="mh-assessment">
        <div className="mh-header">
          <div className="mh-icon">🧠</div>
          <div>
            <h2 className="mh-title">心理健康自测</h2>
            <p className="mh-desc">通过 14 道题目评估你的心理健康状态，生成个性化改善建议</p>
          </div>
        </div>
        <button className="mh-start-btn" onClick={startAssessment} disabled={loading}>
          {loading ? '加载中...' : '开始评估'}
        </button>
        <button className="mh-history-btn" onClick={loadHistory} disabled={loading}>
          📋 查看历史评估
        </button>
        <p className="mh-disclaimer">⏱ 约需 2 分钟 · 结果仅作为参考，不替代专业诊断</p>
      </div>
    );
  }

  if (step === 'questions') {
    return (
      <div className="mh-assessment mh-scrollable">
        <div className="mh-header mh-header-sticky">
          <div className="mh-progress">
            <span>{answeredCount} / {questions.length}</span>
            <div className="mh-progress-bar">
              <div className="mh-progress-fill" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
            </div>
          </div>
          <button className="mh-back-btn" onClick={() => setStep('idle')}>← 返回</button>
        </div>
        <div className="mh-questions-scroll">
          {questions.map((q, qi) => (
            <div key={q.id} className="mh-question-card">
              <div className="mh-question-num">第 {qi + 1} 题</div>
              <div className="mh-question-cat" style={{ color: CAT_COLORS[q.category] || '#94a3b8' }}>
                {CATEGORY_LABELS[q.category] || q.category}
              </div>
              <p className="mh-question-text">{q.question}</p>
              <div className="mh-options">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    className={`mh-option ${answers[q.id] === oi ? 'selected' : ''}`}
                    onClick={() => setAnswers({ ...answers, [q.id]: oi })}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mh-footer">
          <button className={`mh-submit-btn ${allAnswered ? 'enabled' : 'disabled'}`} onClick={submitAssessment} disabled={!allAnswered || loading}>
            {loading ? '计算中...' : '查看评估结果'}
          </button>
          {!allAnswered && <p className="mh-hint">请回答所有题目后提交</p>}
        </div>
      </div>
    );
  }

  // 历史记录列表
  if (step === 'history' && !selectedHistory) {
    return (
      <div className="mh-assessment mh-scrollable">
        <div className="mh-header mh-header-sticky">
          <h2 className="mh-title">评估历史</h2>
          <button className="mh-back-btn" onClick={() => setStep('idle')}>← 返回</button>
        </div>
        <div className="mh-questions-scroll">
          {loading ? (
            <p className="mh-loading">加载中...</p>
          ) : history.length === 0 ? (
            <p className="mh-empty">暂无评估记录，开始第一次自测吧！</p>
          ) : (
            history.map((item, idx) => (
              <div key={idx} className="mh-history-item" onClick={() => handleViewHistory(item)}>
                <div className="mh-history-date">{item.date}</div>
                <div className="mh-history-score">{item.score} / {item.maxScore}</div>
                <div className="mh-history-level" style={{ color: CAT_COLORS[item.level] || '#818cf8' }}>{item.levelLabel}</div>
              </div>
            ))
          )}
        </div>
        <div className="mh-footer">
          <button className="mh-start-btn" onClick={startAssessment} disabled={loading}>
            开始新评估
          </button>
        </div>
      </div>
    );
  }

  // 历史记录详情
  if (step === 'history' && selectedHistory) {
    const h = selectedHistory;
    return (
      <div className="mh-assessment mh-scrollable">
        <div className="mh-header mh-header-sticky">
          <div className="mh-score-section">
            <div className="mh-score-circle" style={{ borderColor: CAT_COLORS[h.level] || '#818cf8' }}>
              <span className="mh-score-num">{h.score}</span>
              <span className="mh-score-max">/ {h.maxScore}</span>
            </div>
            <div className="mh-score-info">
              <div className="mh-score-label">{h.levelLabel}</div>
              <div className="mh-score-date">{h.date}</div>
            </div>
          </div>
          <button className="mh-back-btn" onClick={() => setSelectedHistory(null)}>← 返回</button>
        </div>
        <div className="mh-questions-scroll">
          <div className="mh-dimensions">
            <h3 className="mh-section-title">📊 维度分析</h3>
            {Object.entries(h.categoryScores).map(([cat, score]) => (
              <div key={cat} className="mh-dimension-row">
                <span className="mh-dimension-name">{CATEGORY_LABELS[cat] || cat}</span>
                <div className="mh-dimension-bar">
                  <div className="mh-dimension-fill" style={{ width: `${score * 10}%`, backgroundColor: CAT_COLORS[cat] || '#94a3b8' }} />
                </div>
                <span className="mh-dimension-score">{score}/10</span>
              </div>
            ))}
          </div>
          <div className="mh-tasks">
            <h3 className="mh-section-title">🎯 改善建议</h3>
            {h.suggestions.map((s) => (
              <div key={s.id} className={`mh-task-card ${s.checked ? 'done' : ''}`}>
                <div className="mh-task-left">
                  <div className="mh-task-check">{s.checked ? '✓' : ''}</div>
                  <div>
                    <div className="mh-task-title">{s.title}</div>
                    <div className="mh-task-desc">{s.description}</div>
                  </div>
                </div>
                <div className="mh-task-right">
                  <span className="mh-difficulty-badge" style={{ color: DIFFICULTY_COLORS[s.difficulty], background: `${DIFFICULTY_COLORS[s.difficulty]}22` }}>
                    {DIFFICULTY_LABELS[s.difficulty]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mh-footer">
          <button className="mh-retake-btn" onClick={() => { setSelectedHistory(null); setStep('idle'); }}>返回首页</button>
        </div>
      </div>
    );
  }

  // 当前评估结果
  if (step === 'results' && result) {
    return (
      <div className="mh-assessment mh-scrollable">
        <div className="mh-header mh-header-sticky">
          <div className="mh-score-section">
            <div className="mh-score-circle" style={{ borderColor: CAT_COLORS[result.level] || '#818cf8' }}>
              <span className="mh-score-num">{result.score}</span>
              <span className="mh-score-max">/ {result.maxScore}</span>
            </div>
            <div className="mh-score-info">
              <div className="mh-score-label">{result.levelLabel}</div>
              <div className="mh-score-date">评估完成</div>
            </div>
          </div>
          <button className="mh-back-btn" onClick={() => setStep('idle')}>← 返回</button>
        </div>

        <div className="mh-questions-scroll">
          <div className="mh-dimensions">
            <h3 className="mh-section-title">📊 维度分析</h3>
            {Object.entries(result.categoryScores).map(([cat, score]) => (
              <div key={cat} className="mh-dimension-row">
                <span className="mh-dimension-name">{CATEGORY_LABELS[cat] || cat}</span>
                <div className="mh-dimension-bar">
                  <div className="mh-dimension-fill" style={{ width: `${score * 10}%`, backgroundColor: CAT_COLORS[cat] || '#94a3b8' }} />
                </div>
                <span className="mh-dimension-score">{score}/10</span>
              </div>
            ))}
          </div>

          <div className="mh-tasks">
            <h3 className="mh-section-title">🎯 改善建议</h3>
            {result.suggestions.map((s) => (
              <div key={s.id} className={`mh-task-card ${s.checked ? 'done' : ''}`}>
                <div className="mh-task-left">
                  <div className="mh-task-check" onClick={() => !s.checked && handleCompleteTask(s.id)}>
                    {s.checked ? '✓' : ''}
                  </div>
                  <div>
                    <div className="mh-task-title">{s.title}</div>
                    <div className="mh-task-desc">{s.description}</div>
                  </div>
                </div>
                <div className="mh-task-right">
                  <span className="mh-difficulty-badge" style={{ color: DIFFICULTY_COLORS[s.difficulty], background: `${DIFFICULTY_COLORS[s.difficulty]}22` }}>
                    {DIFFICULTY_LABELS[s.difficulty]}
                  </span>
                  <span className="mh-task-points">+{s.points}分</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mh-footer">
          <button className="mh-history-list-btn" onClick={loadHistory}>📋 查看历史评估</button>
          <button className="mh-retake-btn" onClick={startAssessment}>重新评估</button>
        </div>
      </div>
    );
  }

  return null;
}
