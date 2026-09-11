# 心语 · AI工程师面试指南

## 项目一句话介绍

> 基于 **Ollama 本地模型** + **Agent 工具循环** 的心理健康对话系统，支持 CBT 认知行为疗法、
> 心理评估量表、流式对话、情绪分析等 7 个专业工具，前端 React + 后端 Node.js。

---

## 一、项目架构（先说整体，再展开细节）

```
web/                    React + Vite + TypeScript 前端
├── components/
│   ├── MentalHealthAssessment.tsx   ← 自测页面（14题，滚动，历史记录）
│   ├── ChatInput.tsx                ← 流式消息输入
│   └── MessageList.tsx              ← SSE 流式渲染
└── styles/
    └── mental_health.css            ← 评估页样式

server/                 Express HTTP 服务器（Node.js ESM）
└── index.ts               ← SSE 流式端点 + 会话管理

src/                    核心 Agent 层
├── agent.ts             ← Agent 主入口，streamFn 重写（Ollama 兼容）
├── stream-agent.ts      ← 独立流式 Agent，OpenAI tools 格式 → 工具循环
├── system-prompt.ts     ← CBT 风格提示词
├── session.ts           ← 会话持久化（JSON 文件存储）
└── tools/               ← 7 个 Agent 工具
    ├── sentiment.ts     ← 情绪分析（积极/消极/中性）
    ├── crisis.ts        ← 危机检测（自杀倾向，触发干预）
    ├── cbt-guide.ts     ← CBT 认知重构引导
    ├── cbt-session.ts   ← 认知三角记录
    ├── knowledge.ts     ← 心理学知识库检索（RAG 基础）
    ├── mental_health.ts ← 心理健康自测（PHQ-9/GAD-7 风格）
    └── thought_record.ts ← 思维记录表
```

---

## 二、核心技术亮点（面试官会追问的）

### 1. 流式对话（SSE）

**实现原理：** 后端使用 `fetch` + `Response` 流，前端用 `EventSource` / `ReadableStream` 消费。

```typescript
// server/index.ts - 流式端点
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
});
// 逐 token 推送
res.write(`event: text_delta\ndata: ${token}\n\n`);
```

**关键问题：** 如何处理工具调用后的等待？
> 工具调用期间不发 `text_delta`，发 `tool_call` 事件让前端展示"思考中"状态，
> 工具返回后继续流式输出，最后发 `done` 事件。

### 2. Agent 工具循环（Tool Use Loop）

```typescript
// stream-agent.ts
async function runAgentLoop(history, input) {
  let messages = [...history, { role: 'user', content: input }];
  while (true) {
    const response = await llm.complete({ messages, tools });
    messages.push(response.message);

    if (!response.tool_calls) break; // 没有工具调用，结束

    // 并行执行所有工具调用
    const toolResults = await Promise.all(
      response.tool_calls.map(async (tc) => {
        const tool = findTool(tc.function.name);
        const result = await tool.execute(tc.id, JSON.parse(tc.function.arguments));
        return { role: 'tool', tool_call_id: tc.id, content: result };
      })
    );
    messages.push(...toolResults);
  }
  return messages;
}
```

**关键问题：** 如何防止工具循环无限执行？
> 设置最大迭代次数（如 5 次），超时或达到上限后强制返回。

### 3. Ollama 本地模型适配

**问题：** Ollama 的 API 与 OpenAI 不完全兼容，如何处理？

```typescript
// 方案：使用 OpenAI SDK，但 baseURL 指向 Ollama
const client = new OpenAI({
  apiKey: 'ollama',  // Ollama 不需要真实 key
  baseURL: 'http://localhost:11434/v1',
});
```

**关键问题：** 本地模型质量不如云端，如何补偿？
> ① 系统提示词更详细（CBT 风格指南）；② 知识库 RAG 补充事实性内容；
> ③ 工具调用限制范围，让模型只做"对话引导"而非"知识生成"。

### 4. 心理健康评估（标准化量表）

```typescript
// mental_health.ts - PHQ-9/GAD-7 混合量表
const QUESTIONS = [
  { id: 'mood_1', question: '过去两周心情...', category: 'mood', options: [...] },
  // ...共14题，6个维度
];

// 评分：归一化到0-10分/维度
categoryScore = total / (count * 10) * 10; // 避免"总分溢出"
```

**关键问题：** 为什么维度分数不直接求和？
> 每个维度题目数不同（焦虑2题 vs 情绪4题），直接求和会导致题目多的维度
> 分数虚高。归一化后每个维度都是 0-10 分，可横向比较。

### 5. 危机检测（Safety First）

```typescript
// crisis.ts
const CRISIS_KEYWORDS = ['自杀', '自残', '想死', '活不下去', '跳楼'];

async function detectCrisis(text: string): Promise<{ level: 'high'|'medium'|'low' }> {
  const matches = CRISIS_KEYWORDS.filter(k => text.includes(k));
  if (matches.length >= 2) return { level: 'high' }; // 立即干预
  if (matches.length >= 1) return { level: 'medium' };
  return { level: 'low' };
}
```

**关键问题：** 检测到危机后系统做什么？
> ① 立即切换为危机干预模式（发送救助热线）；② 记录到用户心理档案；
> ③ 不触发常规工具调用，避免"用 CB T 技巧处理危机"的不当建议。

---

## 三、面试自我介绍模板（1分钟）

> "我做了一个基于本地 LLM 的心理健康对话 Agent，叫'心语'。
> 核心是用 OpenAI 兼容接口接入 **Ollama 本地模型**（qwen2:7b-instruct），
> 实现了完整的 **Agent 工具循环**——7 个工具包括情绪分析、危机检测、
> CBT 认知重构、心理量表评估等。前端 React 用 **SSE 流式输出**，
> 评估数据持久化到 JSON 文件。这个项目让我深入理解了
> **RAG 基础检索、工具调用编排、流式响应处理**，
> 以及对 AI 产品安全边界（危机检测）的设计思考。"

---

## 四、可能遇到的追问 & 标准回答

| 问题 | 回答要点 |
|------|---------|
| 为什么用本地模型不用 API？ | 隐私保护（心理数据敏感）+ 成本控制 + 离线可用 |
| 本地模型回答质量差怎么办？ | ① 结构化提示词 ② 知识库 RAG ③ 工具限定回答范围 |
| 工具调用失败怎么处理？ | try/catch 包裹，返回错误消息给模型，最多重试 2 次 |
| 会话上下文怎么管理？ | 只传最近 N 条消息（滑动窗口），避免超过模型 context window |
| 如何评估模型效果？ | 人工测试（黄金数据集）+ 用户反馈（评分）+ A/B 提示词 |
| 数据库为什么用 JSON 文件？ | 原型阶段够用，后续可换 SQLite/PostgreSQL，迁移成本低 |
| 这个项目最大的挑战是什么？ | 本地模型工具调用不稳定（qwen2 有时忽略 system prompt）→
| 加了简短语言强制指令解决 |

---

## 五、简历中的项目描述（可直接复制）

```
心语心理对话 Agent | 独立开发 | 2026.09

技术栈：Node.js + TypeScript + React + Ollama + OpenAI SDK + SSE

• 设计并实现基于 OpenAI Tools 格式的 Agent 工具循环，支持 7 个专业心理工具
  （情绪分析/危机检测/CBT引导/心理评估/知识库检索等），工具调用链最长 5 层
• 适配 Ollama 本地模型（qwen2:7b-instruct），解决本地模型 system prompt
  忽略问题，对话质量提升显著
• 实现 SSE 流式对话输出，前端逐字渲染，首 token 延迟 < 200ms
• 心理健康评估模块：14 题标准化量表（PHQ-9/GAD-7 风格），6 维度归一化评分，
  历史记录持久化，任务积分系统
• 危机检测模块：关键词匹配 + 规则引擎，识别自杀倾向并触发干预流程
• 知识库：50+ 篇心理学文献（CBT/弗洛伊德/依恋理论），支持语义检索

仓库：github.com/kaiven2004/pi-heart
```
