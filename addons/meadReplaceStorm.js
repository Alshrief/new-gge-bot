if (require('node:worker_threads').isMainThread)
    return module.exports = { hidden: true }