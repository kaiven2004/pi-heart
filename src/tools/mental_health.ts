import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TextContent } from "@earendil-works/pi-ai";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface AssessmentQuestion {
  id: string;
  question: string;
  category: "mood" | "anxiety" | "social" | "sleep" | "work" | "self_worth";
  options: Array<{ text: string; score: number }>;
}

export interface AssessmentSuggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  checked: boolean;
}

export interface HistoryItem {
  date: string;
  score: number;
  maxScore: number;
  level: string;
  levelLabel: string;
  categoryScores: Record<string, number>;
  suggestions: AssessmentSuggestion[];
}

export interface UserData {
  totalScore: number;
  history: HistoryItem[];
}

const LEVEL_LABELS: Record<string, string> = {
  excellent: "优秀",
  good: "良好",
  normal: "正常",
  mild: "轻度困扰",
  moderate: "中度困扰",
  severe: "重度困扰",
};

const QUESTIONS: AssessmentQuestion[] = [
  { id: "mood_1", question: "过去两周，你感到心情低落、沮丧或绝望的频率是？", category: "mood", options: [{ text: "完全没有", score: 10 }, { text: "有几天", score: 8 }, { text: "一半以上天数", score: 5 }, { text: "几乎每天", score: 2 }] },
  { id: "mood_2", question: "你对曾经喜欢做的事情还有兴趣吗？", category: "mood", options: [{ text: "仍然很有兴趣", score: 10 }, { text: "兴趣有所下降", score: 7 }, { text: "兴趣明显减少", score: 4 }, { text: "完全提不起兴趣", score: 2 }] },
  { id: "mood_3", question: "最近你的情绪稳定性如何？", category: "mood", options: [{ text: "很稳定", score: 10 }, { text: "偶尔波动", score: 7 }, { text: "经常波动", score: 4 }, { text: "很难控制情绪", score: 2 }] },
  { id: "anxiety_1", question: "你是否经常感到紧张或担心？", category: "anxiety", options: [{ text: "几乎不紧张", score: 10 }, { text: "偶尔紧张", score: 7 }, { text: "经常紧张", score: 4 }, { text: "几乎总是紧张", score: 2 }] },
  { id: "anxiety_2", question: "面对压力时，你的应对能力如何？", category: "anxiety", options: [{ text: "能很好应对", score: 10 }, { text: "有些吃力", score: 7 }, { text: "很难应对", score: 4 }, { text: "完全无法应对", score: 2 }] },
  { id: "social_1", question: "你与朋友、家人的关系如何？", category: "social", options: [{ text: "关系很好", score: 10 }, { text: "关系一般", score: 7 }, { text: "关系疏远", score: 4 }, { text: "很少与人交流", score: 2 }] },
  { id: "social_2", question: "你在社交场合会感到自在吗？", category: "social", options: [{ text: "很自在", score: 10 }, { text: "有些不自在", score: 7 }, { text: "很不自在", score: 4 }, { text: "非常焦虑", score: 2 }] },
  { id: "sleep_1", question: "你的睡眠质量如何？", category: "sleep", options: [{ text: "很好，睡足7-8小时", score: 10 }, { text: "一般，偶尔失眠", score: 7 }, { text: "较差，经常失眠", score: 4 }, { text: "很差，长期睡眠问题", score: 2 }] },
  { id: "sleep_2", question: "白天你的精力如何？", category: "sleep", options: [{ text: "精力充沛", score: 10 }, { text: "有些疲惫", score: 7 }, { text: "经常很累", score: 4 }, { text: "精疲力竭", score: 2 }] },
  { id: "self_1", question: "你对自己的评价如何？", category: "self_worth", options: [{ text: "很有自信", score: 10 }, { text: "偶尔怀疑自己", score: 7 }, { text: "经常否定自己", score: 4 }, { text: "觉得自己很没用", score: 2 }] },
  { id: "self_2", question: "你对未来的看法如何？", category: "self_worth", options: [{ text: "充满希望", score: 10 }, { text: "有一些担忧", score: 7 }, { text: "感到迷茫", score: 4 }, { text: "毫无希望", score: 2 }] },
  { id: "work_1", question: "你在工作或学习中的专注度如何？", category: "work", options: [{ text: "很专注", score: 10 }, { text: "偶尔分心", score: 7 }, { text: "经常无法专注", score: 4 }, { text: "完全无法集中", score: 2 }] },
  { id: "work_2", question: "你对日常任务的完成情况如何？", category: "work", options: [{ text: "全部完成", score: 10 }, { text: "基本完成", score: 7 }, { text: "经常拖延", score: 4 }, { text: "几乎无法完成", score: 2 }] },
  { id: "mood_4", question: "最近你感到快乐或满足的频率是？", category: "mood", options: [{ text: "经常", score: 10 }, { text: "偶尔", score: 7 }, { text: "很少", score: 4 }, { text: "从未", score: 2 }] },
];

const SUGGESTIONS: Omit<AssessmentSuggestion, "checked">[] = [
  { id: "s1", title: "深呼吸放松练习", description: "每天早晚各做5分钟腹式呼吸，帮助缓解焦虑", category: "anxiety", difficulty: "easy", points: 3 },
  { id: "s2", title: "写感恩日记", description: "睡前写下3件今天值得感谢的小事，提升积极情绪", category: "mood", difficulty: "easy", points: 3 },
  { id: "s3", title: "社交联系", description: "主动联系一位朋友或家人，哪怕只是发条消息", category: "social", difficulty: "medium", points: 5 },
  { id: "s4", title: "规律作息", description: "今晚提前30分钟入睡，保持规律睡眠时间", category: "sleep", difficulty: "easy", points: 3 },
  { id: "s5", title: "运动30分钟", description: "快走、瑜伽或任何你喜欢的运动，释放内啡肽", category: "mood", difficulty: "medium", points: 5 },
  { id: "s6", title: "认知重构练习", description: "写下最近的一个消极想法，找出其中的认知扭曲并重新思考", category: "anxiety", difficulty: "hard", points: 8 },
  { id: "s7", title: "完成一件拖延的事", description: "找出一个你一直在拖延的任务，完成它的一小部分", category: "work", difficulty: "medium", points: 5 },
  { id: "s8", title: "自我肯定", description: "对着镜子说出3个你欣赏自己的特质", category: "self_worth", difficulty: "easy", points: 3 },
  { id: "s9", title: "减少屏幕时间", description: "今晚睡前1小时不使用电子设备", category: "sleep", difficulty: "medium", points: 5 },
  { id: "s10", title: "正念冥想", description: "用10分钟进行正念冥想，专注当下", category: "anxiety", difficulty: "medium", points: 5 },
  { id: "s11", title: "户外散步", description: "在自然环境中散步20分钟，接触阳光", category: "mood", difficulty: "easy", points: 3 },
  { id: "s12", title: "完成今日待办", description: "检查并完成所有今日待办事项", category: "work", difficulty: "hard", points: 8 },
  { id: "s13", title: "帮助他人", description: "为身边的人做一件小事，感受价值感", category: "self_worth", difficulty: "medium", points: 5 },
  { id: "s14", title: "记录情绪变化", description: "用1-10分记录今天的情绪波动，了解触发因素", category: "mood", difficulty: "easy", points: 3 },
];

const MAX_SCORE = QUESTIONS.length * 10; // 140

function getLevel(score: number): { level: UserData["history"][number]["level"]; label: string } {
  const ratio = score / MAX_SCORE;
  if (ratio >= 0.9) return { level: "excellent", label: LEVEL_LABELS.excellent };
  if (ratio >= 0.75) return { level: "good", label: LEVEL_LABELS.good };
  if (ratio >= 0.6) return { level: "normal", label: LEVEL_LABELS.normal };
  if (ratio >= 0.45) return { level: "mild", label: LEVEL_LABELS.mild };
  if (ratio >= 0.3) return { level: "moderate", label: LEVEL_LABELS.moderate };
  return { level: "severe", label: LEVEL_LABELS.severe };
}

function generateAssessment(answers: Record<string, number>) {
  const catGroups: Record<string, { total: number; count: number }> = {};
  for (const q of QUESTIONS) {
    const score = answers[q.id] !== undefined ? q.options[answers[q.id]].score : 5;
    if (!catGroups[q.category]) catGroups[q.category] = { total: 0, count: 0 };
    catGroups[q.category].total += score;
    catGroups[q.category].count++;
  }
  const totalScore = Object.values(catGroups).reduce((s, d) => s + d.total, 0);
  const { level, label: levelLabel } = getLevel(totalScore);

  // 归一化：每维度 ÷ 该维度题目数（满分=题目数×10），再 ×10 得到 0-10 分
  const categoryScores: Record<string, number> = {};
  for (const [cat, data] of Object.entries(catGroups)) {
    categoryScores[cat] = Math.round((data.total / (data.count * 10)) * 10);
  }

  // 根据维度短板排序推荐任务
  const weakness: Record<string, number> = {};
  for (const [cat, score] of Object.entries(categoryScores)) {
    weakness[cat] = score;
  }
  const suggestions = SUGGESTIONS
    .map((s) => ({ ...s, checked: false }))
    .sort((a, b) => (weakness[a.category] ?? 5) - (weakness[b.category] ?? 5))
    .slice(0, 8);

  return { totalScore, level, levelLabel, categoryScores, suggestions };
}

export function generateTool(): AgentTool {
  const dataPath = join(process.env.USERPROFILE || process.env.HOME || "", ".pi-心理", "user_data.json");
  function loadUser(): UserData {
    try { if (existsSync(dataPath)) return JSON.parse(readFileSync(dataPath, "utf-8")); } catch {}
    return { totalScore: 0, history: [] };
  }
  function saveUser(data: UserData): void {
    writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf-8");
  }

  return {
    name: "mental_health_assessment",
    label: "心理健康评估",
    description: "心理健康评估工具。支持：start-开始评估问卷，submit-提交答案，history-查看历史评估记录，complete_task-完成任务获取积分。",
    parameters: Type.Object({
      action: Type.Union([Type.Literal("start"), Type.Literal("submit"), Type.Literal("history"), Type.Literal("complete_task")]),
      answers: Type.Optional(Type.Record(Type.String(), Type.Number())),
      taskId: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params) {
      const p = params as { action: string; answers?: Record<string, number>; taskId?: string };
      const action = p.action;
      let userData = loadUser();
      // 确保历史数据字段存在（兼容旧数据）
      if (!userData.history) userData.history = [];

      const ok = (data: unknown) => ({ details: data, content: [{ type: "text", text: JSON.stringify(data) }] as TextContent[] });
      const err = (msg: string) => ({ details: { error: msg }, content: [{ type: "text", text: JSON.stringify({ error: msg }) }] as TextContent[] });

      if (action === "start") {
        return ok({
          questions: QUESTIONS.map((q) => ({ id: q.id, question: q.question, category: q.category, options: q.options.map((o) => o.text) })),
          totalQuestions: QUESTIONS.length,
          maxScore: MAX_SCORE,
        });
      }

      if (action === "submit") {
        const result = generateAssessment(p.answers || {});
        const date = new Date().toISOString().split("T")[0];
        const entry: HistoryItem = {
          date,
          score: result.totalScore,
          maxScore: MAX_SCORE,
          level: result.level,
          levelLabel: result.levelLabel,
          categoryScores: result.categoryScores,
          suggestions: result.suggestions,
        };
        userData.history.unshift(entry);
        // 只保留最近30条
        if (userData.history.length > 30) userData.history = userData.history.slice(0, 30);
        userData.totalScore = result.totalScore;
        saveUser(userData);
        return ok({
          ...result,
          maxScore: MAX_SCORE,
          suggestions: result.suggestions,
        });
      }

      if (action === "history") {
        return ok({
          history: userData.history ?? [],
          totalScore: userData.totalScore ?? 0,
          maxScore: MAX_SCORE,
        });
      }

      if (action === "complete_task" && p.taskId) {
        const latest = userData.history[0];
        if (!latest) return err("暂无评估记录");
        const task = latest.suggestions.find((s) => s.id === p.taskId);
        if (!task) return err("任务不存在");
        if (task.checked) return ok({ success: false, message: "该任务已完成" });

        // 标记任务完成
        latest.suggestions = latest.suggestions.map((s) => s.id === p.taskId ? { ...s, checked: true } : s);
        saveUser(userData);
        return ok({ success: true, pointsEarned: task.points, message: `已完成「${task.title}」，获得 ${task.points} 分！` });
      }

      return err("未知操作");
    },
  };
}
