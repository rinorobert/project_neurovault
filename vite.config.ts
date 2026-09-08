import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleApiRoute } from './src/server/apiRouter'

function apiDevMiddleware() {
  return {
    name: 'api-dev-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/api/')) {
          let body: any = undefined
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
            }
            const raw = Buffer.concat(chunks).toString('utf-8')
            if (raw) {
              try {
                body = JSON.parse(raw)
              } catch {
                body = raw
              }
            }
          }

          const response = await handleApiRoute({
            method: req.method || 'GET',
            url: req.url,
            headers: req.headers,
            body,
          })

          res.statusCode = response.statusCode
          for (const [k, v] of Object.entries(response.headers)) {
            res.setHeader(k, v)
          }
          res.end(JSON.stringify(response.body))
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiDevMiddleware()],
  server: {
    host: true,
  },
})
