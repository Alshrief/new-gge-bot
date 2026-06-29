/** Skip-type toggles shared by the global skips plugin and per-plugin time-skip settings. */
module.exports = [
    {
        type: "Checkbox",
        key: "bypassSkipTypeFilter",
        default: false
    },
    { type: "Label", key: "skipTypes" },
    {
        type: "Checkbox",
        key: "1Minute",
        default: true
    },
    {
        type: "Checkbox",
        key: "5Minute",
        default: true
    },
    {
        type: "Checkbox",
        key: "10Minute",
        default: true
    },
    {
        type: "Checkbox",
        key: "30Minute",
        default: true
    },
    {
        type: "Checkbox",
        key: "1Hour",
        default: true
    },
    {
        type: "Checkbox",
        key: "5Hour",
        default: true
    },
    {
        type: "Checkbox",
        key: "24Hour",
        default: true
    }
]
