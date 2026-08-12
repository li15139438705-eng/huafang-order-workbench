import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4177);
const dataDir = join(root, "data");
const stateFile = join(dataDir, "workbench-state.json");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (url.pathname === "/api/state" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(existsSync(stateFile) ? readFileSync(stateFile, "utf8") : "{}");
    return;
  }

  if (url.pathname === "/api/state" && request.method === "POST") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000_000) request.destroy();
    });
    request.on("end", () => {
      try {
        JSON.parse(body);
        mkdirSync(dataDir, { recursive: true });
        writeFileSync(stateFile, body, "utf8");
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true }));
      } catch {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: false }));
      }
    });
    return;
  }

  const pathname = decodeURIComponent(url.pathname);
  const cleanPath = pathname === "/" ? "index.html" : normalize(pathname).replace(/^[/\\]+/, "").replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, cleanPath);

  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`华方挂单工作台：http://127.0.0.1:${port}`);
});
