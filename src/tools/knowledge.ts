// 知识库检索工具
// 从本地 Markdown 知识库中检索相关信息

import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TextContent } from "@earendil-works/pi-ai";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KNOWLEDGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../knowledge");

export interface KnowledgeEntry {
  topic: string;
  source: string;
  content: string;
  relevance: number;
}

/**
 * 扫描知识库目录，读取所有 Markdown 文件
 */
function loadAllKnowledge(): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];

  function scanDir(dir: string, relativePath: string) {
    if (!existsSync(dir)) return;
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = require("node:fs").statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath, join(relativePath, item));
      } else if (item.endsWith(".md")) {
        const content = readFileSync(fullPath, "utf-8");
        // 提取标题作为主题
        const titleMatch = content.match(/^# (.+)$/m);
        const topic = titleMatch ? titleMatch[1].trim() : item.replace(".md", "");
        entries.push({
          topic,
          source: relativePath || "general",
          content,
          relevance: 0,
        });
      }
    }
  }

  scanDir(KNOWLEDGE_DIR, "");
  return entries;
}

// 全局加载知识库（惰性加载）
let _knowledgeCache: KnowledgeEntry[] | null = null;

function getKnowledge(): KnowledgeEntry[] {
  if (!_knowledgeCache) {
    _knowledgeCache = loadAllKnowledge();
  }
  return _knowledgeCache;
}

// 主题关键词映射（用于加权匹配）
const TOPIC_KEYWORDS: Record<string, string[]> = {
  // 弗洛伊德
  "弗洛伊德": ["弗洛伊德", "freud", "精神分析", "潜意识", "本我", "自我", "超我", "俄狄浦斯", "力比多", "死本能", "生本能"],
  "梦的解析": ["梦", "梦境", "解梦", "显梦", "隐梦", "愿望满足", "潜意识欲望"],
  "日常心理病理": ["口误", "笔误", "遗忘", "失误", "强迫行为", "潜意识冲突"],
  "防御机制": ["压抑", "否认", "投射", "移置", "反向形成", "升华", "退行", "防御", "mechanism"],
  "依恋理论": ["依恋", "鲍尔比", "安全型", "焦虑型", "回避型", "母婴关系", "童年关系"],
  "情绪调节": ["情绪", "调节", "焦虑", "抑郁", "正念", "认知重评"],
  "CBT": ["认知行为", "CBT", "认知扭曲", "思维记录", "行为激活", "暴露疗法"],
  "焦虑": ["焦虑", "紧张", "担心", "恐惧", "panic", "恐慌"],
  "抑郁": ["抑郁", "哀悼", "忧郁", "难过", "沮丧", "心情低落"],
  "压力": ["压力", "stress", "崩溃", "累", "喘不过气"],
  "失眠": ["失眠", "睡不着", "睡眠", "sleep"],
  "关系": ["关系", "感情", "朋友", "恋爱", "家人", "亲密", "attachment"],
  "文明不满": ["文明", "文化", "不满", "幸福", "本能压抑"],
  "自我本我": ["自我", "本我", "超我", "ego", "id", "superego"],
  "死本能": ["死本能", "thanatos", "攻击", "破坏", "生命本能", "erős"],
};

/**
 * 搜索知识库，返回匹配的结果
 */
export function searchKnowledge(query: string): KnowledgeEntry[] {
  const allKnowledge = getKnowledge();
  const queryLower = query.toLowerCase();
  const results: KnowledgeEntry[] = [];

  for (const entry of allKnowledge) {
    let score = 0;
    const entryText = (entry.topic + " " + entry.content).toLowerCase();

    // 1. 直接内容匹配
    if (entryText.includes(queryLower)) {
      score += 2;
    }

    // 2. 主题关键词加权
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      const matched = keywords.filter((kw) => queryLower.includes(kw.toLowerCase()));
      if (matched.length > 0) {
        // 检查这个 entry 是否属于该主题
        const entryKeywords = keywords.filter((kw) => entryText.includes(kw.toLowerCase()));
        if (entryKeywords.length > 0) {
          score += matched.length * entryKeywords.length;
        }
      }
    }

    // 3. 来源匹配（优先返回来源匹配的结果）
    if (entry.source && queryLower.includes(entry.source.toLowerCase())) {
      score += 3;
    }

    if (score > 0) {
      results.push({ ...entry, relevance: score });
    }
  }

  // 按相关性排序
  results.sort((a, b) => b.relevance - a.relevance);
  return results;
}

/**
 * 格式化搜索结果，截断过长内容
 */
function formatResult(entry: KnowledgeEntry, maxLines: number = 20): string {
  const lines = entry.content.split("\n").filter((l) => l.trim());
  const preview = lines.slice(0, maxLines).join("\n");
  const truncated = lines.length > maxLines ? `\n\n...（共 ${lines.length} 行，已截断）` : "";
  return `## ${entry.topic} [${entry.source}]${truncated}\n\n${preview}`;
}

export const KnowledgeRetrieverTool: AgentTool = {
  name: "knowledge_retriever",
  label: "知识检索",
  description:
    "从心理学知识库中检索相关信息。包含弗洛伊德精神分析理论、CBT认知行为疗法、依恋理论、防御机制等。适用于用户询问具体的心理问题、应对策略、心理健康知识等问题。",
  parameters: Type.Object({
    query: Type.String({ description: "用户的查询内容" }),
  }),
  async execute(_toolCallId, params) {
    const p = params as { query: string };
    const results = searchKnowledge(p.query);

    if (results.length === 0) {
      return {
        content: [{ type: "text", text: "未找到相关信息。请尝试其他关键词。" }] as TextContent[],
        details: { results: [], count: 0 },
      };
    }

    // 只返回前3个最相关结果的摘要
    const formatted = results.slice(0, 3).map((r) => formatResult(r)).join("\n\n---\n\n");

    return {
      content: [{ type: "text", text: formatted }] as TextContent[],
      details: {
        results: results.map((r) => ({ topic: r.topic, source: r.source, relevance: r.relevance })),
        count: results.length,
      },
    };
  },
};

