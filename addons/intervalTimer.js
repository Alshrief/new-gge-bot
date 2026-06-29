const { isMainThread } = require('node:worker_threads')

if (!isMainThread)
    return

const { changeUser, getUser, events } = require("../main.js")
const dayjs = require("dayjs")

return module.exports = { //broken
    pluginOptions: [
        {
            type: "Text",
            key: "startStopRandomness"
        },
        {
            type: "Time",
            key: "startTimer"
        },
        {
            type: "Time",
            key: "stopTimer"
        }
    ],
    hidden : true
}
function getTimeFromNow(hours, minutes) {
    const now = new Date()
    const target = new Date()

    target.setHours(hours, minutes, 0, 0)

    if (now > target)
        target.setDate(target.getDate() + 1)

    return target - now
}
function startBot(user) {
    user.state = 1
    changeUser(user.uuid, user)
    events.emit("startBot", user.uuid, user.id)
}
function stopBot(user) {
    user.state = 0
    changeUser(user.uuid, user)
    events.emit("removeBot", user.id)
}
function scheduleBot(user, startTimer, endTimer) {
    const startTimeInfo = dayjs(startTimer)
    const endTimeInfo = dayjs(endTimer)
    const startTime = getTimeFromNow(startTimeInfo.hour(), startTimeInfo.minute())
    const endTime = getTimeFromNow(endTimeInfo.hour(), endTimeInfo.minute())

    return [setTimeout(() =>
        startBot(user), startTime > endTime ? 0 : startTime),
    setTimeout(() =>
        stopBot(user), endTime)]
}
getUser().forEach(user => {
    const pluginPath = require("path").basename(__filename).slice(0, -3)
    const pluginOptions = user.plugins[pluginPath] ?? {}
    let startTimer, endTimer
    if (pluginOptions.state && pluginOptions.startTimer && pluginOptions.stopTimer) {
        let [_1, _2] = scheduleBot(user, pluginOptions.startTimer, pluginOptions.stopTimer)
        startTimer = _1
        endTimer = _2
    }

    events.on("userChange", user2 => {
        if (user2.id != user.id)
            return

        if (!user2.plugins?.[pluginPath]?.state)
            return

        const startTime = user2.plugins[pluginPath].startTimer
        const endTime = user2.plugins[pluginPath].stopTimer

        if (!startTime || !endTime)
            return

        if (pluginOptions.startTimer == startTime &&
            pluginOptions.endTimer == endTime)
            return

        clearInterval(startTimer)
        clearInterval(endTimer)

        let [_1, _2] = scheduleBot(user, startTime, endTime)
        startTimer = _1
        endTimer = _2
    })

    events.once("userDelete", user2 => {
        if (user2.id != user.id)
            return

        clearInterval(startTimer)
        clearInterval(endTimer)
    })
})
return

