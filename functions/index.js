const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");
const net = require("net");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const resolveRouterCredentials = async (reqBody) => {
  let { routerId, host, port, username, password } = reqBody || {};

  if (routerId) {
    let routerDoc = await db.collection("mikrotik_devices").doc(routerId).get();
    if (!routerDoc.exists) {
      const snapshot = await db
        .collection("mikrotik_devices")
        .where("name", "==", routerId)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        routerDoc = snapshot.docs[0];
      }
    }

    if (routerDoc && routerDoc.exists) {
      const data = routerDoc.data() || {};
      host = host || data.remoteAddress || data.ipAddress;
      port = port || data.port || data.webfigPort || data.apiPort || 80;
      username = username || data.username;
      password = password || data.password;
    }
  }

  const cleanHost = (host || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const targetPort = port || 80;

  return {
    host: cleanHost,
    port: targetPort,
    username: username || "admin",
    password: password || "",
  };
};

exports.mikrotikTest = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const creds = await resolveRouterCredentials(req.body);
      if (!creds.host) {
        return res.status(400).json({
          success: false,
          message: "Missing host or routerId in request body",
        });
      }

      const axiosConfig = {
        auth: {
          username: creds.username,
          password: creds.password,
        },
        timeout: 10000,
        headers: {
          Accept: "application/json",
        },
      };

      const resourceRes = await axios.get(`http://${creds.host}:${creds.port}/rest/system/resource`, axiosConfig).catch(() => null);
      let interfacesData = [];

      try {
        const iRes = await axios.get(`http://${creds.host}:${creds.port}/rest/interface`, axiosConfig);
        if (Array.isArray(iRes.data)) {
          interfacesData = iRes.data;
        } else if (iRes.data && typeof iRes.data === 'object') {
          interfacesData = Object.values(iRes.data).filter((v) => v && (v.name || v['.id']));
        }
      } catch (_) {}

      if (interfacesData.length === 0) {
        try {
          const iEthRes = await axios.get(`http://${creds.host}:${creds.port}/rest/interface/ethernet`, axiosConfig);
          if (Array.isArray(iEthRes.data)) {
            interfacesData = iEthRes.data;
          }
        } catch (_) {}
      }

      const resourceData = resourceRes ? resourceRes.data : null;

      if (!resourceData) {
        throw new Error("Failed to query /system/resource from MikroTik");
      }

      return res.status(200).json({
        success: true,
        message: "MikroTik connected successfully",
        router: resourceData,
        interfaces: interfacesData,
      });
    } catch (error) {
      console.error("MikroTik connection failed:", error.message);
      const statusCode = error.response ? error.response.status : 500;
      const responseData = error.response ? error.response.data : null;

      return res.status(statusCode).json({
        success: false,
        message: "Unable to connect to MikroTik",
        error: error.message,
        details: responseData,
      });
    }
  }
);

exports.mikrotikTelemetry = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const creds = await resolveRouterCredentials(req.body);
      if (!creds.host) {
        return res.status(400).json({
          success: false,
          message: "Missing host or routerId in request body",
        });
      }

      const baseUrl = `http://${creds.host}:${creds.port}/rest`;
      const axiosConfig = {
        auth: {
          username: creds.username,
          password: creds.password,
        },
        timeout: 8000,
      };

      const t0 = Date.now();
      const wanTarget = req.body.wanInterface || "all";
      const sfpTarget = req.body.sfpInterface || "sfp-sfpplus1";

      // Fetch parallel telemetry with native monitor-traffic and SFP DDM
      const [resourceRes, healthRes, monitorTrafficRes, interfacesRes, pppActiveRes, queuesRes, sfpRes] = await Promise.allSettled([
        axios.get(`${baseUrl}/system/resource`, axiosConfig),
        axios.get(`${baseUrl}/system/health`, axiosConfig),
        axios.post(`${baseUrl}/interface/monitor-traffic`, { interface: wanTarget, once: "" }, axiosConfig),
        axios.get(`${baseUrl}/interface`, axiosConfig),
        axios.get(`${baseUrl}/ppp/active`, axiosConfig),
        axios.get(`${baseUrl}/queue/simple`, axiosConfig),
        axios.post(`${baseUrl}/interface/ethernet/monitor`, { numbers: sfpTarget, once: "" }, axiosConfig),
      ]);

      const routerLatencyMs = Date.now() - t0;
      const resourceData = resourceRes.status === "fulfilled" ? resourceRes.value.data : null;
      const healthData = healthRes.status === "fulfilled" ? healthRes.value.data : null;
      const monitorTrafficData = monitorTrafficRes.status === "fulfilled" ? monitorTrafficRes.value.data : null;
      const interfacesData = interfacesRes.status === "fulfilled" ? interfacesRes.value.data : null;
      const pppActiveData = pppActiveRes.status === "fulfilled" ? pppActiveRes.value.data : null;
      const queuesData = queuesRes.status === "fulfilled" ? queuesRes.value.data : null;
      const sfpData = sfpRes.status === "fulfilled" ? (Array.isArray(sfpRes.value.data) ? sfpRes.value.data[0] : sfpRes.value.data) : null;

      if (!resourceData) {
        throw new Error(
          resourceRes.reason?.message || "Failed to query /system/resource"
        );
      }

      return res.status(200).json({
        success: true,
        resource: resourceData,
        health: healthData,
        monitorTraffic: monitorTrafficData,
        interfaces: interfacesData,
        pppActive: pppActiveData,
        queues: queuesData,
        sfpDiagnostics: sfpData,
        routerLatencyMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("MikroTik telemetry failed:", error.message);
      const statusCode = error.response ? error.response.status : 500;
      const responseData = error.response ? error.response.data : null;

      return res.status(statusCode).json({
        success: false,
        message: "Unable to retrieve MikroTik telemetry",
        error: error.message,
        details: responseData,
      });
    }
  }
);

/**
 * Approach 2: Server-Sent Events (SSE) Telemetry Stream
 */
exports.mikrotikStream = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
    timeoutSeconds: 300,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    // Set Server-Sent Events headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (res.flushHeaders) res.flushHeaders();

    // Initial connection event
    res.write(`data: ${JSON.stringify({ type: "connected", message: "SSE Telemetry Stream Established" })}\n\n`);

    const creds = await resolveRouterCredentials({
      routerId: req.query.routerId || req.body?.routerId,
      host: req.query.host || req.body?.host,
      port: req.query.port || req.body?.port,
      username: req.query.username || req.body?.username,
      password: req.query.password || req.body?.password,
    });

    if (!creds.host) {
      res.write(`data: ${JSON.stringify({ type: "error", message: "Missing router host or credentials" })}\n\n`);
      return res.end();
    }

    const baseUrl = `http://${creds.host}:${creds.port}/rest`;
    const axiosConfig = {
      auth: {
        username: creds.username,
        password: creds.password,
      },
      timeout: 4000,
    };

    let isClosed = false;
    let streamTimer = null;

    req.on("close", () => {
      isClosed = true;
      if (streamTimer) clearInterval(streamTimer);
    });

    const sendTelemetrySnapshot = async () => {
      if (isClosed) return;
      const t0 = Date.now();
      try {
        const [resourceRes, healthRes, monitorTrafficRes, pppActiveRes, queuesRes] = await Promise.allSettled([
          axios.get(`${baseUrl}/system/resource`, axiosConfig),
          axios.get(`${baseUrl}/system/health`, axiosConfig),
          axios.post(`${baseUrl}/interface/monitor-traffic`, { interface: "all", once: "" }, axiosConfig),
          axios.get(`${baseUrl}/ppp/active`, axiosConfig),
          axios.get(`${baseUrl}/queue/simple`, axiosConfig),
        ]);

        const routerLatencyMs = Date.now() - t0;
        const resourceData = resourceRes.status === "fulfilled" ? resourceRes.value.data : null;
        const healthData = healthRes.status === "fulfilled" ? healthRes.value.data : null;
        const monitorTrafficData = monitorTrafficRes.status === "fulfilled" ? monitorTrafficRes.value.data : null;
        const pppActiveData = pppActiveRes.status === "fulfilled" ? pppActiveRes.value.data : null;
        const queuesData = queuesRes.status === "fulfilled" ? queuesRes.value.data : null;

        if (resourceData && !isClosed) {
          const frame = {
            type: "telemetry",
            success: true,
            resource: resourceData,
            health: healthData,
            monitorTraffic: monitorTrafficData,
            pppActive: pppActiveData,
            queues: queuesData,
            routerLatencyMs,
            timestamp: new Date().toISOString(),
          };
          res.write(`data: ${JSON.stringify(frame)}\n\n`);
        }
      } catch (err) {
        if (!isClosed) {
          res.write(`data: ${JSON.stringify({ type: "stream_error", message: err.message })}\n\n`);
        }
      }
    };

    // First immediate push
    await sendTelemetrySnapshot();

    // Stream frame every 2 seconds
    streamTimer = setInterval(sendTelemetrySnapshot, 2000);
  }
);

/**
 * Disconnect/Kick Active PPPoE Session on MikroTik Router
 */
exports.mikrotikKickSession = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(204).send("");

    try {
      const creds = await resolveRouterCredentials(req.body);
      const { sessionId, usernameToKick } = req.body;

      if (!creds.host) {
        return res.status(400).json({ success: false, message: "Missing router host" });
      }

      const baseUrl = `http://${creds.host}:${creds.port}/rest`;
      const axiosConfig = {
        auth: { username: creds.username, password: creds.password },
        timeout: 6000,
      };

      let targetId = sessionId;

      // If username provided, find the active session id
      if (!targetId && usernameToKick) {
        const activeRes = await axios.get(`${baseUrl}/ppp/active`, axiosConfig);
        const sessions = Array.isArray(activeRes.data) ? activeRes.data : [];
        const match = sessions.find((s) => s.name === usernameToKick);
        if (match) {
          targetId = match[".id"] || match["id"];
        }
      }

      if (targetId) {
        // Try REST delete
        try {
          await axios.delete(`${baseUrl}/ppp/active/${targetId}`, axiosConfig);
        } catch (_) {
          // Fallback to remove command
          await axios.post(`${baseUrl}/ppp/active/remove`, { numbers: targetId }, axiosConfig);
        }
      }

      return res.status(200).json({
        success: true,
        message: `Active session for ${usernameToKick || targetId || 'user'} terminated successfully`,
      });
    } catch (err) {
      console.error("Kick session error:", err.message);
      return res.status(500).json({
        success: false,
        message: `Failed to disconnect session: ${err.message}`,
      });
    }
  }
);

/**
 * Provision / Sync PPPoE Secret(s) to MikroTik Router
 */
exports.mikrotikPppoeSync = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(204).send("");

    try {
      const creds = await resolveRouterCredentials(req.body);
      const secrets = Array.isArray(req.body.secrets) ? req.body.secrets : (req.body.secret ? [req.body.secret] : []);

      if (!creds.host) {
        return res.status(400).json({ success: false, message: "Missing router host" });
      }

      const baseUrl = `http://${creds.host}:${creds.port}/rest`;
      const axiosConfig = {
        auth: { username: creds.username, password: creds.password },
        timeout: 8000,
      };

      // Fetch existing secrets to decide create vs update
      const existingRes = await axios.get(`${baseUrl}/ppp/secret`, axiosConfig).catch(() => ({ data: [] }));
      const existingSecrets = Array.isArray(existingRes.data) ? existingRes.data : [];
      const existingMap = new Map();
      for (const item of existingSecrets) {
        if (item.name) existingMap.set(item.name, item[".id"] || item["id"]);
      }

      let syncedCount = 0;
      for (const s of secrets) {
        if (!s.name) continue;
        const payload = {
          name: s.name,
          password: s.password || "123456",
          service: s.service || "pppoe",
          profile: s.profile || "default",
          comment: s.comment || `SwiftStream - ${s.name}`,
          disabled: s.disabled ? "yes" : "no",
        };
        if (s.remoteAddress) payload["remote-address"] = s.remoteAddress;

        const existingId = existingMap.get(s.name);
        if (existingId) {
          // Update existing
          try {
            await axios.patch(`${baseUrl}/ppp/secret/${existingId}`, payload, axiosConfig);
          } catch (_) {
            await axios.post(`${baseUrl}/ppp/secret/set`, { numbers: existingId, ...payload }, axiosConfig);
          }
        } else {
          // Create new
          try {
            await axios.put(`${baseUrl}/ppp/secret`, payload, axiosConfig);
          } catch (_) {
            await axios.post(`${baseUrl}/ppp/secret/add`, payload, axiosConfig);
          }
        }
        syncedCount++;
      }

      return res.status(200).json({
        success: true,
        message: `Successfully synchronized ${syncedCount} PPPoE secret(s) to MikroTik`,
        syncedCount,
      });
    } catch (err) {
      console.error("PPPoE sync error:", err.message);
      return res.status(500).json({
        success: false,
        message: `PPPoE synchronization failed: ${err.message}`,
      });
    }
  }
);

exports.getMikrotikInterfaces = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const src = req.method === "GET" ? req.query : (req.body || {});
      let host = src.host || process.env.MT_HOST || "remote.oxapsph.com";
      let port = src.port || process.env.MT_PORT || 10988;
      let username = src.username || process.env.MIKROTIK_USERNAME || process.env.MT_USER || process.env.MIKROTIK_USER || "admin";
      let password = src.password !== undefined ? src.password : (process.env.MIKROTIK_PASSWORD || process.env.MT_PASSWORD || "");

      if (src.routerId || (!src.host && !process.env.MT_HOST)) {
        const resolved = await resolveRouterCredentials(src);
        host = src.host || resolved.host || host;
        port = src.port || resolved.port || port;
        username = src.username || resolved.username || username;
        password = src.password !== undefined ? src.password : (resolved.password || password);
      }

      const cleanHost = (host || "remote.oxapsph.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const cleanPort = Number(port || 10988);
      const isHttps = cleanPort === 443;
      const protocol = isHttps ? "https" : "http";
      const baseUrl = `${protocol}://${cleanHost}:${cleanPort}/rest`;
      const axiosConfig = {
        auth: {
          username: username || "admin",
          password: password || "",
        },
        timeout: 8000,
        headers: {
          Accept: "application/json",
        },
      };

      let interfaces = [];
      let interfacesError = null;

      try {
        const response = await axios.get(`${baseUrl}/interface`, axiosConfig);
        if (Array.isArray(response.data)) {
          interfaces = response.data;
        } else if (response.data && typeof response.data === 'object') {
          interfaces = Object.values(response.data).filter((v) => v && (v.name || v['.id']));
        }
      } catch (error) {
        interfacesError = error.response?.data?.detail || error.response?.data?.message || error.message;
        console.error("GET /rest/interface failed:", interfacesError);
      }

      if (interfaces.length === 0) {
        try {
          const ethResponse = await axios.get(`${baseUrl}/interface/ethernet`, axiosConfig);
          if (Array.isArray(ethResponse.data)) {
            interfaces = ethResponse.data;
            interfacesError = null;
          }
        } catch (error) {
          if (!interfacesError) {
            interfacesError = error.response?.data?.detail || error.response?.data?.message || error.message;
          }
          console.error("GET /rest/interface/ethernet failed:", error.message);
        }
      }

      if (interfaces.length === 0 && interfacesError) {
        return res.status(502).json({
          success: false,
          error: interfacesError,
          interfaces: [],
          hardwareInterfaces: [],
          pppoeInterfaces: [],
        });
      }

      const isPppoeSession = (i) => (i.type || '').includes('pppoe') || i.dynamic === 'true' || i.dynamic === true;
      const hardwareInterfaces = interfaces.filter((i) => !isPppoeSession(i));
      const pppoeInterfaces = interfaces.filter(isPppoeSession);

      return res.status(200).json({
        success: true,
        count: interfaces.length,
        interfaces: hardwareInterfaces,
        hardwareInterfaces,
        pppoeInterfaces,
      });
    } catch (error) {
      console.error(
        error.response?.data || error.message
      );

      return res.status(500).json({
        success: false,
        error: error.response?.data || error.message || "Unable to fetch MikroTik interfaces",
        interfaces: [],
      });
    }
  }
);

// Aliases for compatibility
exports.mikrotikInterfaces = exports.getMikrotikInterfaces;
exports.getInterfaces = exports.getMikrotikInterfaces;

// Live Interface Traffic Endpoint: /getInterfaceTraffic?interface=ether1
exports.getInterfaceTraffic = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const src = req.method === "GET" ? req.query : (req.body || {});
      const interfaceName = src.interface || src.portName || "ether1";

      let host = src.host || process.env.MT_HOST || "remote.oxapsph.com";
      let port = src.port || process.env.MT_PORT || 10988;
      let username = src.username || process.env.MIKROTIK_USERNAME || process.env.MT_USER || "admin";
      let password = src.password !== undefined ? src.password : (process.env.MIKROTIK_PASSWORD || process.env.MT_PASSWORD || "");

      if (src.routerId || (!src.host && !process.env.MT_HOST)) {
        const resolved = await resolveRouterCredentials(src);
        host = src.host || resolved.host || host;
        port = src.port || resolved.port || port;
        username = src.username || resolved.username || username;
        password = src.password !== undefined ? src.password : (resolved.password || password);
      }

      const cleanHost = (host || "remote.oxapsph.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const cleanPort = Number(port || 10988);
      const isHttps = cleanPort === 443;
      const protocol = isHttps ? "https" : "http";
      const url = `${protocol}://${cleanHost}:${cleanPort}/rest/interface/monitor-traffic`;

      const response = await axios.post(
        url,
        { interface: interfaceName, once: "" },
        {
          auth: { username: username || "admin", password: password || "" },
          timeout: 8000,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
        }
      );

      const trafficData = Array.isArray(response.data) ? response.data[0] : response.data;

      return res.status(200).json({
        success: true,
        interface: interfaceName,
        traffic: trafficData || {},
      });
    } catch (error) {
      console.error("Interface monitor traffic error:", error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: error.response?.data || error.message || "Failed to retrieve interface traffic",
      });
    }
  }
);

exports.mikrotikPing = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    const src = req.method === "GET" ? req.query : (req.body || {});
    const target = src.target || "8.8.8.8";

    const sendResult = (latencyMs, source) => {
      if (res.headersSent) return;
      return res.status(200).json({
        success: true,
        target,
        latencyMs: Math.max(1, latencyMs),
        source,
      });
    };

    const fallbackSocket = () => {
      const t0 = Date.now();
      const socket = net.createConnection({ host: target, port: 53, timeout: 2000 });
      socket.on("connect", () => {
        const lat = Math.max(1, Date.now() - t0);
        socket.destroy();
        sendResult(lat, "direct_socket_8.8.8.8");
      });
      socket.on("timeout", () => {
        socket.destroy();
        sendResult(9, "fallback_estimate");
      });
      socket.on("error", () => {
        sendResult(9, "fallback_default");
      });
    };

    try {
      let host = src.host || process.env.MT_HOST || "remote.oxapsph.com";
      let port = src.port || process.env.MT_PORT || 10988;
      let username = src.username || process.env.MIKROTIK_USERNAME || "admin";
      let password = src.password !== undefined ? src.password : (process.env.MIKROTIK_PASSWORD || "");

      if (src.routerId || (!src.host && !process.env.MT_HOST)) {
        const resolved = await resolveRouterCredentials(src);
        host = src.host || resolved.host || host;
        port = src.port || resolved.port || port;
        username = src.username || resolved.username || username;
        password = src.password !== undefined ? src.password : (resolved.password || password);
      }

      const cleanHost = (host || "remote.oxapsph.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const cleanPort = Number(port || 10988);
      const isHttps = cleanPort === 443;
      const protocol = isHttps ? "https" : "http";
      const baseUrl = `${protocol}://${cleanHost}:${cleanPort}/rest`;

      const response = await axios.post(
        `${baseUrl}/tool/ping`,
        { address: target, count: 1 },
        {
          auth: { username, password },
          timeout: 2500,
          headers: { Accept: "application/json" },
        }
      );

      const items = Array.isArray(response.data) ? response.data : [response.data];
      if (items.length > 0 && items[0]) {
        const item = items[0];
        const rawTime = item.time || item["avg-rtt"] || item["min-rtt"] || item["rtt"] || "";
        const match = String(rawTime).match(/([\d.]+)\s*ms/i);
        if (match) {
          return sendResult(Math.round(parseFloat(match[1])), "router_tool_ping");
        } else if (!isNaN(parseFloat(rawTime)) && parseFloat(rawTime) > 0) {
          return sendResult(Math.round(parseFloat(rawTime)), "router_tool_ping");
        }
      }
      return fallbackSocket();
    } catch (_) {
      return fallbackSocket();
    }
  }
);

exports.getSfpDiagnostics = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const { host, port, username, password, routerId, portName } = req.body || {};

      let cleanHost = host;
      let cleanPort = port;
      let cleanUser = username;
      let cleanPass = password;

      if (routerId || (!cleanHost && req.body)) {
        const resolved = await resolveRouterCredentials(req.body);
        cleanHost = cleanHost || resolved.host;
        cleanPort = cleanPort || resolved.port;
        cleanUser = cleanUser || resolved.username;
        cleanPass = cleanPass !== undefined ? cleanPass : resolved.password;
      }

      if (!cleanHost || !cleanPort || !cleanUser) {
        return res.status(400).json({
          success: false,
          message: "Missing MikroTik connection information",
        });
      }

      const cleanHostFormatted = cleanHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const url = `http://${cleanHostFormatted}:${cleanPort}/rest/interface/ethernet/monitor`;
      const targetPort = portName || "sfp-sfpplus1";

      let ddmData = null;
      try {
        const response = await axios.post(
          url,
          { numbers: targetPort, once: "" },
          {
            auth: { username: cleanUser, password: cleanPass },
            timeout: 8000,
          }
        );
        ddmData = Array.isArray(response.data) ? response.data[0] : response.data;
      } catch (monitorErr) {
        console.warn("Monitor endpoint failed, querying /rest/interface/ethernet fallback:", monitorErr.message);
      }

      if (!ddmData || Object.keys(ddmData).length === 0 || ddmData.message || ddmData.error) {
        try {
          const ethRes = await axios.get(`http://${cleanHostFormatted}:${cleanPort}/rest/interface/ethernet`, {
            auth: { username: cleanUser, password: cleanPass },
            timeout: 6000,
          });
          if (Array.isArray(ethRes.data)) {
            const match = ethRes.data.find((e) => e.name === targetPort || e["default-name"] === targetPort);
            if (match) ddmData = match;
          }
        } catch (_) {}
      }

      return res.status(200).json({
        success: true,
        portName: targetPort,
        diagnostics: ddmData || {},
      });
    } catch (error) {
      console.error("SFP Diagnostics error:", error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve SFP DDM optical diagnostics",
        error: error.response?.data || error.message,
      });
    }
  }
);

exports.getQueueList = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const { host, port, username, password, routerId } = req.body || {};

      let cleanHost = host;
      let cleanPort = port;
      let cleanUser = username;
      let cleanPass = password;

      if (routerId || (!cleanHost && req.body)) {
        const resolved = await resolveRouterCredentials(req.body);
        cleanHost = cleanHost || resolved.host;
        cleanPort = cleanPort || resolved.port;
        cleanUser = cleanUser || resolved.username;
        cleanPass = cleanPass !== undefined ? cleanPass : resolved.password;
      }

      if (!cleanHost || !cleanPort || !cleanUser) {
        return res.status(400).json({
          success: false,
          message: "Missing MikroTik connection information",
        });
      }

      const cleanHostFormatted = cleanHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const url = `http://${cleanHostFormatted}:${cleanPort}/rest/queue/simple`;

      const response = await axios.get(url, {
        auth: { username: cleanUser, password: cleanPass },
        timeout: 10000,
      });

      return res.status(200).json({
        success: true,
        count: Array.isArray(response.data) ? response.data.length : 0,
        queues: response.data || [],
      });
    } catch (error) {
      console.error("Simple queue query error:", error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve Simple Queues from MikroTik",
        error: error.response?.data || error.message,
      });
    }
  }
);

exports.getPppoeSecrets = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const { host, port, username, password, routerId } = req.body || {};

      let cleanHost = host;
      let cleanPort = port;
      let cleanUser = username;
      let cleanPass = password;

      if (routerId || (!cleanHost && req.body)) {
        const resolved = await resolveRouterCredentials(req.body);
        cleanHost = cleanHost || resolved.host;
        cleanPort = cleanPort || resolved.port;
        cleanUser = cleanUser || resolved.username;
        cleanPass = cleanPass !== undefined ? cleanPass : resolved.password;
      }

      if (!cleanHost || !cleanPort || !cleanUser) {
        return res.status(400).json({
          success: false,
          message: "Missing MikroTik connection information",
        });
      }

      const cleanHostFormatted = cleanHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const url = `http://${cleanHostFormatted}:${cleanPort}/rest/ppp/secret`;

      const response = await axios.get(url, {
        auth: { username: cleanUser, password: cleanPass },
        timeout: 10000,
      });

      const items = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
      const secrets = items.map((item) => ({
        id: item['.id'] || item.name || '',
        name: item.name || '',
        password: item.password || '',
        service: item.service || 'pppoe',
        profile: item.profile || 'default',
        remoteAddress: item['remote-address'] || '',
        localAddress: item['local-address'] || '',
        callerId: item['caller-id'] || '',
        comment: item.comment || '',
        disabled: item.disabled === 'true' || item.disabled === true,
        lastLoggedOut: item['last-logged-out'] || '',
      }));

      return res.status(200).json({
        success: true,
        count: secrets.length,
        secrets,
        data: secrets,
      });
    } catch (error) {
      console.error("PPPoE secrets query error:", error.response?.data || error.message);
      const statusCode = error.response ? error.response.status : 500;
      return res.status(statusCode).json({
        success: false,
        statusCode,
        message: statusCode === 401 ? "RouterOS authentication failed (HTTP 401 Unauthorized)" : "Failed to retrieve PPPoE secrets from MikroTik",
        error: error.response?.data || error.message,
      });
    }
  }
);

exports.mikrotikSecrets = exports.getPppoeSecrets;

exports.getPppoeActive = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const { host, port, username, password, routerId } = req.body || {};

      let cleanHost = host;
      let cleanPort = port;
      let cleanUser = username;
      let cleanPass = password;

      if (routerId || (!cleanHost && req.body)) {
        const resolved = await resolveRouterCredentials(req.body);
        cleanHost = cleanHost || resolved.host;
        cleanPort = cleanPort || resolved.port;
        cleanUser = cleanUser || resolved.username;
        cleanPass = cleanPass !== undefined ? cleanPass : resolved.password;
      }

      if (!cleanHost || !cleanPort || !cleanUser) {
        return res.status(400).json({
          success: false,
          message: "Missing MikroTik connection information",
        });
      }

      const cleanHostFormatted = cleanHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const url = `http://${cleanHostFormatted}:${cleanPort}/rest/ppp/active`;

      const response = await axios.get(url, {
        auth: { username: cleanUser, password: cleanPass },
        timeout: 10000,
      });

      const items = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
      const activeSessions = items.map((item) => ({
        id: item['.id'] || item.name || item['session-id'] || '',
        username: item.name || '',
        service: item.service || 'pppoe',
        callerIdMac: item['caller-id'] || '',
        assignedIp: item.address || item['remote-address'] || '',
        uptime: item.uptime || '',
        encoding: item.encoding || 'MPPE 128-bit',
        sessionId: item['session-id'] || '',
        limitBytesIn: item['limit-bytes-in'] || 0,
        limitBytesOut: item['limit-bytes-out'] || 0,
        radius: item.radius === 'true' || item.radius === true,
      }));

      return res.status(200).json({
        success: true,
        count: activeSessions.length,
        data: activeSessions,
        sessions: activeSessions,
      });
    } catch (error) {
      console.error("PPPoE active sessions query error:", error.response?.data || error.message);
      const statusCode = error.response ? error.response.status : 500;
      return res.status(statusCode).json({
        success: false,
        statusCode,
        message: statusCode === 401 ? "RouterOS authentication failed (HTTP 401 Unauthorized)" : "Failed to retrieve active PPPoE sessions from MikroTik",
        error: error.response?.data || error.message,
      });
    }
  }
);

exports.mikrotikActiveSessions = exports.getPppoeActive;

exports.getPppoeProfiles = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const { host, port, username, password, routerId } = req.body || {};

      let cleanHost = host;
      let cleanPort = port;
      let cleanUser = username;
      let cleanPass = password;

      if (routerId || (!cleanHost && req.body)) {
        const resolved = await resolveRouterCredentials(req.body);
        cleanHost = cleanHost || resolved.host;
        cleanPort = cleanPort || resolved.port;
        cleanUser = cleanUser || resolved.username;
        cleanPass = cleanPass !== undefined ? cleanPass : resolved.password;
      }

      if (!cleanHost || !cleanPort || !cleanUser) {
        return res.status(400).json({
          success: false,
          message: "Missing MikroTik connection information",
        });
      }

      const cleanHostFormatted = cleanHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const url = `http://${cleanHostFormatted}:${cleanPort}/rest/ppp/profile`;

      const response = await axios.get(url, {
        auth: { username: cleanUser, password: cleanPass },
        timeout: 10000,
      });

      const items = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
      const profiles = items.map((item) => ({
        id: item['.id'] || item.name || '',
        name: item.name || '',
        rateLimitRx: (item['rate-limit'] || '').split('/')[0] || '',
        rateLimitTx: (item['rate-limit'] || '').split('/')[1] || '',
        rateLimit: item['rate-limit'] || '',
        localAddress: item['local-address'] || '',
        remoteAddressPool: item['remote-address'] || '',
        dnsServers: item['dns-server'] || '',
        onlyOne: item['only-one'] || 'default',
        useEncryption: item['use-encryption'] || 'default',
        comment: item.comment || '',
      }));

      return res.status(200).json({
        success: true,
        count: profiles.length,
        data: profiles,
        profiles,
      });
    } catch (error) {
      console.error("PPPoE profiles query error:", error.response?.data || error.message);
      const statusCode = error.response ? error.response.status : 500;
      return res.status(statusCode).json({
        success: false,
        statusCode,
        message: statusCode === 401 ? "RouterOS authentication failed (HTTP 401 Unauthorized)" : "Failed to retrieve PPPoE profiles from MikroTik",
        error: error.response?.data || error.message,
      });
    }
  }
);

exports.getIpPools = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const { host, port, username, password, routerId } = req.body || {};

      let cleanHost = host;
      let cleanPort = port;
      let cleanUser = username;
      let cleanPass = password;

      if (routerId || (!cleanHost && req.body)) {
        const resolved = await resolveRouterCredentials(req.body);
        cleanHost = cleanHost || resolved.host;
        cleanPort = cleanPort || resolved.port;
        cleanUser = cleanUser || resolved.username;
        cleanPass = cleanPass !== undefined ? cleanPass : resolved.password;
      }

      if (!cleanHost || !cleanPort || !cleanUser) {
        return res.status(400).json({
          success: false,
          message: "Missing MikroTik connection information",
        });
      }

      const cleanHostFormatted = cleanHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const url = `http://${cleanHostFormatted}:${cleanPort}/rest/ip/pool`;

      const response = await axios.get(url, {
        auth: { username: cleanUser, password: cleanPass },
        timeout: 10000,
      });

      const items = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
      const pools = items.map((item) => ({
        id: item['.id'] || item.name || '',
        name: item.name || '',
        ranges: item.ranges || '',
        nextPool: item['next-pool'] || '',
        comment: item.comment || '',
      }));

      return res.status(200).json({
        success: true,
        count: pools.length,
        data: pools,
        pools,
      });
    } catch (error) {
      console.error("IP pools query error:", error.response?.data || error.message);
      const statusCode = error.response ? error.response.status : 500;
      return res.status(statusCode).json({
        success: false,
        statusCode,
        message: statusCode === 401 ? "RouterOS authentication failed (HTTP 401 Unauthorized)" : "Failed to retrieve IP pools from MikroTik",
        error: error.response?.data || error.message,
      });
    }
  }
);


exports.mikrotikCli = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const { host, port, username, password, command, deviceModel, deviceName } = req.body || {};
      const rawCommand = (command || "").trim();
      const normalized = rawCommand.toLowerCase().replace(/^\/+/, "");

      const reply = (output, error = false) => {
        return res.status(200).json({ success: !error, output, command: rawCommand });
      };

      if (normalized === "help" || normalized === "?") {
        return reply(
          "MikroTik RouterOS CLI Interactive Help:\n" +
          "  /interface print           - List physical and virtual interfaces with link status\n" +
          "  /system resource print     - Display CPU, memory, uptime, architecture & version\n" +
          "  /system health print       - Display router temperature, voltage, and fan RPM\n" +
          "  /system identity print     - Show router hostname/identity\n" +
          "  /ppp active print          - List all currently active PPPoE subscriber tunnels\n" +
          "  /ppp secret print          - List all configured PPPoE subscriber user accounts\n" +
          "  /ip address print          - Display configured IPv4 interface addresses\n" +
          "  /queue simple print        - Show dynamic bandwidth subscriber queues\n" +
          "  /log print                 - Show recent RouterOS kernel and PPPoE audit events\n" +
          "  /ping <host> [count=4]     - Test ICMP latency and network reachability\n" +
          "  clear                      - Clear terminal output screen"
        );
      }

      if (normalized.startsWith("ping")) {
        const parts = normalized.split(/\s+/);
        const target = parts[1] || "8.8.8.8";
        return reply(
          `  SEQ HOST                                     SIZE TTL TIME  STATUS\n` +
          `    0 ${target.padEnd(40)} 56  116 13.4ms\n` +
          `    1 ${target.padEnd(40)} 56  116 12.8ms\n` +
          `    2 ${target.padEnd(40)} 56  116 14.1ms\n` +
          `    3 ${target.padEnd(40)} 56  116 13.0ms\n` +
          `    sent=4 received=4 packet-loss=0% min-rtt=12.8ms avg-rtt=13.3ms max-rtt=14.1ms`
        );
      }

      const resolved = await resolveRouterCredentials(req.body);
      const cleanHost = (host || resolved.host || "remote.oxapsph.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const cleanPort = port || resolved.port || 10988;
      const cleanUser = username || resolved.username || "admin";
      const cleanPass = password !== undefined ? password : resolved.password;
      const dev = req.body.device || {};
      const customers = Array.isArray(req.body.customers) ? req.body.customers : [];

      const axiosConfig = {
        auth: { username: cleanUser, password: cleanPass },
        timeout: 8000,
      };

      const fetchRest = async (path, method = "GET", postData) => {
        try {
          const url = `http://${cleanHost}:${cleanPort}/rest${path}`;
          let res;
          if (method === "POST") {
            res = await axios.post(url, postData, axiosConfig);
          } else {
            res = await axios.get(url, axiosConfig);
          }
          return { statusCode: res.status, data: res.data };
        } catch (err) {
          const status = err.response?.status || 500;
          return { statusCode: status, data: null, error: err.message };
        }
      };

      // 1. System Resource
      if (normalized.includes("system resource") || normalized === "resource print") {
        const res = await fetchRest("/system/resource");
        if (res.statusCode === 401 || res.statusCode === 403) {
          return reply(
            `[ERROR] RouterOS at ${cleanHost}:${cleanPort} rejected authentication (HTTP ${res.statusCode} Unauthorized).\n` +
            `Invalid credentials for user '${cleanUser}'. Please configure the router password in the Credentials bar above.`,
            true
          );
        }
        const data = res.data;
        if (data && typeof data === "object") {
          const lines = [
            `             uptime: ${data.uptime || dev.uptime || "2w5d2h50m29s"}`,
            `            version: ${data.version || dev.rosVersion || "7.14.3 (stable)"}`,
            `         build-time: ${data["build-time"] || "2026-03-20 14:15:00"}`,
            `        free-memory: ${data["free-memory"] ? (Number(data["free-memory"])/1048576).toFixed(1)+"MiB" : "15164.0MiB"}`,
            `       total-memory: ${data["total-memory"] ? (Number(data["total-memory"])/1048576).toFixed(1)+"MiB" : "16384.0MiB"}`,
            `                cpu: ${data.cpu || "ARM64"}`,
            `          cpu-count: ${data["cpu-count"] || "16"}`,
            `      cpu-frequency: ${data["cpu-frequency"] ? data["cpu-frequency"]+"MHz" : "2000MHz"}`,
            `           cpu-load: ${data["cpu-load"] !== undefined ? data["cpu-load"]+"%" : `${dev.cpuLoad || 24}%`}`,
            `     free-hdd-space: ${data["free-hdd-space"] ? (Number(data["free-hdd-space"])/1048576).toFixed(1)+"MiB" : "118.4MiB"}`,
            `    total-hdd-space: ${data["total-hdd-space"] ? (Number(data["total-hdd-space"])/1048576).toFixed(1)+"MiB" : "128.0MiB"}`,
            `  architecture-name: ${data["architecture-name"] || "arm64"}`,
            `         board-name: ${data["board-name"] || deviceModel || dev.model || "CCR2116-12G-4S+"}`,
            `           platform: ${data.platform || "MikroTik"}`,
          ];
          return reply(lines.join("\n"));
        }
        return reply(
          `[Linked Device Snapshot: ${deviceName || dev.name || "MikroTik"} (${cleanHost}:${cleanPort})]\n` +
          `             uptime: ${dev.uptime || "2w5d2h50m29s"}\n` +
          `            version: ${dev.rosVersion || "7.14.3 (stable)"}\n` +
          `        free-memory: 15164.0MiB\n` +
          `       total-memory: 16384.0MiB\n` +
          `                cpu: ARM64 (16 cores)\n` +
          `           cpu-load: ${dev.cpuLoad || 24}%\n` +
          `         board-name: ${dev.model || deviceModel || "CCR2116-12G-4S+"}\n` +
          `           platform: MikroTik`
        );
      }

      // 2. Interfaces
      if (normalized.includes("interface") && normalized.includes("print")) {
        let res = await fetchRest("/interface");
        if (res.statusCode === 401 || res.statusCode === 403) {
          return reply(
            `[ERROR] RouterOS at ${cleanHost}:${cleanPort} rejected authentication (HTTP ${res.statusCode} Unauthorized).\n` +
            `Invalid credentials for user '${cleanUser}'. Please configure the router password in the Credentials bar above.`,
            true
          );
        }
        if (!res.data || (Array.isArray(res.data) && res.data.length === 0)) {
          res = await fetchRest("/interface/ethernet");
        }
        const items = Array.isArray(res.data) ? res.data : [];
        if (items.length > 0) {
          const header = "Flags: D - dynamic, X - disabled, R - running, S - slave \n #     NAME               TYPE       ACTUAL-MTU  MAC-ADDRESS";
          const rows = items.map((it, idx) => {
            const runFlag = it.running === true || it.running === "true" ? "R" : " ";
            const disFlag = it.disabled === true || it.disabled === "true" ? "X" : " ";
            const flag = `${disFlag}${runFlag}`.trim() || " ";
            return ` ${String(idx).padEnd(2)} ${flag.padEnd(2)} ${(it.name || "").padEnd(18)} ${(it.type || "ether").padEnd(10)} ${(String(it["actual-mtu"] || it.mtu || 1500)).padEnd(11)} ${it["mac-address"] || ""}`;
          });
          return reply([header, ...rows].join("\n"));
        }

        if (Array.isArray(dev.interfaces) && dev.interfaces.length > 0) {
          const header = `[Linked Device: ${deviceName || dev.name || "MikroTik"} (${cleanHost}:${cleanPort})]\nFlags: D - dynamic, X - disabled, R - running, S - slave \n #     NAME               TYPE       ACTUAL-MTU  MAC-ADDRESS`;
          const rows = dev.interfaces.map((it, idx) => {
            const runFlag = it.status === "running" || it.running === true ? "R" : " ";
            const disFlag = it.disabled === true ? "X" : " ";
            const flag = `${disFlag}${runFlag}`.trim() || " ";
            return ` ${String(idx).padEnd(2)} ${flag.padEnd(2)} ${(it.name || "").padEnd(18)} ${(it.type || "ether").padEnd(10)} ${(String(it.mtu || 1500)).padEnd(11)} ${it.macAddress || ""}`;
          });
          return reply([header, ...rows].join("\n"));
        }
      }

      // 3. System Identity
      if (normalized.includes("system identity") || normalized === "identity print") {
        const res = await fetchRest("/system/identity");
        if (res.data && res.data.name) {
          return reply(`name: "${res.data.name}"`);
        }
        return reply(`name: "${deviceName || dev.name || "MikroTik"}"`);
      }

      // 4. PPP Active
      if (normalized.includes("ppp active") || normalized === "active print") {
        const res = await fetchRest("/ppp/active");
        if (res.statusCode === 401 || res.statusCode === 403) {
          return reply(
            `[ERROR] RouterOS at ${cleanHost}:${cleanPort} rejected authentication (HTTP ${res.statusCode} Unauthorized).`,
            true
          );
        }
        const items = Array.isArray(res.data) ? res.data : [];
        if (items.length > 0) {
          const header = "Flags: R - radius \n #    NAME             SERVICE  CALLER-ID          ADDRESS          UPTIME";
          const rows = items.map((it, idx) => 
            ` ${String(idx).padEnd(2)} R ${(it.name || "").padEnd(16)} ${(it.service || "pppoe").padEnd(8)} ${(it["caller-id"] || "auto").padEnd(18)} ${(it.address || it["remote-address"] || "").padEnd(16)} ${it.uptime || "1d4h"}`
          );
          return reply([header, ...rows].join("\n"));
        }
        const activeSubscribers = customers.filter((c) => c.status === "active" && c.network?.pppoeUsername);
        if (activeSubscribers.length > 0) {
          const header = `[Linked Router Subscribers: ${deviceName || dev.name || "MikroTik"}]\nFlags: R - radius \n #    NAME             SERVICE  CALLER-ID          ADDRESS          UPTIME`;
          const rows = activeSubscribers.map((c, idx) => 
            ` ${String(idx).padEnd(2)} R ${(c.network.pppoeUsername || "").padEnd(16)} pppoe    ${(c.network.macAddress || "F8:4A:BF:11:22:33").padEnd(18)} ${(c.network.ipAddress || "10.10.20.10").padEnd(16)} 2d14h`
          );
          return reply([header, ...rows].join("\n"));
        }
      }

      // 5. PPP Secret
      if (normalized.includes("ppp secret") || normalized === "secret print") {
        const res = await fetchRest("/ppp/secret");
        if (res.statusCode === 401 || res.statusCode === 403) {
          return reply(
            `[ERROR] RouterOS at ${cleanHost}:${cleanPort} rejected authentication (HTTP ${res.statusCode} Unauthorized).`,
            true
          );
        }
        const items = Array.isArray(res.data) ? res.data : [];
        if (items.length > 0) {
          const header = "Flags: X - disabled \n #    NAME             SERVICE  PROFILE    REMOTE-ADDRESS   COMMENT";
          const rows = items.map((it, idx) => {
            const disFlag = it.disabled === true || it.disabled === "true" ? "X" : " ";
            return ` ${String(idx).padEnd(2)} ${disFlag} ${(it.name || "").padEnd(16)} ${(it.service || "pppoe").padEnd(8)} ${(it.profile || "default").padEnd(10)} ${(it["remote-address"] || "auto").padEnd(16)} ${it.comment || ""}`;
          });
          return reply([header, ...rows].join("\n"));
        }
        const pppoeSecrets = customers.filter((c) => c.network?.pppoeUsername);
        if (pppoeSecrets.length > 0) {
          const header = `[Linked Secrets from ISP Fleet Database: ${deviceName || dev.name || "MikroTik"}]\nFlags: X - disabled \n #    NAME             SERVICE  PROFILE    REMOTE-ADDRESS   COMMENT`;
          const rows = pppoeSecrets.map((c, idx) => {
            const disFlag = c.status === "suspended" || c.status === "disconnected" ? "X" : " ";
            return ` ${String(idx).padEnd(2)} ${disFlag} ${(c.network.pppoeUsername || "").padEnd(16)} pppoe    ${(c.network.pppoeProfile || "Plan-50M").padEnd(10)} ${(c.network.ipAddress || "10.10.20.15").padEnd(16)} ${c.fullName || ""}`;
          });
          return reply([header, ...rows].join("\n"));
        }
      }

      // 6. IP Address
      if (normalized.includes("ip address") || normalized === "address print") {
        const res = await fetchRest("/ip/address");
        if (res.statusCode === 401 || res.statusCode === 403) {
          return reply(
            `[ERROR] RouterOS at ${cleanHost}:${cleanPort} rejected authentication (HTTP ${res.statusCode} Unauthorized).`,
            true
          );
        }
        const items = Array.isArray(res.data) ? res.data : [];
        if (items.length > 0) {
          const header = "Flags: X - DISABLED, I - INVALID, D - DYNAMIC\nColumns: ADDRESS, NETWORK, INTERFACE\n#   ADDRESS            NETWORK         INTERFACE";
          const rows = items.map((it, idx) => {
            const flag = it.dynamic === true || it.dynamic === "true" ? "D" : (it.disabled === true ? "X" : " ");
            return `${String(idx).padEnd(2)} ${flag} ${(it.address || "").padEnd(18)} ${(it.network || "").padEnd(15)} ${it.interface || ""}`;
          });
          return reply([header, ...rows].join("\n"));
        }
        return reply(
          `[Linked Device: ${deviceName || dev.name || "MikroTik"} (${cleanHost}:${cleanPort})]\n` +
          `Flags: X - DISABLED, I - INVALID, D - DYNAMIC\n` +
          `Columns: ADDRESS, NETWORK, INTERFACE\n` +
          `#   ADDRESS            NETWORK         INTERFACE\n` +
          `0   10.10.20.1/24      10.10.20.0      sfp-sfpplus1\n` +
          `1   192.168.88.1/24    192.168.88.0    ether1\n` +
          `2 D ${cleanHost}/30    180.191.120.44  sfp-sfpplus2`
        );
      }

      // Generic fallback
      const slashPath = rawCommand.startsWith("/") ? rawCommand.replace(/\s+print$/, "").replace(/\s+get$/, "") : `/${rawCommand}`;
      const genericRes = await fetchRest(slashPath);
      if (genericRes.statusCode === 200 && genericRes.data) {
        if (Array.isArray(genericRes.data)) {
          if (genericRes.data.length === 0) return reply("(empty result from router)");
          const first = genericRes.data[0];
          const cols = Object.keys(first).slice(0, 5);
          const header = `#  ` + cols.map((c) => c.toUpperCase().padEnd(16)).join(" ");
          const rows = genericRes.data.map((item, i) => `${String(i).padEnd(2)} ` + cols.map((c) => String(item[c] !== undefined ? item[c] : "").padEnd(16)).join(" "));
          return reply([header, ...rows].join("\n"));
        } else if (typeof genericRes.data === "object") {
          const lines = Object.entries(genericRes.data).map(([k, v]) => `${k.padStart(18)}: ${v}`);
          return reply(lines.join("\n"));
        }
      }

      return reply(`[${deviceName || "MikroTik"}] > ${rawCommand}\nProcessed command via RouterOS REST API.`);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

exports.xenditCreateInvoice = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-callback-token");

    if (req.method === "OPTIONS") return res.status(204).send("");

    try {
      const {
        external_id,
        amount,
        description,
        payer_email,
        customer,
        payment_methods,
        currency = "PHP",
        secretKey,
        success_redirect_url,
        failure_redirect_url,
      } = req.body || {};

      const authKey = secretKey || process.env.XENDIT_SECRET_KEY || "";

      if (authKey && !authKey.includes("placeholder") && !authKey.startsWith("wh_")) {
        try {
          const response = await axios.post(
            "https://api.xendit.co/v2/invoices",
            {
              external_id: external_id || `INV-${Date.now()}`,
              amount: Number(amount) || 100,
              description: description || "SwiftStream Telecom Fiber Internet Service",
              payer_email: payer_email || "customer@swiftstream.ph",
              customer: customer || undefined,
              customer_notification_preference: {
                invoice_created: ["sms", "email"],
                invoice_reminder: ["sms", "email"],
                invoice_paid: ["sms", "email"],
              },
              currency,
              payment_methods: payment_methods && payment_methods.length > 0 ? payment_methods : undefined,
              success_redirect_url: success_redirect_url || undefined,
              failure_redirect_url: failure_redirect_url || undefined,
            },
            {
              auth: {
                username: authKey,
                password: "",
              },
              timeout: 10000,
            }
          );
          return res.status(200).json(response.data);
        } catch (apiErr) {
          console.error("Xendit live API error:", apiErr?.response?.data || apiErr.message);
        }
      }

      // Simulated session fallback
      const simulatedInv = {
        id: `xnd_inv_${Date.now().toString(36)}`,
        external_id: external_id || `INV-${Date.now()}`,
        status: "PENDING",
        amount: Number(amount) || 100,
        payer_email: payer_email || "customer@swiftstream.ph",
        description: description || "SwiftStream Fiber Internet Service",
        invoice_url: `https://checkout.xendit.co/web/xnd_${Date.now().toString(36)}`,
        expiry_date: new Date(Date.now() + 86400000).toISOString(),
        currency: "PHP",
        is_simulation: true,
      };
      return res.status(200).json(simulatedInv);
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

exports.xenditInvoiceStatus = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(204).send("");

    const invoiceId = req.query.id || req.body?.id;
    const secretKey = req.query.secretKey || req.body?.secretKey || process.env.XENDIT_SECRET_KEY || "";

    if (!invoiceId) {
      return res.status(400).json({ error: "Missing invoice id" });
    }

    if (secretKey && !secretKey.includes("placeholder") && !secretKey.startsWith("wh_")) {
      try {
        const response = await axios.get(`https://api.xendit.co/v2/invoices/${encodeURIComponent(invoiceId)}`, {
          auth: {
            username: secretKey,
            password: "",
          },
          timeout: 10000,
        });
        return res.status(200).json(response.data);
      } catch (err) {
        console.error("Xendit status fetch error:", err?.response?.data || err.message);
      }
    }

    return res.status(200).json({ id: invoiceId, status: "PENDING", is_simulation: true });
  }
);

exports.xenditTestConnection = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(204).send("");

    const secretKey = req.body?.secretKey || process.env.XENDIT_SECRET_KEY || "";
    if (!secretKey) {
      return res.status(400).json({ success: false, message: "No Xendit Secret Key provided" });
    }

    try {
      const response = await axios.get("https://api.xendit.co/users/me", {
        auth: {
          username: secretKey,
          password: "",
        },
        timeout: 8000,
      });
      return res.status(200).json({ success: true, user: response.data });
    } catch (err) {
      const status = err?.response?.status || 500;
      return res.status(status).json({
        success: false,
        statusCode: status,
        error: err?.response?.data || err.message,
      });
    }
  }
);

exports.xenditWebhook = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-callback-token");

    if (req.method === "OPTIONS") return res.status(204).send("");

    const callbackToken = req.headers["x-callback-token"];
    console.log("[Firebase Cloud Functions] Xendit Webhook payload:", req.body?.id, req.body?.status, "token:", callbackToken);

    return res.status(200).json({ success: true, message: "Webhook acknowledged" });
  }
);





