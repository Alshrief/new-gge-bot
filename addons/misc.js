
if (require('node:worker_threads').isMainThread) {
    return module.exports = {
        force: true,
        hidden: true
    }
}

const { xtHandler, sendXT, events, playerInfo} = require("../ggeBot")

const quests = [3000, 3002, 3019, 3490, 84, 186, 30]
const messageIds = [67]

xtHandler.on("sne", obj => obj.MSG.forEach(([messageID, messageType]) => {
    if(messageIds.includes(messageType))
        sendXT("dms", JSON.stringify({ MID: messageID })) 
}))

xtHandler.on("qli", obj => obj.QL?.forEach(({ QID }) => {
    if(quests.includes(QID))
        sendXT("qsc", JSON.stringify({ QID }))
}))
events.on("eventStart", eventInfo => {
    if (eventInfo.EID != 117)
        return
    if (eventInfo.FTDC != 1)
        return
    if (playerInfo.rubies < 100)
        return

    console.log("grabbedFortuneTellerFortune")
    sendXT("ftl", JSON.stringify({}))
})

// xtHandler.on("gcs", obj => {
//     obj.CHR.forEach(offering => {
//         for (let i = 0; i < offering.FOA; i++) {
//             if (offering.CID == 1) {
//                 console.log("GrabbedOffering", "grabbedLudwig")
//                 sendXT("sct", JSON.stringify({ CID: 1, OID: 6001, IF: 1, AMT: 1 }))
//             }
//             if (offering.CID == 2) {
//                 console.log("GrabbedOffering", "grabbedKnight")
//                 sendXT("sct", JSON.stringify({ CID: 2, OID: 6002, IF: 1, AMT: 1 }))
//             }
//             if (offering.CID == 3) {
//                 console.log("GrabbedOffering", "grabbedBeatrice")
//                 sendXT("sct", JSON.stringify({ CID: 3, OID: 6003, IF: 1, AMT: 1 }))
//             }
//         }
//     })
// })
