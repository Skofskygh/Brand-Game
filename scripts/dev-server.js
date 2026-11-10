// Local testing only: serves public/ and runs the API with a fake signed-in user.
// Send "Authorization: Bearer dev:<email>" (add "+admin" for admin, e.g. dev:you@ashesi.edu.gh+admin).
// This file is never deployed and the real API ignores it.
const http = require("http"), fs = require("fs"), path = require("path");
const { handler } = require("../netlify/functions/api");
const root = path.join(__dirname, "..", "public");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png" };
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    let body = ""; for await (const c of req) body += c;
    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer dev:([^+]+)(\+admin)?$/);
    const ctx = m ? { clientContext: { user: { sub: "u-" + Buffer.from(m[1]).toString("hex").slice(0, 16), email: m[1], user_metadata: { full_name: m[1].split("@")[0] }, app_metadata: { roles: m[2] ? ["admin"] : [] } } } } : {};
    const r = await handler({ path: url.pathname, httpMethod: req.method, body: body || null, queryStringParameters: Object.fromEntries(url.searchParams) }, ctx);
    res.writeHead(r.statusCode, r.headers); res.end(r.isBase64Encoded ? Buffer.from(r.body, "base64") : r.body); return;
  }
  const f = path.join(root, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end("Not found"); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(process.env.PORT || 8888, () => console.log("Fix the Poster dev server on http://localhost:" + (process.env.PORT || 8888)));
