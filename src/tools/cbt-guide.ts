// CBT（认知行为疗法）引导工具

import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TextContent } from "@earendil-works/pi-ai";

export interface CBTResult {
  cognitiveDistortion: string | null;
  distortionDescription: string;
  reframingQuestion: string;
  alternativeThought: string;
}

const COGNITIVE_DISTORTIONS: { name: string; keywords: string[]; description: string; reframingQuestion: string; alternativeThought: string }[] = [
  {
    name: "灾难化思维",
    keywords: ["肯定", "一定", "绝对会", "肯定完蛋", "彻底毁了"],
    description: "灾难化思维是指过度夸大负面事件的后果，把小事想象成无法挽回的灾难。",
    reframingQuestion: "最坏的情况真的会发生吗？即使发生了，最可能的结果是什么？",
    alternativeThought: "即使事情不如预期，我也有能力应对。过去我有过类似经历，最终都挺过来了。",
  },
  {
    name: "非黑即白",
    keywords: ["完全", "毫无", "总是", "从不", "一切", "什么都", "什么都没"],
    description: "非黑即白思维是指用极端的两极化方式看待事物，没有中间地带。",
    reframingQuestion: "有没有第三种可能性？这件事在好坏之间还有哪些中间状态？",
    alternativeThought: "事情不是非好即坏的。即使有不完美之处，也不代表完全失败。",
  },
  {
    name: "过度概括",
    keywords: ["每次都", "从来都", "总是", "所有", "永远", "每一个人"],
    description: "过度概括是指从单一事件得出普遍结论，把一次失败当成永远失败。",
    reframingQuestion: "这是一次例外还是普遍情况？有没有反例可以证明这种想法是片面的？",
    alternativeThought: "一次经历不能定义全部。每次情况不同，我也在从中学习和成长。",
  },
  {
    name: "个人化",
    keywords: ["都是我的错", "都是我", "因为我", "我害的", "我的问题"],
    description: "个人化是指把外部事件过度归因于自己，即使自己没有控制力。",
    reframingQuestion: "这件事有多少是我能控制的？其他人是否也有责任？",
    alternativeThought: "很多事情不是我能够控制的。我把责任放在合理的位置上。",
  },
  {
    name: "情绪推理",
    keywords: ["我感觉", "我觉得"],
    description: "情绪推理是指把感受当作事实，因为感到害怕就认为真的危险。",
    reframingQuestion: "我的感受是事实吗？有什么客观证据支持或反对这个想法？",
    alternativeThought: "感受是真实的，但它们不一定是事实。我有能力区分感受和现实。",
  },
];

export function analyzeCognitiveDistortion(text: string): CBTResult {
  let matchedDistortion = COGNITIVE_DISTORTIONS[0];
  let maxScore = 0;

  for (const distortion of COGNITIVE_DISTORTIONS) {
    const score = distortion.keywords.filter((kw) => text.includes(kw)).length;
    if (score > maxScore) {
      maxScore = score;
      matchedDistortion = distortion;
    }
  }

  if (maxScore === 0) {
    return {
      cognitiveDistortion: null,
      distortionDescription: "",
      reframingQuestion: "目前没有检测到明显的认知扭曲模式。可以鼓励用户表达更多想法。",
      alternativeThought: "",
    };
  }

  return {
    cognitiveDistortion: matchedDistortion.name,
    distortionDescription: matchedDistortion.description,
    reframingQuestion: matchedDistortion.reframingQuestion,
    alternativeThought: matchedDistortion.alternativeThought,
  };
}

export const CBTGuideTool: AgentTool = {
  name: "cbt_guide",
  label: "CBT认知重构",
  description:
    "识别用户思维中的认知扭曲（如灾难化、非黑即白、过度概括等），并提供认知重构的引导问题和替代性想法。",
  parameters: Type.Object({
    text: Type.String({ description: "用户的想法或陈述" }),
  }),
  async execute(_toolCallId, params) {
    const p = params as { text: string };
    const result = analyzeCognitiveDistortion(p.text);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }] as TextContent[],
      details: result,
    };
  },
};

