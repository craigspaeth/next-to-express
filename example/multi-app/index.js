const express = require('express')
const { dirToMiddleware } = require('../../')
const path = require('path')

const app = express()

;(async () => {
    app.use(await dirToMiddleware(path.resolve(__dirname, './app2')))
    app.use(await dirToMiddleware(path.resolve(__dirname, './app1')))
    app.listen(3000, () => console.log('Multi-app listening on 3000'))
})()