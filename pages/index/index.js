const { DB } = require('../../utils/db')
const { formatTime } = require('../../utils/time')

Page({
  data: {
    todayDone: 0,
    currentEnergy: 2,
    energyLevels: [
      { value: 1, label: '低能量', desc: '5分钟小事', icon: '🌿', color: '#1D9E75', bgColor: '#E1F5EE' },
      { value: 2, label: '还不错', desc: '正常节奏', icon: '⚡', color: '#534AB7', bgColor: '#EEEDFE' },
      { value: 3, label: '状态爆棚', desc: '挑战难事', icon: '🔥', color: '#D85A30', bgColor: '#FAECE7' },
    ],
    progressStyle: 'width: 0%',
    allTasks: [],
    filteredTasks: [],
  },

  onLoad() {
    this.loadTasks()
  },

  onShow() {
    this.loadTasks()
    this.loadTodayDone()
  },

  async loadTasks() {
    try {
      const res = await DB.getTasksByDeadline(this.data.currentEnergy)
      const now = new Date()
      const tasks = res.data.map(item => {
        const level = this.data.energyLevels.find(e => e.value === item.energyLevel) || this.data.energyLevels[1]
        let deadlineLabel = ''
        let deadlineUrgent = false
        if (item.deadline) {
          const dl = new Date(item.deadline)
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
          energyLabel: level.label,
          energyColor: level.color,
          timeLabel: formatTime(item.createTime),
          deadlineLabel,
          deadlineUrgent,
        }
      })
      this.setData({ allTasks: tasks, filteredTasks: tasks })
    } catch (err) {
      console.error('加载任务失败', err)
    }
  },

  async loadTodayDone() {
    try {
      const res = await DB.countTodayDone()
      const todayDone = res.total
      const pct = Math.min(todayDone / 5 * 100, 100)
      this.setData({
        todayDone,
        progressStyle: `width: ${pct}%`,
      })
    } catch (err) {
      console.error('加载完成数失败', err)
    }
  },

  onEnergySelect(e) {
    const value = e.currentTarget.dataset.value
    if (value === this.data.currentEnergy) return
    const level = this.data.energyLevels.find(l => l.value === value)
    this.setData({ currentEnergy: value })
    this.loadTasks()
    wx.showToast({ title: `${level.icon} ${level.label}`, icon: 'none', duration: 800 })
  },

  async onTaskDone(e) {
    const id = e.currentTarget.dataset.id
    try {
      await DB.completeTask(id)
      wx.showToast({ title: '完成一次脉冲！', icon: 'success' })
      this.loadTasks()
      this.loadTodayDone()
    } catch (err) {
      console.error('完成任务失败', err)
    }
  },

  onTaskTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  onAIBreakdown(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}&autoBreakdown=1` })
  },

  async onTaskSkip(e) {
    const id = e.currentTarget.dataset.id
    // 跳过：从今日流移除但不标记完成
    try {
      await DB.skipTask(id)
      this.loadTasks()
    } catch (err) {
      console.error('跳过失败', err)
    }
  },

  goPool() {
    wx.switchTab({ url: '/pages/pool/pool' })
  },
})