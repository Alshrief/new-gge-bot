const path = require('node:path')
const fs = require("fs")
const ggeConfig = require("../ggeConfig.json")

const dir = fs.readdirSync(__dirname, {recursive : true})
const plugins = []

dir.forEach(file => {
    if(file == path.basename(__filename))
        return
    let pathSeperator = '/'
    if(process.platform == "win32")
         pathSeperator = '\\'

    if(path.extname(file) != ".js")
        return

    plugins.push([`addons/${file.slice(0, -3)}`, require(path.join(__dirname, file))])
})

module.exports = plugins
