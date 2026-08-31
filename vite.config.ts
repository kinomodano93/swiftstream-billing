import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import http from 'http';
import https from 'https';
import { URL } from 'url';

function mikrotikProxyPlugin(): Plugin {
  return {
    name: 'mikrotik-cors-proxy',
    configureServer(server) {
      // 1. Generic RouterOS REST CORS proxy
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

      // 1B. Quick Router Test & Interface Discovery Endpoint
      server.middlewares.use('/api/mikrotikTest', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        let bodyData = '';
        req.on('data', (chunk) => (bodyData += chunk));
        req.on('end', async () => {
          try {
            let body: any = {};
            try {
              body = bodyData ? JSON.parse(bodyData) : {};
            } catch (_) {}

            const host = (body.host || 'remote.oxapsph.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            const port = Number(body.port || 10988);
            const username = body.username || 'admin';
            const password = body.password || '';
            const isHttps = body.useHttps === true || port === 443;
            const transport = isHttps ? https : http;

            const fetchJson = (path: string, method = 'GET', postData?: any): Promise<any> => {
              return new Promise((resolve) => {
                const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
                const payloadStr = postData ? JSON.stringify(postData) : undefined;
                const headers: Record<string, string> = {
                  'Authorization': authHeader,
                  'Accept': 'application/json',
                };
                if (payloadStr) {
                  headers['Content-Type'] = 'application/json';
                  headers['Content-Length'] = Buffer.byteLength(payloadStr).toString();
                }

                const cReq = transport.request(
                  {
                    protocol: isHttps ? 'https:' : 'http:',
                    hostname: host,
                    port: port,
                    path: `/rest${path}`,
                    method,
                    headers,
                    timeout: 8000,
                  },
                  (cRes) => {
                    let data = '';
                    cRes.on('data', (chunk) => (data += chunk));
                    cRes.on('end', () => {
                      console.log(`[MikroTik Proxy] ${method} /rest${path} -> HTTP ${cRes.statusCode} (${data.length} bytes)`);
                      try {
                        const parsed = JSON.parse(data);
                        resolve({ statusCode: cRes.statusCode, data: parsed });
                      } catch {
                        resolve({ statusCode: cRes.statusCode, data: null, raw: data });
                      }
                    });
                  }
                );
                cReq.on('error', (err) => {
                  console.warn(`[MikroTik Proxy] error on /rest${path}:`, err.message);
                  resolve({ statusCode: 500, error: err.message });
                });
                cReq.on('timeout', () => {
                  cReq.destroy();
                  resolve({ statusCode: 408, error: 'timeout' });
                });
                if (payloadStr) {
                  cReq.write(payloadStr);
                }
                cReq.end();
              });
            };

            // Query resource and interfaces in parallel with multi-path interface fallback
            const resourceRes = await fetchJson('/system/resource');
            let interfacesRes = await fetchJson('/interface');

            // If /interface was empty or 404, fallback to /interface/ethernet or /interface/print
            if (!interfacesRes?.data || (Array.isArray(interfacesRes.data) && interfacesRes.data.length === 0)) {
              interfacesRes = await fetchJson('/interface/ethernet');
            }
            if (!interfacesRes?.data || (Array.isArray(interfacesRes.data) && interfacesRes.data.length === 0)) {
              interfacesRes = await fetchJson('/interface/print', 'POST', {});
            }

            const resource = resourceRes?.data;
            let rawIfaces = interfacesRes?.data;
            let ifaceList: any[] = [];

            if (Array.isArray(rawIfaces)) {
              ifaceList = rawIfaces;
            } else if (rawIfaces && typeof rawIfaces === 'object') {
              ifaceList = Object.values(rawIfaces).filter((v: any) => v && (v.name || v['.id']));
              if (ifaceList.length === 0 && rawIfaces.name) {
                ifaceList = [rawIfaces];
              }
            }

            res.statusCode = resourceRes?.statusCode === 401 || resourceRes?.statusCode === 403 ? resourceRes.statusCode : 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: !!resource,
                statusCode: resourceRes?.statusCode || 200,
                message: resource ? 'MikroTik connected successfully' : (resourceRes?.statusCode === 401 ? 'Authentication failed (Invalid password)' : 'Unable to reach RouterOS REST API'),
                router: resource,
                interfaces: ifaceList,
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 2. Direct Real-Time Telemetry Snapshot Handler (Includes Real Interfaces)
      server.middlewares.use('/api/mikrotikTelemetry', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        let bodyData = '';
        req.on('data', (chunk) => (bodyData += chunk));
        req.on('end', async () => {
          try {
            let body: any = {};
            try {
              body = bodyData ? JSON.parse(bodyData) : {};
            } catch (_) {}

            const host = (body.host || 'remote.oxapsph.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            const port = Number(body.port || 10988);
            const username = body.username || 'admin';
            const password = body.password || '';
            const isHttps = body.useHttps === true || port === 443;
            const transport = isHttps ? https : http;
            const wanTarget = body.wanInterface || 'all';
            const sfpTarget = body.sfpInterface || 'sfp-sfpplus1';

            const fetchJson = (path: string, method = 'GET', postData?: any): Promise<any> => {
              return new Promise((resolve) => {
                const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
                const bodyStr = postData ? JSON.stringify(postData) : undefined;
                const headers: Record<string, string> = {
                  'Authorization': authHeader,
                  'Accept': 'application/json',
                };
                if (bodyStr) {
                  headers['Content-Type'] = 'application/json';
                  headers['Content-Length'] = Buffer.byteLength(bodyStr).toString();
                }

                const cReq = transport.request(
                  {
                    protocol: isHttps ? 'https:' : 'http:',
                    hostname: host,
                    port: port,
                    path: `/rest${path}`,
                    method,
                    headers,
                    timeout: 4000,
                  },
                  (cRes) => {
                    let data = '';
                    cRes.on('data', (chunk) => (data += chunk));
                    cRes.on('end', () => {
                      try {
                        resolve(JSON.parse(data));
                      } catch {
                        resolve(null);
                      }
                    });
                  }
                );

                cReq.on('error', () => resolve(null));
                cReq.on('timeout', () => {
                  cReq.destroy();
                  resolve(null);
                });

                if (bodyStr) cReq.write(bodyStr);
                cReq.end();
              });
            };

            const t0 = Date.now();
            const [resource, health, interfaces, ethernetList, monitorTraffic, pppActive, queues, sfpRaw] = await Promise.all([
              fetchJson('/system/resource'),
              fetchJson('/system/health'),
              fetchJson('/interface'),
              fetchJson('/interface/ethernet'),
              fetchJson('/interface/monitor-traffic', 'POST', { interface: wanTarget, once: '' }),
              fetchJson('/ppp/active'),
              fetchJson('/queue/simple'),
              fetchJson('/interface/ethernet/monitor', 'POST', { numbers: sfpTarget, once: '' }),
            ]);

            let sfpDiagnostics = Array.isArray(sfpRaw) ? sfpRaw[0] : sfpRaw;
            if ((!sfpDiagnostics || Object.keys(sfpDiagnostics).length === 0) && Array.isArray(ethernetList)) {
              const ethMatch = ethernetList.find((e: any) => e.name === sfpTarget || e['default-name'] === sfpTarget);
              if (ethMatch) {
                sfpDiagnostics = ethMatch;
              }
            }

            const routerLatencyMs = Date.now() - t0;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: !!resource,
                resource,
                health,
                interfaces,
                ethernet: ethernetList,
                monitorTraffic,
                pppActive,
                queues,
                sfpDiagnostics,
                routerLatencyMs,
                timestamp: new Date().toISOString(),
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 3. Kick Active PPPoE Session
      server.middlewares.use('/api/mikrotikKickSession', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        let bodyData = '';
        req.on('data', (chunk) => (bodyData += chunk));
        req.on('end', async () => {
          try {
            const body = bodyData ? JSON.parse(bodyData) : {};
            const host = (body.host || 'remote.oxapsph.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            const port = Number(body.port || 10890);
            const username = body.username || 'admin';
            const password = body.password || '';
            const isHttps = port === 443;
            const transport = isHttps ? https : http;

            const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
            const targetId = body.sessionId;

            const cReq = transport.request(
              {
                protocol: isHttps ? 'https:' : 'http:',
                hostname: host,
                port: port,
                path: targetId ? `/rest/ppp/active/${encodeURIComponent(targetId)}` : `/rest/ppp/active/remove`,
                method: targetId ? 'DELETE' : 'POST',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/json',
                },
                timeout: 4000,
              },
              (cRes) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, message: `PPPoE session disconnected` }));
              }
            );

            cReq.on('error', (err) => {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            });

            cReq.end();
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 4. Dedicated /api/getInterfaces and /api/getMikrotikInterfaces Endpoints
      const handleGetInterfaces = (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        let bodyData = '';
        req.on('data', (chunk) => (bodyData += chunk));
        req.on('end', async () => {
          try {
            let body: any = {};
            try {
              body = bodyData ? JSON.parse(bodyData) : {};
            } catch (_) {}

            const host = (body.host || 'remote.oxapsph.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            const port = Number(body.port || 10988);
            const username = body.username || 'admin';
            const password = body.password || '';
            const isHttps = port === 443;
            const transport = isHttps ? https : http;

            const fetchJsonPath = (path: string, method = 'GET', postData?: any): Promise<any> => {
              return new Promise((resolve) => {
                const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
                const payloadStr = postData ? JSON.stringify(postData) : undefined;
                const headers: Record<string, string> = {
                  'Authorization': authHeader,
                  'Accept': 'application/json',
                };
                if (payloadStr) {
                  headers['Content-Type'] = 'application/json';
                  headers['Content-Length'] = Buffer.byteLength(payloadStr).toString();
                }

                const cReq = transport.request(
                  {
                    protocol: isHttps ? 'https:' : 'http:',
                    hostname: host,
                    port: port,
                    path: `/rest${path}`,
                    method,
                    headers,
                    timeout: 8000,
                  },
                  (cRes) => {
                    let data = '';
                    cRes.on('data', (chunk) => (data += chunk));
                    cRes.on('end', () => {
                      try {
                        const parsed = JSON.parse(data);
                        resolve({ statusCode: cRes.statusCode, data: parsed });
                      } catch {
                        resolve({ statusCode: cRes.statusCode, data: null });
                      }
                    });
                  }
                );
                cReq.on('error', () => resolve({ statusCode: 500, data: null }));
                cReq.on('timeout', () => {
                  cReq.destroy();
                  resolve({ statusCode: 408, data: null });
                });
                if (payloadStr) {
                  cReq.write(payloadStr);
                }
                cReq.end();
              });
            };

            let ifaceRes = await fetchJsonPath('/interface');
            if (!ifaceRes?.data || (Array.isArray(ifaceRes.data) && ifaceRes.data.length === 0)) {
              ifaceRes = await fetchJsonPath('/interface/ethernet');
            }
            if (!ifaceRes?.data || (Array.isArray(ifaceRes.data) && ifaceRes.data.length === 0)) {
              ifaceRes = await fetchJsonPath('/interface/print', 'POST', {});
            }

            let ifaceList: any[] = [];
            const rawIfaces = ifaceRes?.data;
            if (Array.isArray(rawIfaces)) {
              ifaceList = rawIfaces;
            } else if (rawIfaces && typeof rawIfaces === 'object') {
              ifaceList = Object.values(rawIfaces).filter((v: any) => v && (v.name || v['.id']));
              if (ifaceList.length === 0 && rawIfaces.name) {
                ifaceList = [rawIfaces];
              }
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: ifaceList.length > 0,
                count: ifaceList.length,
                interfaces: ifaceList,
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      };
      server.middlewares.use('/api/mikrotikInterfaces', handleGetInterfaces);
      server.middlewares.use('/api/getInterfaces', handleGetInterfaces);
      server.middlewares.use('/api/getMikrotikInterfaces', handleGetInterfaces);

      // 4B. Dedicated /api/getInterfaceTraffic Endpoint
      server.middlewares.use('/api/getInterfaceTraffic', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        let bodyData = '';
        req.on('data', (chunk) => (bodyData += chunk));
        req.on('end', async () => {
          try {
            let body: any = {};
            try {
              body = bodyData ? JSON.parse(bodyData) : {};
            } catch (_) {}

            const urlObj = new URL(req.url || '', 'http://localhost');
            const iface = urlObj.searchParams.get('interface') || body.interface || 'ether1';
            const host = (body.host || 'remote.oxapsph.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            const port = Number(body.port || 10988);
            const username = body.username || 'admin';
            const password = body.password || '';
            const isHttps = port === 443;
            const transport = isHttps ? https : http;

            const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
            const postBody = JSON.stringify({ interface: iface, once: '' });

            const cReq = transport.request(
              {
                protocol: isHttps ? 'https:' : 'http:',
                hostname: host,
                port: port,
                path: '/rest/interface/monitor-traffic',
                method: 'POST',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(postBody).toString(),
                  'Accept': 'application/json',
                },
                timeout: 8000,
              },
              (cRes) => {
                let data = '';
                cRes.on('data', (chunk) => (data += chunk));
                cRes.on('end', () => {
                  try {
                    const parsed = JSON.parse(data);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(
                      JSON.stringify({
                        success: true,
                        interface: iface,
                        traffic: Array.isArray(parsed) ? parsed[0] : parsed,
                      })
                    );
                  } catch (e: any) {
                    res.statusCode = 502;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: 'Invalid response from MikroTik' }));
                  }
                });
              }
            );

            cReq.on('error', (err) => {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            });

            cReq.write(postBody);
            cReq.end();
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 5. SFP DDM Optical Diagnostics Endpoint
      server.middlewares.use('/api/getSfpDiagnostics', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        let bodyData = '';
        req.on('data', (chunk) => (bodyData += chunk));
        req.on('end', async () => {
          try {
            let body: any = {};
            try {
              body = bodyData ? JSON.parse(bodyData) : {};
            } catch (_) {}

            const host = (body.host || 'remote.oxapsph.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            const port = Number(body.port || 10988);
            const username = body.username || 'admin';
            const password = body.password || '';
            const isHttps = port === 443;
            const transport = isHttps ? https : http;
            const targetPort = body.portName || 'sfp-sfpplus1';

            const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
            const bodyPayload = JSON.stringify({ numbers: targetPort, once: '' });

            const cReq = transport.request(
              {
                protocol: isHttps ? 'https:' : 'http:',
                hostname: host,
                port: port,
                path: '/rest/interface/ethernet/monitor',
                method: 'POST',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(bodyPayload).toString(),
                  'Accept': 'application/json',
                },
                timeout: 8000,
              },
              (cRes) => {
                let data = '';
                cRes.on('data', (chunk) => (data += chunk));
                  cRes.on('end', () => {
                    try {
                      const parsed = JSON.parse(data);
                      let ddm = Array.isArray(parsed) ? parsed[0] : parsed;
                      if ((!ddm || Object.keys(ddm).length === 0 || ddm.message || ddm.error) && !ddm?.['sfp-rx-power']) {
                        // Fallback lookup from /rest/interface/ethernet
                        const ethReq = transport.request(
                          {
                            protocol: isHttps ? 'https:' : 'http:',
                            hostname: host,
                            port: port,
                            path: '/rest/interface/ethernet',
                            method: 'GET',
                            headers: {
                              'Authorization': authHeader,
                              'Accept': 'application/json',
                            },
                            timeout: 4000,
                          },
                          (eRes) => {
                            let ethData = '';
                            eRes.on('data', (c) => (ethData += c));
                            eRes.on('end', () => {
                              try {
                                const ethList = JSON.parse(ethData);
                                const match = Array.isArray(ethList)
                                  ? ethList.find((e: any) => e.name === targetPort || e['default-name'] === targetPort)
                                  : null;
                                res.statusCode = 200;
                                res.setHeader('Content-Type', 'application/json');
                                res.end(
                                  JSON.stringify({
                                    success: true,
                                    portName: targetPort,
                                    diagnostics: match || ddm || {},
                                  })
                                );
                              } catch {
                                res.statusCode = 200;
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true, portName: targetPort, diagnostics: ddm || {} }));
                              }
                            });
                          }
                        );
                        ethReq.on('error', () => {
                          res.statusCode = 200;
                          res.setHeader('Content-Type', 'application/json');
                          res.end(JSON.stringify({ success: true, portName: targetPort, diagnostics: ddm || {} }));
                        });
                        ethReq.end();
                        return;
                      }

                      res.statusCode = 200;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(
                        JSON.stringify({
                          success: true,
                          portName: targetPort,
                          diagnostics: ddm || {},
                        })
                      );
                    } catch (e: any) {
                      res.statusCode = 502;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ success: false, error: 'Invalid response from MikroTik', raw: data }));
                    }
                  });
              }
            );

            cReq.on('error', (err) => {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            });

            cReq.write(bodyPayload);
            cReq.end();
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });

      // 6. Simple Queues Inspector Endpoint
      server.middlewares.use('/api/getQueueList', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        let bodyData = '';
        req.on('data', (chunk) => (bodyData += chunk));
        req.on('end', async () => {
          try {
            let body: any = {};
            try {
              body = bodyData ? JSON.parse(bodyData) : {};
            } catch (_) {}

            const host = (body.host || 'remote.oxapsph.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            const port = Number(body.port || 10988);
            const username = body.username || 'admin';
            const password = body.password || '';
            const isHttps = port === 443;
            const transport = isHttps ? https : http;

            const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
            const cReq = transport.request(
              {
                protocol: isHttps ? 'https:' : 'http:',
                hostname: host,
                port: port,
                path: '/rest/queue/simple',
                method: 'GET',
                headers: {
                  'Authorization': authHeader,
                  'Accept': 'application/json',
                },
                timeout: 8000,
              },
              (cRes) => {
                let data = '';
                cRes.on('data', (chunk) => (data += chunk));
                cRes.on('end', () => {
                  try {
                    const parsed = JSON.parse(data);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(
                      JSON.stringify({
                        success: true,
                        count: Array.isArray(parsed) ? parsed.length : 0,
                        queues: Array.isArray(parsed) ? parsed : [],
                      })
                    );
                  } catch (e: any) {
                    res.statusCode = 502;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: 'Invalid response from MikroTik', raw: data }));
                  }
                });
              }
            );

            cReq.on('error', (err) => {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            });

            cReq.end();
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
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
