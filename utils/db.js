function getDB() {
  return wx.cloud.database()
}

export const DB = {
  // ---- ideas ----
  addIdea(data) {
    return getDB().collection('ideas').add({
      data: {
        ...data,
        converted: false,
        steps: [],
        aiTag: '',
        createTime: getDB().serverDate(),
      }
    })
  },

  getIdeas(limit = 50) {
    return getDB().collection('ideas')
      .orderBy('createTime', 'desc')
      .limit(limit)
      .get()
  },

  getIdea(id) {
    return getDB().collection('ideas').doc(id).get()
  },

  updateIdea(id, data) {
    return getDB().collection('ideas').doc(id).update({ data })
  },

  removeIdea(id) {
    return getDB().collection('ideas').doc(id).remove()
  },

  countIdeas() {
    return getDB().collection('ideas').count()
  },

  countConvertedIdeas() {
    return getDB().collection('ideas').where({ converted: true }).count()
  },

  // ---- tasks ----
  addTask(data) {
    return getDB().collection('tasks').add({
      data: {
        ...data,
        status: 'pending',
        createTime: getDB().serverDate(),
      }
    })
  },

  getTasksByEnergy(energyLevel) {
    const _ = getDB().command
    return getDB().collection('tasks')
      .where({
        status: 'pending',
        energyLevel: _.lte(energyLevel),
      })
      .orderBy('createTime', 'desc')
      .limit(20)
      .get()
  },

  completeTask(id) {
    return getDB().collection('tasks').doc(id).update({
      data: {
        status: 'done',
        doneTime: getDB().serverDate(),
      }
    })
  },

  skipTask(id) {
    return getDB().collection('tasks').doc(id).update({
      data: { status: 'skipped' }
    })
  },

  countDoneTasksSince(startDate) {
    const _ = getDB().command
    return getDB().collection('tasks')
      .where({ status: 'done', doneTime: _.gte(startDate) })
      .count()
  },

  countTodayDone() {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return this.countDoneTasksSince(start)
  },

  getDoneTasksSince(startDate, limit = 100) {
    const _ = getDB().command
    return getDB().collection('tasks')
      .where({ status: 'done', doneTime: _.gte(startDate) })
      .limit(limit)
      .get()
  },

  getRecentDoneTasks(limit = 10) {
    return getDB().collection('tasks')
      .where({ status: 'done' })
      .orderBy('doneTime', 'desc')
      .limit(limit)
      .get()
  },

  getTasksByDeadline(energyLevel) {
    const _ = getDB().command
    return getDB().collection('tasks')
      .where({
        status: 'pending',
        energyLevel: _.lte(energyLevel),
      })
      .orderBy('deadline', 'asc')
      .limit(20)
      .get()
  },

  countDoneTasks() {
    return getDB().collection('tasks')
      .where({ status: 'done' })
      .count()
  },
}

module.exports = { DB }