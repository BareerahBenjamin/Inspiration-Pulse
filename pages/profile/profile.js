const { DB } = require('../../utils/db')

Page({
  data: {
    isLoggedIn: false,
    userInfo: {},
    avatarUrl: '',
    nickName: '',
    stats: {
      totalIdeas: 0,
      doneTasks: 0,
    },
    recentDone: [],
  },

  onShow() {
    const app = getApp()
    if (app.globalData.userInfo) {
      this.setData({
        isLoggedIn: true,
        userInfo: app.globalData.userInfo,
      })
      this.loadStats()
    }
  },

  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl })
  },

  onNickInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  async onLogin() {
    const { avatarUrl, nickName } = this.data
    if (!avatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' })
      return
    }
    if (!nickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '登录中...' })

    try {
      // 获取 login code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject })
      })

      // 调用云函数登录
      const res = await wx.cloud.callFunction({
        name: 'user-login',
        data: {
          code: loginRes.code,
          nickName: nickName.trim(),
          avatarUrl,
        },
      })

      if (!res.result.success) {
        throw new Error(res.result.error || '登录失败')
      }

      const userInfo = res.result.user

      // 存全局 + 本地缓存
      const app = getApp()
      app.globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)

      wx.hideLoading()
      this.setData({
        isLoggedIn: true,
        userInfo,
      })

      this.loadStats()
    } catch (err) {
      wx.hideLoading()
      console.error('登录失败', err)
      wx.showToast({ title: '登录失败，请重试', icon: 'error' })
    }
  },

  async loadStats() {
    try {
      const [ideasRes, tasksRes] = await Promise.all([
        DB.countIdeas(),
        DB.countDoneTasks(),
      ])
      this.setData({
        'stats.totalIdeas': ideasRes.total,
        'stats.doneTasks': tasksRes.total,
      })
    } catch (err) {
      console.error('加载统计失败', err)
    }
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新登录才能使用',
      confirmColor: '#C87A5A',
      success: (res) => {
        if (!res.confirm) return
        const app = getApp()
        app.globalData.userInfo = null
        wx.removeStorageSync('userInfo')
        this.setData({
          isLoggedIn: false,
          userInfo: {},
          avatarUrl: '',
          nickName: '',
        })
      }
    })
  },
})
