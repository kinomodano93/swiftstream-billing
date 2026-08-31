const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");

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
          password: password || "",
        },
        timeout: 8000,
        headers: {
          Accept: "application/json",
      };

      let interfaces = [];
      try {
        if (Array.isArray(response.data)) {
          interfaces = response.data;
            interfaces = ethResponse.data;
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


