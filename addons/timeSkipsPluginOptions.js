/** Full time-skip section for plugins that call spendSkip / haveEnoughSkips. */
module.exports = [
    { type: "Label", key: "timeSkipsSettings" },
    {
        type: "Checkbox",
        key: "useTimeSkips",
        default: false
    },
    ...require("./skipTypeOptions.js"),
]
