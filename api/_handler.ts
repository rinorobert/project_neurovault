import type { IncomingMessage, ServerResponse } from 'http'
import { handleApiRoute } from '../src/server/apiRouter'

export default async function handler(
  req: IncomingMessage & { body?: any; query?: any },
  res: ServerResponse
) {
  let body = req.body
  if (!body && req.method !== 'GET' && req.method !== 'HEAD') {
    const buffers: Buffer[] = []
    for await (const chunk of req) {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const raw = Buffer.concat(buffers).toString('utf-8')
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
    url: req.url || '/',
    headers: req.headers,
    body,
  })

  res.statusCode = response.statusCode
  for (const [k, v] of Object.entries(response.headers)) {
    res.setHeader(k, v as string)
  }
  res.end(JSON.stringify(response.body))
}

