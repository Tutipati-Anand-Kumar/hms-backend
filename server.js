import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

import connectDB from "./config/db.js";
import { server } from "./app.js";
import os from "os";

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
}

connectDB().then(() => {
  const PORT = process.env.PORT || 3000;
  const ip = getLocalIp();
  process.env.FRONTEND_URL = process.env.FRONTEND_URL || `http://${ip}:${PORT}`;

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend URLs:`);
    console.log(`➡ Local:   http://localhost:${PORT}`);
    console.log(`➡ Network: http://${ip}:${PORT}`);
  });
});