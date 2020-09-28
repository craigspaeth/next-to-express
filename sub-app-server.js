const express = require('express')
const app = express()
const { dirToMiddleware } = require('./')

;(async () => {
    const [_, __, dir, port] = process.argv
    app.use(await dirToMiddleware(dir, { isProxied: false }))
    app.listen(Number(port))
})()
