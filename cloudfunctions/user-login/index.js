const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event) => {
  const { nickName, avatarUrl } = event
  const { OPENID } = cloud.getWXContext()

  try {
    // 查找已有用户
    const { data } = await db.collection('users')
      .where({ openid: OPENID })
      .limit(1)
      .get()

    let user
    if (data.length > 0) {
      // 已有用户，更新信息
      user = data[0]
      await db.collection('users').doc(user._id).update({
        data: {
          nickName: nickName || user.nickName,
          avatarUrl: avatarUrl || user.avatarUrl,
        }
      })
      user.nickName = nickName || user.nickName
      user.avatarUrl = avatarUrl || user.avatarUrl
    } else {
      // 新用户，创建记录
      const addRes = await db.collection('users').add({
        data: {
          openid: OPENID,
          nickName: nickName || '灵感用户',
          avatarUrl: avatarUrl || '',
          createTime: db.serverDate(),
        }
      })
      user = {
        _id: addRes._id,
        openid: OPENID,
        nickName: nickName || '灵感用户',
        avatarUrl: avatarUrl || '',
      }
    }

    return { success: true, user }
  } catch (err) {
    console.error('登录失败', err)
    return { success: false, error: err.message }
  }
}
