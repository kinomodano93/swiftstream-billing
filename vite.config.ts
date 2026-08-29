import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import http from 'http';
import https from 'https';
import { URL } from 'url';

function mikrotikProxyPlugin(): Plugin {
  return {
    name: 'mikrotik-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/mikrotik-proxy', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-target-url');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const reqUrl = new URL(req.url || '', 'http://localhost');
        const targetUrl = (req.headers['x-target-url'] as string) || reqUrl.searchParams.get('url');

        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing x-target-url header or url query parameter' }));
          return;
        }

        try {
          const parsed = new URL(targetUrl);
          const isHttps = parsed.protocol === 'https:';
          const transport = isHttps ? https : http;

          const forwardHeaders: Record<string, string> = {
            host: parsed.host,
          };
          if (req.headers.authorization) {
            forwardHeaders.authorization = req.headers.authorization as string;
          }
          if (req.headers['content-type']) {
            forwardHeaders['content-type'] = req.headers['content-type'] as string;
          }

          const clientReq = transport.request(
            {
              protocol: parsed.protocol,
              hostname: parsed.hostname,
              port: parsed.port || (isHttps ? 443 : 80),
              path: parsed.pathname + parsed.search,
              method: req.method,
              headers: forwardHeaders,
              timeout: 7000,
            },
            (clientRes) => {
              res.statusCode = clientRes.statusCode || 200;
              res.setHeader('Content-Type', clientRes.headers['content-type'] || 'application/json');
              clientRes.pipe(res);
            }
          );

          clientReq.on('error', (err) => {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Connection failed: ${err.message}` }));
          });

          clientReq.on('timeout', () => {
            clientReq.destroy();
            res.statusCode = 504;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Gateway timeout: MikroTik did not respond within 7s' }));
          });

          if (req.method === 'GET' || req.method === 'HEAD' || !req.headers['content-length']) {
            clientReq.end();
          } else {
            req.pipe(clientReq);
          }
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message || 'Internal proxy error' }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mikrotikProxyPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});

