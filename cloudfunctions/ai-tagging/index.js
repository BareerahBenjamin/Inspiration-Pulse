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

exports.main = async (event) => {
  const { content } = event

  const bodyStr = JSON.stringify({
    model: 'deepseek-chat',
    max_tokens: 50,
    messages: [
      {
        role: 'system',
        content: '你是一个标签分类助手，只返回标签文字，不做任何解释。'
      },
      {
        role: 'user',
        content: `将以下想法归类为一个最合适的标签，只能从这些选项中选一个：产品、写作、设计、生活、学习、其他。只返回标签文字。\n\n想法：${content}`
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
    const tag = data.choices?.[0]?.message?.content?.trim() || '其他'
    return { tag }
  } catch (err) {
    console.error('AI打标失败', err)
    return { tag: '其他', error: err.message }
  }
}