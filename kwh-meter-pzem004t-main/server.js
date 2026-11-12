/**
 * Local Development Server
 * Emulates Vercel Serverless environment and serves static dashboard files.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import telemetryHandler from './api/telemetry.js';
import statusHandler from './api/device/status.js';
import historyHandler from './api/history.js';
import summaryHandler from './api/summary.js';
import configHandler from './api/config.js';
import resetHandler from './api/device/reset-database.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
  });
}

function adaptVercelRes(res) {
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
    this.end(JSON.stringify(data));
    return this;
  };
  res.send = function(data) {
    this.end(data);
    return this;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  adaptVercelRes(res);
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  req.query = Object.fromEntries(parsedUrl.searchParams.entries());

  // API Routing
  try {
    if (pathname === '/api/telemetry') {
      req.body = await parseBody(req);
      return await telemetryHandler(req, res);
    }
    if (pathname === '/api/device/status') {
      return await statusHandler(req, res);
    }
    if (pathname === '/api/history') {
      if (req.method === 'DELETE') {
        req.body = await parseBody(req);
        return await resetHandler(req, res);
      }
      return await historyHandler(req, res);
    }
    if (pathname === '/api/summary') {
      return await summaryHandler(req, res);
    }
    if (pathname === '/api/config') {
      return await configHandler(req, res);
    }
    if (pathname === '/api/device/reset-database' || pathname === '/api/reset') {
      req.body = await parseBody(req);
      return await resetHandler(req, res);
    }
  } catch (err) {
    console.error('Server error on route:', pathname, err);
    return res.status(500).json({ success: false, error: err.message });
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      return res.end('404 Not Found');
    }
    res.setHeader('Content-Type', contentType);
    res.end(content);
  });
});

const isDirectRun = process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server'));

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`⚡ KWH METER API & DASHBOARD SERVER RUNNING`);
    console.log(`🌐 Local Web UI : http://localhost:${PORT}`);
    console.log(`📡 Ingestion API: http://localhost:${PORT}/api/telemetry`);
    console.log(`=================================================\n`);
  });
}

export default server;
