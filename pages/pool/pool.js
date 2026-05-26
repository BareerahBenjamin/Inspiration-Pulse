const { DB } = require('../../utils/db')
const { formatTime } = require('../../utils/time')

Page({
  data: {
    inputText: '',
    selectedTag: '',
    isRecording: false,
    currentFilter: 'all',
    ideas: [],
    filteredIdeas: [],
    menuVisible: false,
    menuTargetId: '',
    quickTags: ['产品', '写作', '设计', '生活', '学习', '其他'],
    filterOptions: [
      { label: '全部', value: 'all' },
      { label: '未转化', value: 'pending' },
      { label: '已转化', value: 'converted' },
    ],
  },

  onLoad() {
    this.fetchIdeas()
  },

  onShow() {
    this.fetchIdeas()
  },

  // ---- 输入 ----
  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  onTagSelect(e) {
    const tag = e.currentTarget.dataset.tag
    this.setData({
      selectedTag: this.data.selectedTag === tag ? '' : tag
    })
  },

  // ---- 提交灵感 ----
  async onSubmit() {
    const { inputText, selectedTag } = this.data
    if (!inputText.trim()) return

    wx.showLoading({ title: '存入中...' })

    try {
      const addRes = await DB.addIdea({
        content: inputText.trim(),
        tag: selectedTag,
      })

      const ideaId = addRes._id
      this.setData({ inputText: '', selectedTag: '' })
      wx.hideLoading()
      wx.showToast({ title: '已存入蓄水池', icon: 'success' })

      await this.fetchIdeas()

      // 后台触发 AI 打标（完全异步，失败不影响主流程）
      this.triggerAITagging(ideaId, inputText.trim())

    } catch (err) {
      wx.hideLoading()
      console.error('存入失败', err)
      wx.showToast({ title: '存入失败，请重试', icon: 'error' })
    }
  },

  // ---- AI 自动打标（异步，不影响主流程）----
  async triggerAITagging(ideaId, content) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'ai-tagging',
        data: { content },
      })
      if (res.result && res.result.tag) {
        await DB.updateIdea(ideaId, { aiTag: res.result.tag })
        this.fetchIdeas()
      }
    } catch (err) {
      // 打标失败不影响用户，静默处理
      console.warn('AI打标失败', err)
    }
  },

  // ---- 获取灵感列表 ----
  async fetchIdeas() {
    try {
      const res = await DB.getIdeas(50)

      const ideas = res.data.map(item => {
        let deadlineLabel = ''
        let deadlineUrgent = false
        if (item.deadline) {
          const dl = new Date(item.deadline)
          const now = new Date()
          const diffDays = Math.ceil((dl - now) / 86400000)
          if (diffDays < 0) {
            deadlineLabel = `已逾期${Math.abs(diffDays)}天`
            deadlineUrgent = true
          } else if (diffDays === 0) {
            deadlineLabel = '今天截止'
            deadlineUrgent = true
          } else if (diffDays <= 3) {
            deadlineLabel = `${diffDays}天后截止`
            deadlineUrgent = true
          } else {
            deadlineLabel = `${diffDays}天后截止`
          }
        }
        return {
          ...item,
          timeLabel: formatTime(item.createTime),
          deadlineLabel,
          deadlineUrgent,
        }
      })

      this.setData({ ideas })
      this.applyFilter(this.data.currentFilter, ideas)
    } catch (err) {
      console.error('获取灵感失败', err)
    }
  },

  // ---- 筛选 ----
  onFilter(e) {
    const value = e.currentTarget.dataset.value
    this.setData({ currentFilter: value })
    this.applyFilter(value, this.data.ideas)
  },

  applyFilter(filter, ideas) {
    let filtered = ideas
    if (filter === 'pending')   filtered = ideas.filter(i => !i.converted)
    if (filter === 'converted') filtered = ideas.filter(i => i.converted)
    this.setData({ filteredIdeas: filtered })
  },

  // ---- 卡片点击：跳转详情 ----
  onCardTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  // ---- AI 拆解（跳转详情页并触发拆解）----
  onAIBreakdown(e) {
    const { id, content } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}&autoBreakdown=1`
    })
  },

  // ---- 转为任务 ----
  async onConvert(e) {
    const id = e.currentTarget.dataset.id
    const idea = this.data.ideas.find(i => i._id === id)
    if (!idea || idea.converted) return

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
      await DB.updateIdea(id, { converted: true })
      await DB.addTask({
        ideaId: id,
        content: idea.content,
        energyLevel: tapRes.value,
        deadline: idea.deadline || '',
      })
      await this.fetchIdeas()
      wx.showToast({ title: '已加入任务流', icon: 'success' })
    } catch (err) {
      console.error('转化失败', err)
    }
  },

  // ---- 菜单 ----
  onCardMenu(e) {
    this.setData({
      menuVisible: true,
      menuTargetId: e.currentTarget.dataset.id,
    })
  },

  closeMenu() {
    this.setData({ menuVisible: false, menuTargetId: '' })
  },

  onDelete() {
    const id = this.data.menuTargetId
    this.closeMenu()
    wx.showModal({
      title: '确认删除',
      content: '这条灵感删除后无法恢复，确定要删吗？',
      confirmColor: '#5A8A4E',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await DB.removeIdea(id)
          await this.fetchIdeas()
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (err) {
          console.error('删除失败', err)
        }
      }
    })
  },

  // ---- 语音（占位，需接入录音API）----
  onVoiceToggle() {
    wx.showToast({ title: '语音功能即将上线', icon: 'none' })
  },
})
