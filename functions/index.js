const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");

exports.mikrotikTest = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
  },
  async (req, res) => {
    // CORS headers for all origins
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const {
        host,
        port,
        username,
        password
      } = req.body || {};

      if (!host) {
        return res.status(400).json({
          success: false,
          message: "Missing host parameter in request body",
        });
      }

      const routerUrl = `http://${host}:${port || 80}/rest/system/resource`;

      const response = await axios.get(routerUrl, {
        auth: {
          username: username || "admin",
          password: password || "",
        },
        timeout: 10000,
      });

      return res.status(200).json({
        success: true,
        message: "MikroTik connected successfully",
        router: response.data,
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

