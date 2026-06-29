if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: require("./skipTypeOptions.js"),
        force: true
    }

const { botConfig } = require("../ggeBot")
const { resources } = require('../protocols')

const MinuteSkipType = Object.freeze({
    MS1: 1,
    MS2: 5,
    MS3: 10,
    MS4: 30,
    MS5: 60,
    MS6: 60 * 5,
    MS7: 60 * 24
})

const globalPluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}

function selectBestSkip(timeInMinutes, skips, options) {
    const available = Object.entries(skips)
        .filter(([key, count]) => count > 0)
        .map(([key, count]) => ({
            key,
            value: MinuteSkipType[key],
            count
        }));

    if (available.length === 0) return undefined;

    const allowed = available.filter(item => {
        if (item.value <= timeInMinutes) return true;
        return options.bypassSkipTypeFilter || item.value <= timeInMinutes * 4;
    });

    if (allowed.length === 0) return undefined;

    allowed.sort((a, b) => {
        // 1. Surplus inventory priority (original logic: count >= 951 takes priority)
        const aSurplus = a.count >= 951 ? 1 : 0;
        const bSurplus = b.count >= 951 ? 1 : 0;
        if (aSurplus !== bSurplus) {
            return bSurplus - aSurplus;
        }

        // 2. Fit priority
        const aFits = a.value <= timeInMinutes ? 1 : 0;
        const bFits = b.value <= timeInMinutes ? 1 : 0;

        if (aFits !== bFits) {
            return bFits - aFits; // Prefer skips that fit within remaining time
        }

        if (aFits === 1) {
            // Both fit. Prefer the LARGER skip to get closer to 0 faster.
            return b.value - a.value;
        } else {
            // Both over-fit. Prefer the SMALLEST skip to minimize wasted time.
            return a.value - b.value;
        }
    });

    return allowed[0].key;
}

function haveEnoughSkips(time, customPluginOptions) {
    const options = customPluginOptions || globalPluginOptions
    const skips = {
        MS1: options["1Minute"] ? structuredClone(resources['1MinSkip']) : 0,
        MS2: options["5Minute"] ? structuredClone(resources['5MinSkip']) : 0,
        MS3: options["10Minute"] ? structuredClone(resources['10MinSkip']) : 0,
        MS4: options["30Minute"] ? structuredClone(resources['30MinSkip']) : 0,
        MS5: options["1Hour"] ? structuredClone(resources['60MinSkip']) : 0,
        MS6: options["5Hour"] ? structuredClone(resources['5HourSkip']) : 0,
        MS7: options["24Hour"] ? structuredClone(resources['24HourSkip']) : 0
    }
    time = Math.ceil(time / 60)
    
    while (time > 0) {
        const skipKey = selectBestSkip(time, skips, options)
        if (skipKey == undefined)
            return false

        skips[skipKey]--
        time -= MinuteSkipType[skipKey]
    }
    return true 
}

function spendSkip(time, customPluginOptions) {
    const options = customPluginOptions || globalPluginOptions
    const skips = {
        MS1: options["1Minute"] ? resources['1MinSkip'] : 0,
        MS2: options["5Minute"] ? resources['5MinSkip'] : 0,
        MS3: options["10Minute"] ? resources['10MinSkip'] : 0,
        MS4: options["30Minute"] ? resources['30MinSkip'] : 0,
        MS5: options["1Hour"] ? resources['60MinSkip'] : 0,
        MS6: options["5Hour"] ? resources['5HourSkip'] : 0,
        MS7: options["24Hour"] ? resources['24HourSkip'] : 0
    }
    time = Math.ceil(time / 60)
    
    const skipKey = selectBestSkip(time, skips, options)
    if (skipKey == undefined)
        return console.warn("noMoreSkips")

    console.debug("usingSkip", skipKey)

    return skipKey
}

module.exports = { spendSkip, haveEnoughSkips, MinuteSkipType }