/**
 * A library to mount Next app directories as Express middleware.
 *
 * This is a compromise to doing the Next.js blessed microservice approach of
 * using "zones" to allow simpler deployment/maintenance in the early days.
 * https://github.com/zeit/next.js#multi-zones
 */
const express = require('express')
const next = require('next')
const _ = require('lodash')
const path = require('path')
const fs = require('fs')

const findPageNames = async dir => {
  const files = await new Promise((resolve, reject) =>
    fs.readdir(path.resolve(dir, 'pages'), (err, res) =>
      err ? reject(err) : resolve(res)
    )
  )
  return files.filter(f => !f.match(/^_/)).map(f => f.replace('.js', ''))
}

/**
 *  Converts a Next directory into express middleware
 *
 * @param {string} dir A Next app directory
 * @returns {object} An express app
 */
module.exports.dirToMiddleware = async dir => {
  const pathPrefix = '/' + path.parse(dir).base
  const pages = await findPageNames(dir)

  // Setup the next app instance with an asset prefix by directory basename.
  // Create express middleware that prepares the app and handles the request.
  const dev = process.env.NODE_ENV !== 'production'
  const nextApp = next({ dev, dir })
  const app = express()
  const handle = nextApp.getRequestHandler()
  const prepare = _.once(async () => {
    await nextApp.prepare()
    nextApp.setAssetPrefix(pathPrefix)
  })
  const nextHandler = async (req, res) => {
    await prepare()
    handle(req, res)
  }

  // Re-route asset requests to that prefix
  // TODO: Open issue with Next about assuming `assetPrefix` is only a hostname
  // or another port e.g. localhost:5000 or cdn.foo.com vs. localhost:5000/foo
  app.get(pathPrefix + '/_next*', (req, res, next) => {
    req.url = req.url.replace(pathPrefix, '')
    nextHandler(req, res)
  })

  // Whitelist routes based on pages
  pages.forEach(page => {
    if (page === 'index') app.get('/', nextHandler)
    app.get('/' + page, nextHandler)
  })

  // Use express's static asset middleware b/c it passes on control vs.
  // Next's static middle termininating the request with a 404 if not found.
  app.use(express.static(path.resolve(dir, 'public')))

  return app
}
