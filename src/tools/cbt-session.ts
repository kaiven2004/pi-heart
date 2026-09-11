// CBT 结构化对话流程
// 引导用户完成完整的认知重构练习

import { Type } from 'typebox';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { TextContent } from '@earendil-works/pi-ai';

// CBT 思维记录表
export interface ThoughtRecord {
  id: string;
  situation: string;
  automaticThought: string;
  emotion: string;
  emotionIntensity: number;
  cognitiveDistortion: string | null;
  evidenceFor: string;
  evidenceAgainst: string;
  alternativeThought: string;
  newEmotion: string;
  newEmotionIntensity: number;
  behavioralExperiment: string;
  createdAt: number;
}

const DISTORTION_MAP: Record<string, string[]> = {
  '灾难化思维': ['肯定', '一定', '绝对会', '肯定完蛋', '彻底毁了', '全完了', '没希望了'],
  '非黑即白': ['完全', '毫无', '总是', '从不', '一切', '什么都', '什么都没', '必须', '只能'],
  '过度概括': ['每次都', '从来都', '总是', '所有', '永远', '每一个人', '所有人'],
  '个人化': ['都是我的错', '都是我', '因为我', '我害的', '我的问题', '都是我不好'],
  '情绪推理': ['我感觉', '我觉得', '我肯定', '我预感到'],
  '心理过滤': ['只看到', '只看', '只有', '忽略', '没注意'],
  '读心术': ['他肯定觉得', '她知道', '他们一定', '别人都', '大家肯定'],
  '应该陈述': ['应该', '必须', '不能', '不该', '必须得', 'ought to'],
  '标签化': ['我是个失败者', '我是个废物', '我很糟糕', '我没用', '我太'],
  '放大缩小': ['一点', '没什么', '太严重', '太可怕', '微不足道'],
};

const SOCRATIC_QUESTIONS: Record<string, string[]> = {
  '灾难化思维': [
    '最坏的情况真的会发生吗？概率有多大？',
    '即使最坏的情况发生，你真的无法应对吗？',
    '过去有没有类似的情况，结果真的那么糟吗？',
    '有没有更可能的结果，而不是最坏的结果？',
  ],
  '非黑即白': [
    '这件事有没有中间地带？',
    '如果满分10分，你会给这次表现打几分？',
    '有没有既不完全成功也不完全失败的状态？',
  ],
  '过度概括': [
    '这是一次例外还是普遍情况？',
    '有没有反例可以证明这个想法是片面的？',
    '如果用"这次"代替"每次"，说法会有什么不同？',
  ],
  '个人化': [
    '这件事有多少是由你控制的？',
    '其他人是否也有责任？',
    '如果你朋友遇到同样的情况，你会怪他吗？',
  ],
  '情绪推理': [
    '感受是事实吗？有什么客观证据？',
    '如果你心情好的时候，对这个想法会有什么不同看法？',
    '有没有其他解释可以说明你的感受？',
  ],
  '心理过滤': [
    '你有没有忽略掉一些正面的信息？',
    '如果把这件事写成报道，会包含哪些正面和负面的内容？',
    '你的朋友会怎么评价这件事？',
  ],
  '读心术': [
    '你有什么证据确定别人在想什么？',
    '有没有其他可能的解释？',
    '如果你是对方，你会怎么想？',
  ],
  '应该陈述': [
    '这个"应该"是从哪里来的？是谁定的规则？',
    '如果不用"应该"，你会怎么描述这件事？',
    '你对自己的要求合理吗？',
  ],
  '标签化': [
    '一个人能做一件事不好，就等于他整个人不好吗？',
    '你会用这个词形容你最好的朋友吗？',
    '有没有比这个标签更准确、更具体的描述？',
  ],
  '放大缩小': [
    '如果把这件事放在一年的尺度上看，它还重要吗？',
    '你会对朋友说这件事很严重吗？',
    '客观地看，这件事的影响到底有多大的？',
  ],
};

export function detectDistortion(text: string): string | null {
  let bestMatch: string | null = null;
  let bestScore = 0;
  for (const [name, keywords] of Object.entries(DISTORTION_MAP)) {
    const score = keywords.filter((kw) => text.includes(kw)).length;
    if (score > bestScore) { bestScore = score; bestMatch = name; }
  }
  return bestScore > 0 ? bestMatch : null;
}

function getSocraticQuestions(distortion: string): string[] {
  return SOCRATIC_QUESTIONS[distortion] ?? SOCRATIC_QUESTIONS['灾难化思维'];
}

// 思维记录表工具
export const ThoughtRecordTool: AgentTool = {
  name: 'cbt_thought_record',
  label: 'CBT思维记录表',
  description: '创建完整的CBT思维记录表。引导用户填写：触发事件、自动思维、情绪和强度、认知扭曲识别、证据分析、替代思维、行为实验。当用户表达引发负面情绪的想法时使用。',
  parameters: Type.Object({
    situation: Type.String({ description: '触发情绪的事件或情境' }),
    automaticThought: Type.String({ description: '当时脑海中闪过的第一个想法' }),
    emotion: Type.String({ description: '产生的情绪名称' }),
    emotionIntensity: Type.Number({ description: '情绪强度 0-100', minimum: 0, maximum: 100 }),
  }),
  async execute(_toolCallId, params) {
    const p = params as { situation: string; automaticThought: string; emotion: string; emotionIntensity: number };
    const distortion = detectDistortion(p.automaticThought);
    const questions = distortion ? getSocraticQuestions(distortion) : SOCRATIC_QUESTIONS['灾难化思维'].slice(0, 3);
    const record: ThoughtRecord = {
      id: 'tr_' + Date.now(),
      situation: p.situation,
      automaticThought: p.automaticThought,
      emotion: p.emotion,
      emotionIntensity: p.emotionIntensity,
      cognitiveDistortion: distortion,
      evidenceFor: '',
      evidenceAgainst: '',
      alternativeThought: '',
      newEmotion: p.emotion,
      newEmotionIntensity: p.emotionIntensity,
      behavioralExperiment: '',
      createdAt: Date.now(),
    };
    return { content: [{ type: 'text', text: JSON.stringify({ record, distortion, questions }, null, 2) }] as TextContent[], details: { record, distortion, questions } };
  },
};

// 行为激活规划工具
export const BehavioralActivationTool: AgentTool = {
  name: 'cbt_behavioral_activation',
  label: 'CBT行为激活',
  description: '帮助用户制定行为激活计划。当用户情绪低落、缺乏动力时，引导其从小事开始逐步恢复活动。基于行为激活原理：行动先于动力。',
  parameters: Type.Object({
    currentMood: Type.String({ description: '当前情绪状态描述' }),
    energyLevel: Type.Number({ description: '当前精力水平 1-10', minimum: 1, maximum: 10 }),
    interests: Type.Array(Type.String(), { description: '曾经带来满足感的活动列表' }),
  }),
  async execute(_toolCallId, params) {
    const p = params as { currentMood: string; energyLevel: number; interests: string[] };
    const difficultyMap: Record<number, string> = {1:'极低',2:'很低',3:'较低',4:'中等偏低',5:'中等',6:'中等偏高',7:'较高',8:'高',9:'很高',10:'极高'};
    const difficulty = difficultyMap[p.energyLevel] ?? '中等';
    const simpleActivities = p.interests.filter((a) => /休息|散步|听|看|泡|喝|睡|冥想|发呆/.test(a));
    const moderateActivities = p.interests.filter((a) => !/休息|散步|听|看|泡|喝|睡|冥想|发呆/.test(a) && /运动|健身|跑步|游泳|打球|户外/.test(a));
    const socialActivities = p.interests.filter((a) => /见|约|聚|聊|社交|和朋友|打电话/.test(a));
    const suggestions = p.energyLevel <= 3
      ? (simpleActivities.length > 0 ? simpleActivities : ['深呼吸5分钟', '窗外看看', '喝杯温水'])
      : p.energyLevel <= 6
        ? [...simpleActivities.slice(0, 2), ...moderateActivities.slice(0, 2)]
        : [...moderateActivities.slice(0, 2), ...socialActivities.slice(0, 1)];
    const reason = p.energyLevel <= 3
      ? '精力较低时，从最简单的小事开始，不给自己压力。完成小事本身就是一种成功。'
      : p.energyLevel <= 6
        ? '中等精力时，可以尝试一些中等难度的活动，逐步提升状态。'
        : '精力较好时，可以尝试更有挑战性的活动。';
    return {
      content: [{ type: 'text', text: JSON.stringify({ mood: p.currentMood, energyLevel: p.energyLevel, difficulty, suggestions, reason }, null, 2) }] as TextContent[],
      details: { mood: p.currentMood, energyLevel: p.energyLevel, difficulty, suggestions, reason },
    };
  },
};

// 情绪日记工具
export const MoodJournalTool: AgentTool = {
  name: 'cbt_mood_journal',
  label: 'CBT情绪日记',
  description: '帮助用户记录当天情绪变化，追踪情绪模式。记录时间、情绪、强度、触发事件、想法，帮助发现情绪规律。',
  parameters: Type.Object({
    entries: Type.Array(Type.Object({
      time: Type.String({ description: '时间点' }),
      emotion: Type.String({ description: '情绪名称' }),
      intensity: Type.Number({ description: '强度0-100', minimum: 0, maximum: 100 }),
      trigger: Type.String({ description: '触发事件' }),
      thought: Type.String({ description: '当时想到的内容' }),
    }), { minItems: 1 }),
  }),
  async execute(_toolCallId, params) {
    const p = params as { entries: Array<{ time: string; emotion: string; intensity: number; trigger: string; thought: string }> };
    const avgIntensity = p.entries.reduce((s, e) => s + e.intensity, 0) / p.entries.length;
    const peakEmotion = p.entries.reduce((max, e) => e.intensity > max.intensity ? e : max, p.entries[0]);
    const commonDistortions = p.entries.map((e) => detectDistortion(e.thought)).filter(Boolean);
    const distortionCount: Record<string, number> = {};
    for (const d of commonDistortions) { distortionCount[d!] = (distortionCount[d!] ?? 0) + 1; }
    const topDistortion = Object.entries(distortionCount).sort((a, b) => b[1] - a[1])[0];
    const summary = {
      entries: p.entries,
      avgIntensity: Math.round(avgIntensity),
      peakEmotion: peakEmotion.emotion,
      peakIntensity: peakEmotion.intensity,
      peakTime: peakEmotion.time,
      topDistortion: topDistortion ? topDistortion[0] + '（出现' + topDistortion[1] + '次）' : '未检测到明显认知扭曲',
      pattern: avgIntensity > 70 ? '今天整体情绪偏高，建议关注压力源' : avgIntensity > 50 ? '今天有一些负面情绪，可以尝试认知重构' : '今天情绪相对平稳，继续保持自我关怀',
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] as TextContent[],
      details: summary,
    };
  },
};
