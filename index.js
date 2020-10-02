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

/**
 *  Converts a Next directory into express middleware
 *
 * @param {string} dir A Next app directory
 * @param {object} options
 * @param {boolean} options.isProxied Run next app as an isolated process
 * @returns {object} An express app
 */
module.exports.dirToMiddleware = async (dir, {
  isProxied = process.env.NODE_ENV !== 'production'
} = {}) => {
  const pages = await findPageNames(dir)
  const app = express()
  const dev = process.env.NODE_ENV !== 'production'
  let nextHandler

  // Setup the next app instance with an asset prefix by directory basename.
  // Create express middleware that prepares the app and handles the request.
  if (isProxied) {
    const port = await getPort()
    const { stderr, stdout } = exec(
      `node ${__dirname}/sub-app-server.js ${dir} ${port}`
    )
    stderr.pipe(process.stderr)
    stdout.pipe(process.stdout)
    nextHandler = (req, res) =>
      proxy.web(
        req,
        res,
        { target: `http://localhost:${port}` },
        console.error.bind(console)
      )
  } else {
    const nextApp = next({ dev, dir })
    const handle = nextApp.getRequestHandler()
    const prepare = _.once(async () => {
      await nextApp.prepare()
      nextApp.setAssetPrefix(pathPrefix(dir))
    })
    nextHandler = async (req, res) => {
      await prepare()
      handle(req, res)
    }
  }

  // Re-route asset requests to that prefix
  // TODO: Open issue with Next about assuming `assetPrefix` is only a hostname
  // or another port e.g. localhost:5000 or cdn.foo.com vs. localhost:5000/foo
  if (dev) app.get('/_next*', nextHandler)
  else app.use('/_next/static', express.static(path.resolve(dir, '.next/static')))
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
