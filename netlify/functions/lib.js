// Shared helpers: storage (Netlify Blobs, with an in-memory stand-in for local testing) and who is signed in.
const mem = {};
function memStore(name) {
  const m = mem[name] || (mem[name] = new Map());
  return {
    async get(key, opts) { const v = m.get(key); if (!v) return null; return opts && opts.type === "json" ? JSON.parse(v.data) : v.data; },
    async getWithMetadata(key) { const v = m.get(key); return v ? { data: v.data, metadata: v.metadata || {} } : null; },
    async setJSON(key, value) { m.set(key, { data: JSON.stringify(value) }); },
    async set(key, data, opts) { m.set(key, { data, metadata: (opts && opts.metadata) || {} }); },
    async delete(key) { m.delete(key); },
    async list(opts) { const p = (opts && opts.prefix) || ""; return { blobs: [...m.keys()].filter(k => k.startsWith(p)).map(key => ({ key })) }; },
  };
}
function stores(event) {
  if (event && event.blobs) {
    const { connectLambda, getStore } = require("@netlify/blobs");
    connectLambda(event);
    return { data: getStore({ name: "ftp", consistency: "strong" }), img: getStore({ name: "ftp-images", consistency: "strong" }) };
  }
  return { data: memStore("ftp"), img: memStore("ftp-images") };
}
// Admins and allowed email domains come from config.json, plus the ADMIN_EMAILS / ALLOWED_DOMAINS environment variables if set.
const config = require("./config.json");
const list = v => (Array.isArray(v) ? v : String(v || "").split(",")).map(s => String(s).trim().toLowerCase()).filter(Boolean);
const adminEmails = () => [...new Set([...list(config.adminEmails), ...list(process.env.ADMIN_EMAILS)])];
const allowedDomains = () => { const d = [...new Set([...list(config.allowedDomains), ...list(process.env.ALLOWED_DOMAINS)])]; return d.length ? d : ["ashesi.edu.gh"]; };
function emailAllowed(email) {
  const e = String(email || "").toLowerCase();
  if (adminEmails().includes(e)) return true;
  return allowedDomains().some(d => e.endsWith("@" + d));
}
function whoIs(context) {
  const u = context && context.clientContext && context.clientContext.user;
  if (!u || !u.sub || !u.email) return null;
  const roles = (u.app_metadata && u.app_metadata.roles) || [];
  const email = String(u.email).toLowerCase();
  const meta = u.user_metadata || {};
  return { id: u.sub, email, name: meta.full_name || meta.name || email.split("@")[0], isAdmin: roles.includes("admin") || adminEmails().includes(email) };
}
module.exports = { stores, whoIs, emailAllowed, adminEmails };
