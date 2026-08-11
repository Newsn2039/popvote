import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './src/server/socketHandler';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { IncomingMessage, ServerResponse } from 'http';

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.prepare().then(() => {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/api/server-info') {
      const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
      if (railwayDomain) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url: `https://${railwayDomain}` }));
      } else {
        const localIP = getLocalIP();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ip: localIP, port }));
      }
      return;
    }
    if (req.method === 'POST' && req.url === '/api/upload') {
      handleUpload(req, res);
      return;
    }
    const parsedUrl = parse(req.url || '', true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: { origin: '*' },
    maxHttpBufferSize: 10e6,
  });

  setupSocketHandlers(io);

  server.listen(port, hostname, () => {
    const localIP = getLocalIP();
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Local network: http://${localIP}:${port}`);
  });
});

function handleUpload(req: IncomingMessage, res: ServerResponse) {
  const chunks: Buffer[] = [];
  let size = 0;
  const MAX_SIZE = 5 * 1024 * 1024;

  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_SIZE) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File too large' }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const boundary = getBoundary(req.headers['content-type'] || '');
    if (!boundary) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid content type' }));
      return;
    }

    const file = parseMultipart(body, boundary);
    if (!file) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No file found' }));
      return;
    }

    const ext = path.extname(file.filename) || '.jpg';
    const safeName = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    const filePath = path.join(uploadsDir, safeName);
    fs.writeFileSync(filePath, file.data);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: `/uploads/${safeName}` }));
  });
}

function getBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=(?:"([^"]+)"|(\S+))/);
  return match ? (match[1] || match[2]) : null;
}

function parseMultipart(body: Buffer, boundary: string): { filename: string; data: Buffer } | null {
  const boundaryBuf = Buffer.from('--' + boundary);
  const parts: Buffer[] = [];
  let start = 0;

  while (true) {
    const idx = body.indexOf(boundaryBuf, start);
    if (idx === -1) break;
    if (start > 0) {
      parts.push(body.subarray(start, idx - 2));
    }
    start = idx + boundaryBuf.length + 2;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = part.subarray(0, headerEnd).toString();
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    if (filenameMatch) {
      return {
        filename: filenameMatch[1],
        data: part.subarray(headerEnd + 4),
      };
    }
  }
  return null;
}
