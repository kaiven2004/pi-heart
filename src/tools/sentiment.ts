// 情绪分析工具

import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TextContent } from "@earendil-works/pi-ai";

export interface SentimentResult {
  emotions: string[];
  intensity: number;
  valence: "positive" | "neutral" | "negative";
  keywords: string[];
  summary: string;
}

const EMOTION_PATTERNS: Record<string, { keywords: string[]; intensity: number }> = {
  anxiety: {
    keywords: ["焦虑", "紧张", "担心", "害怕", "恐惧", "不安", "心慌", "担忧", "焦虑症"],
    intensity: 7,
  },
  depression: {
    keywords: ["抑郁", "难过", "沮丧", "失落", "空虚", "无助", "绝望", "痛苦", "心情低落"],
    intensity: 8,
  },
  stress: {
    keywords: ["压力", "崩溃", "累", "疲惫", "不堪重负", "喘不过气"],
    intensity: 6,
  },
  anger: {
    keywords: ["生气", "愤怒", "烦躁", "恼火", "恨", "不公平"],
    intensity: 6,
  },
  loneliness: {
    keywords: ["孤独", "孤单", "没人理解", "没有人", "孤立", "疏离"],
    intensity: 5,
  },
  shame: {
    keywords: ["羞耻", "愧疚", "内疚", "丢脸", "没用", "废物"],
    intensity: 7,
  },
  hope: {
    keywords: ["希望", "期待", "开心", "感激", "温暖", "感恩", "幸福"],
    intensity: 5,
  },
};

const CRISIS_KEYWORDS = [
  "自杀", "自残", "自伤", "不想活", "活着没意义", "想死", "结束生命",
  "伤害自己", "活不下去", "没有未来", "不想在这个世界", "轻生",
  "割腕", "跳楼", "跳河", "吃药自杀",
];

export function extractCrisisKeywords(text: string): string[] {
  return CRISIS_KEYWORDS.filter((kw) => text.includes(kw));
}

export function analyzeSentiment(text: string): SentimentResult {
  const emotions: string[] = [];
  const keywords: string[] = [];
  let maxIntensity = 0;

  for (const [emotion, pattern] of Object.entries(EMOTION_PATTERNS)) {
    const matched = pattern.keywords.filter((kw) => text.includes(kw));
    if (matched.length > 0) {
      emotions.push(emotion);
      keywords.push(...matched);
      maxIntensity = Math.max(maxIntensity, pattern.intensity);
    }
  }

  const intensity = Math.min(10, maxIntensity + keywords.length * 0.5);
  const hasPositive = emotions.some((e) => e === "hope");
  const hasNegative = emotions.some((e) => e !== "hope");
  let valence: "positive" | "neutral" | "negative" = "neutral";
  if (hasNegative && !hasPositive) valence = "negative";
  if (hasPositive && !hasNegative) valence = "positive";

  const emotionNames: Record<string, string> = {
    anxiety: "焦虑", depression: "抑郁", stress: "压力",
    anger: "愤怒", loneliness: "孤独", shame: "羞耻", hope: "希望",
  };
  const emotionDesc = emotions.map((e) => emotionNames[e] ?? e).join("、");

  return {
    emotions,
    intensity: Math.round(intensity * 10) / 10,
    valence,
    keywords,
    summary: hasNegative
      ? `检测到${emotionDesc}情绪，强度约${Math.round(intensity)}/10`
      : "未检测到明显负面情绪",
  };
}

export const SentimentAnalyzerTool: AgentTool = {
  name: "sentiment_analyzer",
  label: "情绪分析",
  description: "分析用户输入的情绪状态，返回情绪类型、强度和效价。用于在对话中实时了解用户心理状态。",
  parameters: Type.Object({
    text: Type.String({ description: "要分析的用户输入文本" }),
  }),
  async execute(_toolCallId, params) {
    const p = params as { text: string };
    const result = analyzeSentiment(p.text);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }] as TextContent[],
      details: result,
    };
  },
};

