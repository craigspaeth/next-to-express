const { dirToMiddleware } = require('../')
const path = require('path')
const express = require('express')
const request = require('superagent')

let server

beforeAll(async () => {
  const app = express()
  app.use(await dirToMiddleware(path.resolve(__dirname, 'nextapp')))
  await new Promise((resolve, reject) => {
    server = app.listen(5555, err => {
      err ? reject(err) : resolve(server.address().port)
    })
  })
})

afterAll(() => {
  server.close()
})

test('dirToMiddleware serves public files', async () => {
  const res = await request.get('http://localhost:5555/test.txt')
  expect(res.text).toContain('Hello world')
})

test('dirToMiddleware whitelists index.js pages as root routes', async () => {
  const middleware = await dirToMiddleware(path.resolve(__dirname, 'nextapp'))
  const route = middleware._router.stack.filter(
    route => route.regexp.toString() === /^\/?$/i.toString()
  )[0]
  expect(route).toBeTruthy()
})
