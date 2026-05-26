const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function httpsPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) {
          reject(new Error(`HTTP ${res.statusCode} non-JSON response: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const LEVEL_PROMPTS = {
  simple:   '拆成2~3个步骤',
  normal:   '拆成4~5个步骤',
  detailed: '拆成6~8个步骤',
}

exports.main = async (event) => {
  const { content, level = 'normal' } = event

  const bodyStr = JSON.stringify({
    model: 'deepseek-chat',
    max_tokens: 1500,
    messages: [
      {
        role: 'system',
        content: `你是任务拆解助手。把用户的想法拆成马上能动手做的具体步骤。

核心规则：
1. 每个步骤必须是 5 分钟内就能开始的第一个动作，不是阶段名
2. 必须包含可验证的产出物（工具/平台/数量/格式）
3. 动词开头，描述到"用什么做什么"的程度
4. 只返回JSON数组，不要任何解释，不要markdown代码块

好坏对比：
好：["用 Figma 画出首页3个核心页面的线框图","把线框图发到设计师群里收反馈","整理反馈修改后导出 PDF"]
坏：["产品设计","原型评审","迭代优化"]

好：["在小红书搜5个同类型账号拆解选题方向","用 Excel 列出30个备选标题","选出3个标题写初稿各500字"]
坏：["内容策划","选题规划","写文章"]`
      },
      {
        role: 'user',
        content: `灵感：${content}

请${LEVEL_PROMPTS[level]}，每步是一个具体动作（动词开头，包含产出物），不超过25字。返回JSON数组。`
      }
    ]
  })

  const options = {
    hostname: 'api.vectorengine.cn',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Length': Buffer.byteLength(bodyStr),
    }
  }

  try {
    const data = await httpsPost(options, bodyStr)
    let raw = data.choices?.[0]?.message?.content?.trim() || '[]'
    if (raw.startsWith('<')) {
      throw new Error(`API returned HTML: ${raw.slice(0, 200)}`)
    }
    const steps = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return { steps }
  } catch (err) {
    console.error('AI拆解失败', err)
    return { steps: [], error: err.message }
  }
}