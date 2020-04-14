# next-to-express

Middleware to convert a Next.js app into express middleware.

## Example

````javascript
import express from 'express'
import { dirToMiddleware } from 'next-to-express'

const app = express()

app.use(await dirToMiddleware(__dirname + './app1')
app.use(await dirToMiddleware(__dirname + './app2')
````

## Contributing

Please fork the project and submit a pull request with tests. Install node modules `npm install` and run tests with `npm test`.

## License

MIT
