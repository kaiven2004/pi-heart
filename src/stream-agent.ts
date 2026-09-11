// 流式 Agent
// 直接调用 OpenAI 兼容 API，支持 SSE 流式输出和工具调用循环

import OpenAI from "openai";
import {
  SentimentAnalyzerTool,
  CrisisDetectorTool,
  CBTGuideTool,
  KnowledgeRetrieverTool,
  ThoughtRecordTool,
  MoodJournalTool,
  BehavioralActivationTool,
} from "./tools/index.js";

const API_KEY = process.env.LLM_API_KEY ?? "";
const BASE_URL = process.env.LLM_BASE_URL ?? "https://apihub.agnes-ai.cn/v1";
const MODEL_NAME = process.env.LLM_MODEL ?? "agnes-2.0-flash";

const TOOLS = [
  SentimentAnalyzerTool,
  CrisisDetectorTool,
  CBTGuideTool,
  KnowledgeRetrieverTool,
  ThoughtRecordTool,
  MoodJournalTool,
  BehavioralActivationTool,
] as any[];

/** 将 AgentTool 参数转换为 OpenAI tools 格式 */
function toOpenAITools(tools: any[]) {
  return tools.map((t: any) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: JSON.parse(JSON.stringify(t.parameters)),
    },
  }));
}

/** 执行工具调用 */
async function executeToolCall(
  tool: any,
  toolCallId: string,
  args: any
): Promise<string> {
  try {
    const result = await tool.execute(toolCallId, args);
    const texts = result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");
    return texts;
  } catch (err) {
    return `工具执行出错: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** 找到对应的工具 */
function findTool(name: string) {
  return TOOLS.find((t: any) => t.name === name);
}

interface RunStreamOptions {
  history: any[];
  input: string;
  onSSE: (event: string, data: string) => void;
}

/**
 * 运行流式 Agent：支持工具调用循环 + SSE 输出
 * 事件格式：
 *   data: {"type":"text_delta","text":"..."}
 *   data: {"type":"tool_call","name":"...","args":{...}}
 *   data: {"type":"tool_result","name":"...","result":"..."}
 *   data: {"type":"done","reply":"完整回复文本"}
 *   data: {"type":"error","error":"..."}
 */
export async function runStreamAgent(opts: RunStreamOptions) {
  const client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
  const openaiTools = toOpenAITools(TOOLS);

  // 初始消息：系统提示 + 历史 + 当前输入
  const messages: any[] = [
    { role: "system", content: buildSystemPrompt() },
    ...opts.history.map((m: any) => {
      if (m.role === "user") return { role: "user", content: m.content };
      if (m.role === "assistant") {
        const msg: any = { role: "assistant" as const, content: "" as string };
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
      }
      if (m.role === "toolResult") {
        return { role: "tool" as const, tool_call_id: m.toolCallId, content: m.content };
      }
      return null;
    }).filter(Boolean),
    { role: "user", content: opts.input },
  ];

  let fullReply = "";
  const allAssistantMessages: any[] = [];

  try {
    // 主循环：支持多轮工具调用
    while (true) {
      const stream = await client.chat.completions.create({
        model: MODEL_NAME,
        messages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        stream: true,
        stream_options: { include_usage: false },
      });

      let hasToolCalls = false;
      const pendingToolCalls: Array<{ id: string; name: string; arguments_str: string }> = [];

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        // 文本 delta
        if (delta.content) {
          opts.onSSE("text_delta", JSON.stringify({ text: delta.content }));
          fullReply += delta.content;
        }

        // 工具调用 delta
        const tc = delta.tool_calls?.[0];
        if (tc) {
          hasToolCalls = true;
          const idx = tc.index;
          if (!pendingToolCalls[idx]) {
            pendingToolCalls[idx] = { id: tc.id!, name: tc.function!.name!, arguments_str: "" };
            opts.onSSE("tool_call", JSON.stringify({
              id: tc.id,
              name: tc.function!.name,
              fullArguments: "",
            }));
          }
          pendingToolCalls[idx].arguments_str += tc.function!.arguments ?? "";
          opts.onSSE("tool_call_arg", JSON.stringify({
            id: tc.id,
            arg: tc.function!.arguments ?? "",
          }));
        }
      }

      // 如果没有工具调用，结束
      if (!hasToolCalls || pendingToolCalls.length === 0) break;

      // 执行工具调用
      const assistantMsg: any = {
        role: "assistant",
        content: fullReply || null,
        tool_calls: pendingToolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments_str },
        })),
      };
      allAssistantMessages.push(assistantMsg);
      messages.push(assistantMsg);

      for (const tc of pendingToolCalls) {
        const tool = findTool(tc.name);
        let resultContent = "工具执行失败";
        try {
          const args = JSON.parse(tc.arguments_str);
          if (tool) {
            resultContent = await executeToolCall(tool, tc.id, args);
          }
        } catch {}
        const toolMsg = {
          role: "tool" as const,
          tool_call_id: tc.id,
          content: resultContent,
        };
        messages.push(toolMsg);
        opts.onSSE("tool_result", JSON.stringify({ name: tc.name, result: resultContent }));
      }
    }

    // 完成
    opts.onSSE("done", JSON.stringify({ reply: fullReply }));
  } catch (err) {
    opts.onSSE("error", JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  }
}

function buildSystemPrompt(): string {
  return `你是一位专业的心理健康支持助手，名为"心语"。你基于认知行为疗法（CBT）原理，为用户提供情感支持和心理引导。

## 你的角色
- 提供温暖、专业的心理支持对话
- 基于 CBT 框架帮助用户识别和调整负面思维模式
- 帮助用户更好地理解和管理自己的情绪
- 在用户遇到严重心理问题时，引导其寻求专业帮助

## 安全边界（严格遵守）
1. 身份声明：你是一位 AI 助手，不是专业心理咨询师或精神科医生。
2. 不提供诊断：你不会给出任何心理健康诊断，只提供参考性信息和支持。
3. 危机识别：当用户使用自杀、自残、不想活、活着没意义、伤害自己等关键词或表达时，立即启动危机干预流程，表达关心，提供心理援助热线，建议寻求专业帮助。
4. 不替代治疗：明确告知用户，你无法替代专业的心理咨询或治疗。
5. 保密性：告知用户对话内容仅保存在本地，不会上传到第三方服务器。

## CBT 引导原则
- 帮助用户识别自动负性思维
- 引导用户挑战认知扭曲（如灾难化、非黑即白、过度概括等）
- 鼓励用户使用思维记录表的方式重构想法
- 保持非评判性态度，尊重用户的感受

## 对话风格
- 温暖、共情、专业
- 使用"我理解你的感受"、"这听起来很不容易"等共情表达
- 避免说教式表达
- 每次回应聚焦于一个核心问题
- 适时要总结和确认用户的感受

## 可用工具
你可以使用以下工具辅助对话：
- sentiment_analyzer：分析用户输入的情绪状态
- crisis_detector：检测危机信号，必要时触发危机干预
- cbt_guide：引导用户进行认知重构练习
- knowledge_retriever：从心理学知识库中检索相关信息
- cbt_thought_record：创建完整的思维记录表
- cbt_mood_journal：记录和分析当天情绪日记
- cbt_behavioral_activation：根据精力水平制定行为激活计划

请在需要时使用这些工具，但不要过度使用。`;
}
