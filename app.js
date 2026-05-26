App({
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-....',
      traceUser: true,
    })

    // 检查本地缓存登录态
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo._id) {
      this.globalData.userInfo = userInfo
    }
  },

  globalData: {
    userInfo: null,
  },
})
