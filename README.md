# pi-心理 · 心理健康对话 Agent

基于 [pi-agent-core](https://github.com/earendil-works/pi) 框架构建的心理健康支持对话助手，支持 **Ollama 本地模型** 完全离线运行。

## 功能

- **情绪分析**：实时分析用户情绪状态，识别焦虑、抑郁、压力等
- **危机检测**：四级风险检测，高危时自动触发干预流程
- **CBT 结构化交互**：认知重构流程——思维记录表、苏格拉底式提问、认知扭曲识别
- **心理健康自测**：14 题标准化量表，6 维度评估，历史追踪与积分任务
- **知识检索**：覆盖弗洛伊德精神分析、CBT、依恋理论等专业内容
- **会话持久化**：本地 JSON 存储，隐私安全

## 截图

<!-- TODO: 添加实际截图，放入 screenshots/ 目录 -->
<!-- 截图示例：
![欢迎页面](screenshots/welcome.png)
![对话界面](screenshots/chat.png)
![心理健康自测](screenshots/assessment.png)
-->

## 技术栈

- **运行时**：Node.js >= 22.19
- **Agent 框架**：pi-agent-core (TypeScript)
- **LLM**：Ollama (qwen2:7b-instruct) + OpenAI 兼容接口
- **前端**：React + Vite + TypeScript
- **后端**：Node.js ESM + SSE 流式输出
- **持久化**：本地 JSON 文件

## 快速开始

```bash
# 1. 安装 Ollama 并拉取模型
ollama pull qwen2:7b-instruct

# 2. 安装依赖
npm install
cd web && npm install && cd ..
cd server && npm install && cd ..

# 3. 配置环境
cp .env.example .env  # 或直接编辑 .env

# 4. 编译
npm run build
cd server && npm run build && cd ..
cd web && npm run build && cd ..

# 5. 启动服务
cd server && node dist/server/index.js  # 后端
cd web && npm run dev                   # 前端
```

访问 http://localhost:3000

## 项目结构

```
src/
├── index.ts              # CLI 入口
├── agent.ts              # Agent 主入口（Ollama 适配）
├── stream-agent.ts       # 流式 Agent（SSE 支持）
├── session.ts            # 会话持久化
├── system-prompt.ts      # CBT 系统提示词
└── tools/
    ├── sentiment.ts      # 情绪分析
    ├── crisis.ts         # 危机检测
    ├── cbt-guide.ts      # CBT 引导
    ├── cbt-session.ts    # CBT 结构化流程
    ├── knowledge.ts      # 知识库检索
    └── mental_health.ts  # 心理健康自测

server/
└── index.ts              # HTTP 服务器（SSE 流式）

web/
├── src/
│   ├── components/
│   │   ├── MentalHealthAssessment.tsx  # 自测页面
│   │   └── ChatInput.tsx               # 流式输入
│   └── api.ts                         # API 客户端
└── vite.config.ts

knowledge/
├── freud/      # 弗洛伊德经典著作
├── cbt/        # CBT 理论
└── general/    # 心理学主题
```

## API 接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sessions` | GET | 获取会话列表 |
| `/api/sessions` | POST | 创建新会话 |
| `/api/sessions/:id/messages` | GET | 获取消息历史 |
| `/api/sessions/:id/messages` | POST | 发送消息（同步） |
| `/api/sessions/:id/messages/stream` | POST | 发送消息（流式 SSE） |
| `/api/mental-health` | POST | 心理健康评估（start/submit/history/complete_task） |

## 安全说明

- 明确声明「我不是专业心理咨询师」
- 不给出诊断建议，只提供情感支持和引导
- 危机场景自动推荐专业热线
- 会话内容仅本地存储，不上传云端

## 部署

```bash
# 生产构建
npm run build
cd server && npm run build && cd ..
cd web && npm run build && cd ..

# 启动生产服务
cd server && node dist/server/index.js
# 前端静态文件由后端服务
```
