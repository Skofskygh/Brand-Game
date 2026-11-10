// Fix the Poster API. All routes need a signed-in Netlify Identity user except GET /image/:id.
const { stores, whoIs, emailAllowed } = require("./lib");
const seed = require("./seed-posters.json");

const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const ok = body => json(200, body);
const err = (status, message) => json(status, { error: message });
const safeId = s => /^[A-Za-z0-9_.:@+~-]{1,120}$/.test(s || "");

async function allPosters(data) {
  const { blobs } = await data.list({ prefix: "posters/" });
  if (!blobs.length && !(await data.get("meta/seeded"))) {
    for (const p of seed) { const { id, ...rest } = p; await data.setJSON("posters/" + id, rest); }
    await data.setJSON("meta/seeded", { at: new Date().toISOString() });
    return seed.map(p => ({ ...p }));
  }
  const out = [];
  for (const b of blobs) { const d = await data.get(b.key, { type: "json" }); if (d) out.push({ id: b.key.slice(8), ...d }); }
  return out;
}

exports.handler = async (event, context) => {
  const { data, img } = stores(event);
  const path = (event.path || "").replace(/^\/(\.netlify\/functions\/api|api)/, "") || "/";
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const method = event.httpMethod;
  let body = null;
  if (event.body) { try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body); } catch (e) { return err(400, "Invalid JSON"); } }

  // Public: images uploaded from the Studio.
  if (method === "GET" && parts[0] === "image" && safeId(parts[1])) {
    const r = await img.getWithMetadata(parts[1], { type: "arrayBuffer" });
    if (!r) return err(404, "Not found");
    return { statusCode: 200, isBase64Encoded: true, headers: { "Content-Type": (r.metadata && r.metadata.type) || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" }, body: Buffer.from(r.data).toString("base64") };
  }

  const me = whoIs(context);
  if (!me) return err(401, "Sign in first");
  if (!emailAllowed(me.email)) return err(403, "This email can't use Fix the Poster");
  const admin = () => me.isAdmin;
  const touchUser = () => data.setJSON("users/" + me.id, { name: me.name, email: me.email, lastSeen: new Date().toISOString() });

  try {
    // Who am I
    if (method === "GET" && parts[0] === "me") { await touchUser(); return ok(me); }

    // Posters
    if (parts[0] === "posters") {
      if (method === "GET" && !parts[1]) { const all = await allPosters(data); return ok(admin() ? all : all.filter(p => p.status === "live")); }
      if (!admin()) return err(403, "Only the brand team can change posters");
      const id = parts[1]; if (!safeId(id)) return err(400, "Bad poster id");
      if (method === "PUT") { if (!body || typeof body !== "object") return err(400, "Missing poster"); const { id: _, ...rest } = body; await data.setJSON("posters/" + id, rest); return ok({ saved: true }); }
      if (method === "PATCH") { const cur = await data.get("posters/" + id, { type: "json" }); if (!cur) return err(404, "Not found"); await data.setJSON("posters/" + id, { ...cur, ...body }); return ok({ saved: true }); }
      if (method === "DELETE") { await data.delete("posters/" + id); return ok({ deleted: true }); }
    }

    // Scores: everyone reads all (leaderboard); each person writes only their own.
    if (parts[0] === "scores") {
      if (method === "GET" && !parts[1]) { const { blobs } = await data.list({ prefix: "scores/" }); const out = {}; for (const b of blobs) out[b.key.slice(7)] = await data.get(b.key, { type: "json" }); return ok(out); }
      const id = parts[1]; if (!safeId(id)) return err(400, "Bad id");
      if (method === "GET") return ok(await data.get("scores/" + id, { type: "json" }));
      if (method === "PUT") {
        if (id !== me.id) return err(403, "You can only save your own scores");
        if (!body || typeof body !== "object" || JSON.stringify(body).length > 200000) return err(400, "Bad score");
        const { id: _, ...rest } = body; await data.setJSON("scores/" + id, rest); await touchUser(); return ok({ saved: true });
      }
    }

    // Names for the leaderboard (emails only for the brand team)
    if (method === "GET" && parts[0] === "users") {
      const ids = String((event.queryStringParameters || {}).ids || "").split(",").filter(safeId).slice(0, 200);
      const out = {};
      for (const i of ids) { const u = await data.get("users/" + i, { type: "json" }); if (u) out[i] = admin() ? { name: u.name, email: u.email } : { name: u.name }; }
      return ok(out);
    }

    // Questions for the brand team
    if (parts[0] === "feedback") {
      if (method === "POST") {
        const text = String((body && body.text) || "").trim().slice(0, 1000); if (!text) return err(400, "Empty question");
        const key = "feedback/" + new Date().toISOString().replace(/[:.]/g, "-") + "-" + me.id.slice(0, 12);
        const pick = k => String((body && body[k]) || "").slice(0, 300);
        await data.setJSON(key, { text, posterId: pick("posterId"), posterTitle: pick("posterTitle"), areaId: pick("areaId"), areaLabel: pick("areaLabel"), question: pick("question"), userId: me.id, name: me.name, email: me.email, at: new Date().toISOString() });
        return ok({ sent: true });
      }
      if (!admin()) return err(403, "Only the brand team can read questions");
      if (method === "GET") { const { blobs } = await data.list({ prefix: "feedback/" }); const out = []; for (const b of blobs.slice(-300)) { const f = await data.get(b.key, { type: "json" }); if (f) out.push({ key: b.key.slice(9), ...f }); } out.sort((a, b) => String(b.at).localeCompare(String(a.at))); return ok(out); }
      if (method === "DELETE" && safeId(parts[1])) { await data.delete("feedback/" + parts[1]); return ok({ deleted: true }); }
    }

    // Image upload from the Studio
    if (method === "POST" && parts[0] === "upload") {
      if (!admin()) return err(403, "Only the brand team can upload");
      const type = String((body && body.type) || ""); if (!/^image\/(jpeg|png|webp)$/.test(type)) return err(400, "Use a JPG, PNG or WebP image");
      const buf = Buffer.from(String((body && body.data) || ""), "base64"); if (!buf.length || buf.length > 4.5e6) return err(400, "Image must be under 4.5 MB");
      const id = "img-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      await img.set(id, buf, { metadata: { type } });
      return ok({ id, url: "/api/image/" + id, contentType: type, sizeBytes: buf.length });
    }

    return err(404, "Unknown route");
  } catch (e) {
    console.error(e);
    return err(500, "Something went wrong");
  }
};
