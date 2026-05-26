# 灵感脉冲（Inspiration Pulse）

微信小程序 + 云开发。把零散灵感存进"蓄水池"，用 AI 拆解成可执行步骤，按"能量等级"匹配当下状态去执行。

- **AppID**：`wx4ce54443f2708c6d`
- **云开发环境**：`cloud1-d0gvzver782a2af77`（在 `app.js` 写死，切环境需同步改）
- **AI 接入**：DeepSeek API（`api.deepseek.com`，模型 `deepseek-chat`）

## 核心流程

```
蓄水池(pool) ──写入──> ideas 集合
   │
   │  AI 打标(ai-tagging) ──写回 aiTag
   │  AI 拆解(ai-breakdown) ──写回 steps
   │
   └──转化为任务──> tasks 集合（带 energyLevel）
                       │
                       └─ 今日流(index) 按能量筛选 → 完成/跳过
                              │
                              └─ 看板(board) 统计周完成数 / Top标签
```

## 目录结构

```
pages/
  index/   今日流：按能量筛选未完成任务，打卡
  pool/    蓄水池：录入灵感、快捷标签、AI打标、转任务
  board/   看板：统计 + 周热力图 + 标签云
  detail/  灵感详情：AI 拆解（极简/标准/详细三档粒度）
components/
  energy-picker/  能量等级选择器（1低 / 2正常 / 3爆棚）
  idea-card/      灵感卡片
  step-list/      步骤清单
cloudfunctions/
  ai-tagging/     DeepSeek 调用：内容 → 单个标签
  ai-breakdown/   DeepSeek 调用：内容 + level → JSON 步骤数组
utils/
  db.js     云数据库封装（DB.addIdea / getTasksByEnergy / completeTask ...）
  const.js  ENERGY_LEVELS / QUICK_TAGS / BREAKDOWN_LEVELS
  time.js   formatTime / todayRange
app.js / app.json / app.wxss   入口 + tabBar + 全局调色板
project.config.json            开发者工具配置（含 AppID）
uploadCloudFunction.sh         云函数部署命令模板（含占位符，不能直接跑）
```

## 数据库 collection

**`ideas`**（蓄水池原始灵感）
```
{ _id, content, tag, aiTag, converted: false, steps: [], createTime }
```
- `tag`：用户手选的快捷标签（QUICK_TAGS）
- `aiTag`：`ai-tagging` 云函数自动归类，异步回写，失败静默
- `steps`：`ai-breakdown` 拆解出的字符串数组，详情页里渲染为 `{text, done}`
- `converted: true` 表示已转化为任务

**`tasks`**（可执行任务）
```
{ _id, ideaId, content, status, energyLevel, createTime, doneTime }
```
- `status`：`'pending' | 'done' | 'skipped'`
- `energyLevel`：`1 | 2 | 3`，对应 `utils/const.js` 的 ENERGY_LEVELS
- 今日流查询条件：`status='pending' && energyLevel <= 当前选择的等级`

## 重要约定

### 加新页面必须改 app.json
WeChat 强制要求 `pages` 数组里登记。新页面建好 4 个文件（`.js/.json/.wxml/.wxss`）后**必须**在 `app.json` 注册路径，否则编译报错。需要进 tabBar 还得再加进 `tabBar.list`。

### 模块风格混用
`utils/*.js` 同时写了 `export` 和 `module.exports`——前者给小程序构建用，后者让 Node 端也能 `require`。**新增工具函数请保留这两种导出**，删任一种都会出问题。

### 数据库访问统一走 `utils/db.js`
**所有页面**通过 `DB` 封装访问数据库，不要直接写 `wx.cloud.database()`。如果需要的查询 `DB` 里没有，**先加进 `utils/db.js`**，再在页面里调用。

理由：
1. 集中维护，schema 变了只需改一处
2. `DB.addIdea` / `DB.addTask` 会自动补 `createTime` 和默认字段，避免散落的 `serverDate()` 调用
3. `where + command.gte/lte` 这类查询封装后页面里更易读

可用方法见 `utils/db.js`：`addIdea/getIdea/getIdeas/updateIdea/removeIdea`、`countIdeas/countConvertedIdeas`、`addTask/getTasksByEnergy/completeTask/skipTask`、`countTodayDone/countDoneTasksSince/getDoneTasksSince/getRecentDoneTasks`。

### DEEPSEEK_API_KEY 永远不进代码
两个云函数都通过 `process.env.DEEPSEEK_API_KEY` 读 key。**密钥配置位置**：微信云开发控制台 → 云函数 → 对应函数 → 环境变量。**绝不要**把 key 写进 `index.js`、提交到仓库、或放在小程序前端。

### 设计系统（app.wxss）
- 主色调暖米色 `#FBF4EC`，强调色橙 `#E07856` + 紫 `#6B4D8C`
- 通用 class：`.card` / `.card-active` / `.text` / `.text2` / `.accent` 等
- 全部用 `rpx` 单位，禁用 `px`（除非确实需要绝对像素）

## 云函数部署

**用 `/deploy-cloudfn` skill**（推荐）：在新对话里 `/deploy-cloudfn ai-breakdown` 即可。skill 会自动找 CLI、读 envId、跑部署命令。第一次会问你 `cli.bat` 路径并记住。

底层命令（skill 内部执行的）：

```
<微信开发者工具/cli.bat> cloud functions deploy --e <envId> --n <函数名> --r --project <项目绝对路径>
```

**前提**：微信开发者工具必须**开着并已登录**——它的 CLI 是壳，靠运行中的 IDE 来做鉴权。开发者工具没开的话所有 CLI 命令都会挂。

⚠️ `uploadCloudFunction.sh` 是带占位符的模板（`${installPath}` 等），**不能直接跑**。保留它只是因为是云开发 quickstart 自带的，不要依赖它。

云函数依赖（`wx-server-sdk`）在 `package.json` 里声明，`-r` 参数让云端 npm install。本地 `node_modules` 只是给编辑器补全用，不会上传。

## 调试小贴士

- 改了 `app.json` 的 `pages` 后需要**重新编译**（Ctrl+B），热重载不一定能识别
- 云函数本地调试用开发者工具的"云开发"面板，能直接看日志和触发
- 数据库权限默认是"仅创建者可读写"，若多端测试需在控制台改集合权限
- `wx.cloud.callFunction` 失败常见原因：云函数未部署 / 环境变量没设 / 网络白名单（DeepSeek 域名需在云函数侧出网，前端 `wx.request` 才需要小程序后台配域名）

## 路径与命名

- 跨页跳转用绝对路径：`wx.navigateTo({ url: '/pages/detail/detail?id=xxx' })`
- tabBar 页面只能用 `wx.switchTab`，不能用 `navigateTo`
- 组件引用走相对路径，写进各页 `.json` 的 `usingComponents`
