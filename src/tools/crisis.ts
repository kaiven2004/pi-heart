// 危机检测工具

import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TextContent } from "@earendil-works/pi-ai";

export interface CrisisResult {
  isCrisis: boolean;
  riskLevel: "none" | "low" | "medium" | "high";
  triggeredKeywords: string[];
  intervention: string;
}

const CRISIS_PATTERNS: { keywords: string[]; riskLevel: CrisisResult["riskLevel"]; intervention: string }[] = [
  {
    keywords: ["自杀", "想死", "自残", "自伤", "结束生命", "轻生"],
    riskLevel: "high",
    intervention: "【危机干预】检测到用户可能有自杀或自残倾向。请立即表达关心，不要评判。提供以下心理援助热线：\n全国心理援助热线：400-161-9995（24小时）\n北京心理危机干预中心：010-82951332（24小时）\n建议您立即寻求专业帮助，或联系信任的家人朋友。您并不孤单。",
  },
  {
    keywords: ["不想活", "活着没意义", "活不下去", "没有未来", "不想在这个世界"],
    riskLevel: "high",
    intervention: "【危机干预】检测到强烈的绝望感。请表达您的感受是被理解和重视的。\n全国心理援助热线：400-161-9995（24小时）\n北京心理危机干预中心：010-82951332",
  },
  {
    keywords: ["割腕", "跳楼", "跳河", "吃药自杀", "伤害自己"],
    riskLevel: "high",
    intervention: "【危机干预】检测到自伤行为的具体计划。这是紧急情况，请立即帮助。\n全国心理援助热线：400-161-9995（24小时）\n北京心理危机干预中心：010-82951332\n如有紧急危险，请立即拨打 110 或前往最近医院急诊。\n您的生命无比珍贵，请给专业帮助一个机会。",
  },
  {
    keywords: ["撑不住了", "崩溃", "无法承受", "太痛苦了", "受不了"],
    riskLevel: "medium",
    intervention: "【中等风险】检测到用户处于高度痛苦状态。请表达共情，帮助其寻找当下可以做的事情。\n全国心理援助热线：400-161-9995\n北京心理危机干预中心：010-82951332",
  },
  {
    keywords: ["孤独", "没人理解", "没有人陪", "被抛弃"],
    riskLevel: "low",
    intervention: "【低风险】检测到孤独感。这是正常的人类情绪，可以提供支持性倾听。",
  },
];

export function detectCrisis(text: string): CrisisResult {
  let triggeredKeywords: string[] = [];
  let riskLevel: CrisisResult["riskLevel"] = "none";
  let intervention = "";

  for (const pattern of CRISIS_PATTERNS) {
    const matched = pattern.keywords.filter((kw) => text.includes(kw));
    if (matched.length > 0) {
      triggeredKeywords.push(...matched);
      const order: CrisisResult["riskLevel"][] = ["none", "low", "medium", "high"];
      const currentIdx = order.indexOf(riskLevel);
      const newIdx = order.indexOf(pattern.riskLevel);
      if (newIdx > currentIdx) {
        riskLevel = pattern.riskLevel;
        intervention = pattern.intervention;
      }
    }
  }

  return {
    isCrisis: riskLevel !== "none",
    riskLevel,
    triggeredKeywords: [...new Set(triggeredKeywords)],
    intervention,
  };
}

export const CrisisDetectorTool: AgentTool = {
  name: "crisis_detector",
  label: "危机检测",
  description: "检测用户输入中的危机信号（自杀、自残、强烈绝望等）。返回风险等级和干预建议。当检测到危机信号时，agent 应立即停止常规对话并执行危机干预流程。",
  parameters: Type.Object({
    text: Type.String({ description: "要检测的用户输入文本" }),
  }),
  async execute(_toolCallId, params) {
    const p = params as { text: string };
    const result = detectCrisis(p.text);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }] as TextContent[],
      details: result,
    };
  },
};

