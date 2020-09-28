const express = require('express')
const app = express()
const { dirToExpressApp } = require('./')

;(async () => {
    const [_, __, dir, port] = process.argv
    app.use(await dirToExpressApp(dir))
    app.listen(Number(port))
})()
