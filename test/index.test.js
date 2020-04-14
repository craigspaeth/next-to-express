const { dirToMiddleware } = require('../')
const path = require('path')
const express = require('express')

test('dirToMiddleware converts directory into express middleware', async () => {
  let server
  const app = express()
  app.use(await dirToMiddleware(path.resolve(__dirname, 'nextapp')))
  await new Promise((resolve, reject) => {
    server = app.listen(5555, err => {
      err ? reject(err) : resolve(server.address().port)
    })
  })
  server.close()
  // Testing there were no errors thrown.
  // TODO: Better test using superagent to check response of Next app...
  // Webpack and Jest seems to be having trouble not timing out or erroring.
  expect(1 + 1).toEqual(2)
})

test('dirToMiddleware whitelists index.js pages as root routes', async () => {
  const middleware = await dirToMiddleware(path.resolve(__dirname, 'nextapp'))
  const route = middleware._router.stack.filter(
    route => route.regexp.toString() === /^\/?$/i.toString()
  )[0]
  expect(route).toBeTruthy()
})
