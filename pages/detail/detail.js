const { DB } = require('../../utils/db')
const { formatTime } = require('../../utils/time')

Page({
  data: {
    idea: {},
    steps: [],
    isLoading: false,
    today: '',
    currentGran: 'normal',
    granularities: [
      { value: 'simple',   label: '极简' },
      { value: 'normal',   label: '标准' },
      { value: 'detailed', label: '详细' },
    ],
  },

  onLoad(options) {
    const { id, autoBreakdown } = options
    const d = new Date()
    this.setData({ today: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
    if (id) {
      this.ideaId = id
      this.loadIdea(id, autoBreakdown === '1')
    }
  },

  async loadIdea(id, autoBreakdown) {
    try {
      const res = await DB.getIdea(id)
      const idea = {
        ...res.data,
        timeLabel: formatTime(res.data.createTime),
      }
      const steps = (idea.steps || []).map(s =>
        typeof s === 'string' ? { text: s, done: false } : s
      )
      this.setData({ idea, steps })

      if (autoBreakdown && steps.length === 0) {
        this.onBreakdown()
      }
    } catch (err) {
      console.error('加载灵感失败', err)
      wx.showToast({ title: '加载失败', icon: 'error' })
    }
  },

  onContentEdit(e) {
    this.setData({ 'idea.content': e.detail.value })
  },

  onGranSelect(e) {
    this.setData({ currentGran: e.currentTarget.dataset.value })
  },

  onDeadlineChange(e) {
    this.setData({ 'idea.deadline': e.detail.value })
  },

  onDeadlineClear() {
    this.setData({ 'idea.deadline': '' })
  },

  async onBreakdown() {
    if (this.data.isLoading) return

    // 重新生成前确认
    if (this.data.steps.length > 0) {
      const res = await new Promise(resolve => {
        wx.showModal({
          title: '重新生成',
          content: '当前步骤将被覆盖，确定要重新生成吗？',
          confirmColor: '#5A8A4E',
          success: resolve,
        })
      })
      if (!res.confirm) return
    }

    this.setData({ isLoading: true, steps: [] })

    try {
      const res = await wx.cloud.callFunction({
        name: 'ai-breakdown',
        data: {
          content: this.data.idea.content,
          level: this.data.currentGran,
        },
      })

      if (res.result?.error) {
        throw new Error(res.result.error)
      }
      const rawSteps = res.result?.steps || []
      if (rawSteps.length === 0) {
        wx.showToast({ title: 'AI 未返回结果，请重试', icon: 'none' })
        return
      }
      const steps = rawSteps.map(s => ({ text: s, done: false }))
      this.setData({ steps })

      // 保存到数据库
      await DB.updateIdea(this.ideaId, { steps: rawSteps })
    } catch (err) {
      console.error('AI拆解失败', err)
      wx.showToast({ title: '拆解失败，请重试', icon: 'error' })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  onStepToggle(e) {
    const index = e.currentTarget.dataset.index
    const steps = this.data.steps
    steps[index].done = !steps[index].done
    this.setData({ steps })
  },

  async onSave() {
    try {
      await DB.updateIdea(this.ideaId, {
        content: this.data.idea.content,
        deadline: this.data.idea.deadline || '',
      })
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'error' })
    }
  },

  async onConvert() {
    const { idea } = this.data
    if (idea.converted) return

    // 选择能量级别
    const energyMap = [
      { label: '🌿 低能量 · 5分钟小事', value: 1 },
      { label: '⚡ 还不错 · 正常节奏', value: 2 },
      { label: '🔥 状态爆棚 · 挑战难事', value: 3 },
    ]
    const tapRes = await new Promise(resolve => {
      wx.showActionSheet({
        itemList: energyMap.map(e => e.label),
        success: (res) => resolve(energyMap[res.tapIndex]),
        fail: () => resolve(null),
      })
    })
    if (!tapRes) return

    try {
      await DB.updateIdea(this.ideaId, { converted: true })
      await DB.addTask({
        ideaId: this.ideaId,
        content: idea.content,
        energyLevel: tapRes.value,
        status: 'pending',
        deadline: idea.deadline || '',
      })
      this.setData({ 'idea.converted': true })
      wx.showToast({ title: '已加入任务流', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '转化失败', icon: 'error' })
    }
  },
})