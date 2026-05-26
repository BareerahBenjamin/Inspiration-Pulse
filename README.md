# 灵感脉冲（Inspiration Pulse）

微信小程序 + 云开发。把零散灵感存进"蓄水池"，用 AI 拆解成可执行步骤，按"能量等级"匹配当下状态去执行。

## 功能

- **蓄水池**：随时录入灵感，支持快捷标签 + AI 自动打标
- **AI 拆解**：将灵感拆成可执行步骤（极简/标准/详细三档）
- **今日流**：按能量等级筛选待办任务，逐个打卡完成
- **看板**：周完成统计 + 热力图 + 标签云

## 技术栈

- 微信小程序
- 微信云开发（数据库 + 云函数）
- DeepSeek API（AI 打标 & 拆解）

## 项目结构

```
pages/
  index/     今日流：按能量筛选任务，打卡完成
  pool/      蓄水池：录入灵感、AI 打标、转任务
  board/     看板：统计 + 周热力图 + 标签云
  detail/    灵感详情：AI 拆解步骤
cloudfunctions/
  ai-tagging/    AI 自动标签
  ai-breakdown/  AI 步骤拆解
utils/
  db.js      云数据库封装
  const.js   常量定义
  time.js    时间工具函数
```

## 开发

1. 用微信开发者工具导入项目
2. 确保云开发环境 `cloud1-d0gvzver782a2af77` 已开通
3. 云函数需部署到云端（`/deploy-cloudfn`）
4. AI 云函数的 API Key 需在云开发控制台配置环境变量

## 云函数部署

```bash
# 使用 Claude Code skill
/deploy-cloudfn <函数名>
```

首次使用会询问微信开发者工具 CLI 路径，之后自动记忆。
