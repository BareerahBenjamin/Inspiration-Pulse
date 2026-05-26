const { DB } = require('../../utils/db')
const { formatTime } = require('../../utils/time')

Page({
  data: {
    todayDone: 0,
    totalIdeas: 0,
    convertedCount: 0,
    weekData: [],
    topTags: [],
    doneTasks: [],
  },

  onShow() {
    if (this._loading) return
    this._loading = true
    setTimeout(() => { this._loading = false }, 2000)

    this.loadAll()
  },

  async loadAll() {
    await Promise.all([
      this.loadStats(),
      this.loadWeekData(),
      this.loadDoneTasks(),
    ])
  },

  async loadStats() {
    try {
      const [doneRes, ideasRes, convertRes] = await Promise.all([
        DB.countTodayDone(),
        DB.countIdeas(),
        DB.countConvertedIdeas(),
      ])
      this.setData({
        todayDone: doneRes.total,
        totalIdeas: ideasRes.total,
        convertedCount: convertRes.total,
      })
    } catch (err) {
      console.error('加载统计失败', err)
    }
  },

  async loadWeekData() {
    const days = ['日', '一', '二', '三', '四', '五', '六']
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)

    try {
      const res = await DB.getDoneTasksSince(weekStart, 100)

      const countMap = {}
      res.data.forEach(item => {
        const d = new Date(item.doneTime)
        const key = `${d.getMonth() + 1}/${d.getDate()}`
        countMap[key] = (countMap[key] || 0) + 1
      })

      const colors = ['rgba(255,255,255,0.4)', 'rgba(224,120,86,0.08)', 'rgba(224,120,86,0.18)', 'rgba(224,120,86,0.32)', 'rgba(224,120,86,0.5)']
      const weekData = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = `${d.getMonth() + 1}/${d.getDate()}`
        const count = countMap[key] || 0
        weekData.push({
          day: days[d.getDay()],
          count,
          color: colors[Math.min(count, colors.length - 1)],
        })
      }

      this.setData({ weekData })
      this.computeTopTags()
    } catch (err) {
      console.error('加载周数据失败', err)
    }
  },

  async loadDoneTasks() {
    try {
      const res = await DB.getRecentDoneTasks(10)
      const doneTasks = res.data.map(item => ({
        ...item,
        timeLabel: formatTime(item.doneTime || item.createTime),
      }))
      this.setData({ doneTasks })
    } catch (err) {
      console.error('加载完成任务失败', err)
    }
  },

  async computeTopTags() {
    try {
      const res = await DB.getIdeas(50)
      const tagCount = {}
      res.data.forEach(item => {
        const t = item.aiTag || item.tag
        if (t) tagCount[t] = (tagCount[t] || 0) + 1
      })

      const sorted = Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)

      const max = sorted[0]?.[1] || 1
      const topTags = sorted.map(([tag, count]) => ({
        tag,
        count,
        size: Math.round(24 + (count / max) * 16),
        opacity: (0.5 + (count / max) * 0.5).toFixed(2),
      }))

      this.setData({ topTags })
    } catch (err) {
      console.error('加载标签失败', err)
    }
  },
})
