const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
// const fetch = require('node-fetch');
const fetch = (...args) => import("node-fetch").then(module => module.default(...args));
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { shuffle, log } = require('./functions');

// Read config from the config.json file
const configPath = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(configPath));

// Extract configuration values
const nodes = config.nodes;
const rateLimitConfig = config.rateLimit;

const app = express();

// Port inside the container
const PORT = 8080;

// app.set('trust proxy', true);

// Enable CORS for all origins
app.use(cors());

// Configure rate limiting
const limiter = rateLimit({
  windowMs: rateLimitConfig.windowMs, // Time window in milliseconds
  max: rateLimitConfig.maxRequests,   // Max requests per windowMs
  message: { error: "Too Many Requests", errorCode: 429 },
  headers: true,
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

// Parse JSON request bodies
app.use(express.json());

// Fetch version from the server
async function getVersion(server) {
  try {
    const response = await fetch(server, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 0,
        jsonrpc: "2.0",
        method: "call",
        params: ["login_api", "get_version", []]
      })
    });

    if (response.ok) {
      return { server, version: await response.json() };
    }
  } catch (error) {
    console.error(error);
  }

  return {
    server: "https://api.steemit.com",
    version: "",
  };
}

// Forward GET request to the chosen node
async function forwardRequestGET(apiURL) {
  const res = await fetch(apiURL, { method: 'GET' });
  const data = await res.text();
  return { statusCode: res.status, data };
}

// Forward POST request to the chosen node
async function forwardRequestPOST(apiURL, body) {
  const res = await fetch(apiURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  const data = await res.text();
  return { statusCode: res.status, data };
}

app.head('/', (req, res, next) => {
    req.method = 'GET';
    next();
});

// Handle incoming requests
app.all('/', async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'Unknown IP';
  const method = req.method.toUpperCase();
  const shuffledNodes = shuffle(nodes);

  // Pick the fastest available node
  const promises = shuffledNodes.slice(0, 6).map(node => getVersion(node));
  let chosenNode = await Promise.any(promises).catch(() => ({ server: "https://api.steemit.com" }));

  log(`Request: ${ip}, ${method}: Chosen Node: ${chosenNode.server}`);

  let result;
  if (method === 'GET') {
    result = await forwardRequestGET(chosenNode.server);
  } else if (method === 'POST') {
    const body = JSON.stringify(req.body);
    result = await forwardRequestPOST(chosenNode.server, body);
  } else {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  res.setHeader("IP", ip);
  res.setHeader("Server", chosenNode.server);
  if (typeof chosenNode.version !== "undefined") {
    res.setHeader("Version", JSON.stringify(chosenNode.version));
  }
  if (typeof config.version !== "undefined") {
    res.setHeader("ProxyVersion", config.version);
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (typeof config.max_age !== "undefined") {
    res.setHeader('Cache-Control', 'max-age=' + config.max_age);
  }
  let data = {};
  try {
    data = JSON.parse(result.data);
    if (method === 'GET') {
        data["status_code"] = 200;
    }
  } catch (ex) {
    data = { 
        "status_code": 500,
        "error": ex
    }
  }

  if (method === 'GET') {
    data["__server__"] = chosenNode.server;
    if (typeof chosenNode.version !== "undefined") {
      data["__version__"] = chosenNode.version;
    }
    data["__servers__"] = config.nodes;
    data["__ip__"] = ip;
  }
  res.status(result.statusCode).json(data);
});

// Determine if SSL certificates exist
const sslCertPath = config.sslCertPath;
const sslKeyPath = config.sslKeyPath;
log(`sslCertPath = ${sslCertPath}`);
log(`sslKeyPath = ${sslKeyPath}`);

if (fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath)) {
  // SSL certificates are available; create HTTPS server
  const options = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  };

  const server = https.createServer(options, app);

  server.listen(PORT, () => {
    console.log(`HTTPS server is running on https://localhost:${PORT}`);
  });

} else {
  // SSL certificates are not available; create HTTP server
  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`HTTP server is running on http://localhost:${PORT}`);
  });
}

// Graceful shutdown on Ctrl+C
process.on('SIGINT', () => {
  console.log("\nGracefully shutting down...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0); // Exit the process after server is closed
  });
});

// Graceful shutdown on SIGTERM
process.on('SIGTERM', () => {
  console.log("\nGracefully shutting down on SIGTERM...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0); // Exit the process after server is closed
  });
});
