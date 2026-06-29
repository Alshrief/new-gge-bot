if (require('node:worker_threads').isMainThread) {
    module.exports = {
        pluginOptions: [
            {
                type: "Text",
                key: "feastFoodReduction",
                default: "150000"
            },
            {
                type: "Text",
                key: "minimumFood",
                default: "150000"
            },
            {
                type: "Text",
                key: "minimumFoodRate",
                default: "0"
            },
        ]
    }
    return
}

const { ClientCommands, KingdomID, AreaType, castles } = require("../protocols.js")
const { events, botConfig } = require("../ggeBot.js")
const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}
const feastFoodReduction = pluginOptions.feastFoodReduction ? Number(pluginOptions.feastFoodReduction): 150000
const minimumFood = pluginOptions.minimumFood ? Number(pluginOptions.minimumFood): 150000
const minimumFoodRate = pluginOptions.minimumFoodRate ? Number(pluginOptions.minimumFoodRate) : 0

const tryToFeast = async () => {
    let feasts = 0

    castles.forEach(castle => {
        if(castle.kingdomID == KingdomID.stormIslands)
            return
        if (castle.kingdomID == KingdomID.berimond)
            return
        let foodRate = castle.getProductionData.deltaFood - castle.getProductionData.FoodConsumptionRate * 
            castle.getProductionData.foodConsumptionReductionPercentage
        if (foodRate < Math.max(0, minimumFoodRate))
            return
        
        if(castle.kingdomID == KingdomID.greatEmpire && castle.areaInfo.type == AreaType.mainCastle && castle.getProductionData.maxAmountFood < castle.food)
            return

        while (minimumFood < (castle.food - feastFoodReduction) && feastFoodReduction <= castle.food) {
            ClientCommands.startFeast(8, castle.id, castle.kingdomID)
            feasts++
            castle.food -= feastFoodReduction
        }
    })

    if (feasts > 0)
        console.log("consumed", feastFoodReduction * feasts)
    else {
        console.log("notEnoughFoodToFeast")
    }
}

events.once("load", () => {
    setInterval(tryToFeast, 1000 * 60 * 8)
    tryToFeast()
})