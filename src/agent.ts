// Agent 初始化
// 注册工具、构建系统提示词、创建 Agent 实例

import OpenAI from "openai";
import { Agent } from "@earendil-works/pi-agent-core";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { Model } from "@earendil-works/pi-ai";
import { buildSystemPrompt } from "./system-prompt.js";
import {
  SentimentAnalyzerTool,
  CrisisDetectorTool,
  CBTGuideTool,
  KnowledgeRetrieverTool,
  ThoughtRecordTool,
  MoodJournalTool,
  BehavioralActivationTool,
  MentalHealthAssessmentTool,
} from "./tools/index.js";

// 从环境变量读取配置（在 createAgent 内读取，确保 loadEnv() 已执行）
// const API_KEY = process.env.LLM_API_KEY ?? "";
// const BASE_URL = process.env.LLM_BASE_URL ?? "https://apihub.agnes-ai.cn/v1";
// const MODEL_NAME = process.env.LLM_MODEL ?? "agnes-2.0-flash";

// 注册所有工具（含 CBT 结构化流程工具）
const TOOLS = [
  SentimentAnalyzerTool,
  CrisisDetectorTool,
  CBTGuideTool,
  KnowledgeRetrieverTool,
  ThoughtRecordTool,
  MoodJournalTool,
  BehavioralActivationTool,
];

/** 创建 OpenAI 兼容客户端 */
function createLLMClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.LLM_API_KEY ?? "",
    baseURL: process.env.LLM_BASE_URL ?? "https://apihub.agnes-ai.cn/v1",
  });
}

/** 创建 Model 对象 */
function createModel(): Model<any> {
  const model_name = process.env.LLM_MODEL ?? "agnes-2.0-flash";
  return {
    id: model_name,
    name: model_name,
    api: "openai-completions",
    provider: "openai",
    baseUrl: process.env.LLM_BASE_URL ?? "https://apihub.agnes-ai.cn/v1",
    reasoning: false,
    input: ["text"] as ("text" | "image")[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 4096,
  } satisfies Model<any>;
}

/** 将 AgentMessage 转换为 OpenAI API 格式 */
function toOpenAIMessages(messages: any[]): any[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult")
    .map((m) => {
      const msg: any = { role: m.role, content: "" as string };
      if (Array.isArray(m.content)) {
        const textParts = m.content.filter((c: any) => c.type === "text");
        msg.content = textParts.map((c: any) => c.text).join("");
      } else if (typeof m.content === "string") {
        msg.content = m.content;
      }
      if (m.toolCalls) {
        msg.tool_calls = m.toolCalls.map((tc: any) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }));
      }
      return msg;
    });
}

/** 创建 Agent 实例 */
export async function createAgent() {
  const API_KEY = process.env.LLM_API_KEY ?? "";
  const BASE_URL = process.env.LLM_BASE_URL ?? "https://apihub.agnes-ai.cn/v1";
  const MODEL_NAME = process.env.LLM_MODEL ?? "agnes-2.0-flash";

  const client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
  const systemPrompt = buildSystemPrompt();
  const model: Model<any> = {
    id: MODEL_NAME, name: MODEL_NAME, api: "openai-completions", provider: "openai",
    baseUrl: BASE_URL, reasoning: false, input: ["text"] as ("text" | "image")[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000, maxTokens: 4096,
  };

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      tools: TOOLS as any,
      thinkingLevel: "off",
    },
    streamFn: async (m, _ctx, opts) => {
      const stream = createAssistantMessageEventStream();
      const messages = toOpenAIMessages(_ctx.messages ?? []);
      const tools = _ctx.tools ?? [];

      // 添加系统提示（附加语言强制指令，避免小模型忽略长提示）
      const baseSystem = _ctx.systemPrompt || buildSystemPrompt();
      const messagesWithSystem = [
        { role: "system", content: baseSystem + "\n\n【语言强制指令】你正在与中文用户对话，所有回复必须使用中文（简体），禁止使用英文或其他语言作答。" },
        ...messages,
      ];


      try {
        const response = await client.chat.completions.create({
          model: MODEL_NAME,
          messages: messagesWithSystem,
        });
        const choice = response.choices?.[0];
        const msg = choice?.message;
        if (!msg) throw new Error("No response from LLM");

        const text = msg.content ?? "";
        const toolCalls = msg.tool_calls;
        const hasTools = toolCalls && toolCalls.length > 0;

        const assistantMessage: any = {
          role: "assistant",
          content: [
            ...(text ? [{ type: "text", text }] : []),
            ...(hasTools ? toolCalls.map((tc: any) => ({
              type: "toolCall",
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments),
            })) : []),
          ],
          timestamp: Date.now(),
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        };

        stream.push({ type: "start", partial: assistantMessage });
        if (text) {
          stream.push({ type: "text_start", contentIndex: 0, partial: assistantMessage });
          stream.push({ type: "text_delta", contentIndex: 0, delta: text, partial: assistantMessage });
          stream.push({ type: "text_end", contentIndex: 0, content: text, partial: assistantMessage });
        }
        stream.push({
          type: "done",
          reason: hasTools ? "toolUse" : "stop",
          message: assistantMessage,
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        stream.push({
          type: "error",
          reason: "error",
          error: {
            role: "assistant",
            content: [],
            api: "openai-completions",
            provider: "openai",
            model: MODEL_NAME,
            stopReason: "error",
            errorMessage: error,
            timestamp: Date.now(),
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
          },
        });
      }

      return stream;
    },
    sessionId: "default-session",
  });

  return agent;
}

