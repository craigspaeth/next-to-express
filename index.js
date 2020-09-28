/**
 * A library to mount Next app directories as Express middleware.
 *
 * This is a compromise to doing the Next.js blessed microservice approach of
 * using "zones" to allow simpler deployment/maintenance in the early days.
 * https://github.com/zeit/next.js#multi-zones
 */
const _ = require('lodash')
const { exec } = require('child_process')
const express = require('express')
const fs = require('fs')
const getPort = require('get-port')
const glob = require('glob')
const next = require('next')
const path = require('path')
const httpProxy = require('http-proxy');
const proxy = httpProxy.createProxyServer();

const pathPrefix = dir => '/' + path.parse(dir).base

const findPageNames = async dir => {
  const files = await new Promise((resolve, reject) =>
    glob(`${dir}/pages/**/*js`, (err, res) =>
      err ? reject(err) : resolve(res)
    )
  )
  const paths = files
    .filter(f => !f.match(/^_/))
    .map(f => f.replace(dir + '/pages/', '').replace('.js', ''))
  return paths
}

const proxyNextDir = async (dir) => {
  const port = await getPort()
  const pageNames = await findPageNames(dir)
  exec(
    `node ${__dirname}/sub-app-server.js ${dir} ${port}`,
    console.log.bind(console)
  )
  return (req, res, next) => {
    if (
      req.path.match(new RegExp(`^${pathPrefix(dir)}/_next`)) ||
      pageNames.includes(req.path.slice(1))
    ) {
      proxy.web(req, res, { target: `http://localhost:${port}` })
    } else next()
  }
}

/**
 *  Converts a Next directory into express middleware
 *
 * @param {string} dir A Next app directory
 * @returns {object} An express app
 */
module.exports.dirToExpressApp = async dir => {
  const pages = await findPageNames(dir)
  const dev = process.env.NODE_ENV !== 'production'
  const app = express()
  
  // Setup the next app instance with an asset prefix by directory basename.
  // Create express middleware that prepares the app and handles the request.
  const nextApp = next({ dev, dir })
  const handle = nextApp.getRequestHandler()
  const prepare = _.once(async () => {
    await nextApp.prepare()
    nextApp.setAssetPrefix(pathPrefix(dir))
  })
  const nextHandler = async (req, res) => {
    await prepare()
    handle(req, res)
  }

  // Re-route asset requests to that prefix
  // TODO: Open issue with Next about assuming `assetPrefix` is only a hostname
  // or another port e.g. localhost:5000 or cdn.foo.com vs. localhost:5000/foo
  app.get('/_next*', (req, res, next) => {
    nextHandler(req, res)
  })
  app.get(pathPrefix(dir) + '/_next*', (req, res) => {
    req.url = req.url.replace(pathPrefix(dir), '')
    nextHandler(req, res)
  })

  // Whitelist routes based on pages
  pages.forEach(page => {
    const slugMatch = page.match(/\[.*\]/)
    page = slugMatch
      ? page.replace(/\[.*\]/, ':' + slugMatch[0].replace(/\[|\]/g, ''))
      : page
    if (page === 'index') app.get('/', nextHandler)
    else app.get('/' + page, nextHandler)
  })

  // Use express's static asset middleware b/c it passes on control vs.
  // Next's static middle termininating the request with a 404 if not found.
  app.use(express.static(path.resolve(dir, 'public')))

  return app
}

module.exports.dirToMiddleware = process.env.NODE_ENV === 'production' 
  ? module.exports.dirToExpressApp
  : proxyNextDir
