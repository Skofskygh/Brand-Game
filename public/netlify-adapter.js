/* Connects the Fix the Poster page to Netlify Identity (sign-in) and the site's API.
   It provides the same small interface the page uses inside Claude (window.claude.use), so the page code stays shared. */
window.NETLIFY_MODE = true;
(function () {
  const id = () => window.netlifyIdentity;
  let me = null, resolveReady;
  const ready = new Promise(r => (resolveReady = r));
  const done = () => { resolveReady(); };

  async function token() { const u = id() && id().currentUser(); if (!u) return null; try { return await u.jwt(); } catch (e) { return null; } }
  async function call(method, path, body) {
    const t = await token();
    const r = await fetch("/api" + path, {
      method,
      headers: Object.assign({ "Content-Type": "application/json" }, t ? { Authorization: "Bearer " + t } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 401 || r.status === 403) throw { code: "invalid_argument" };
    if (!r.ok) throw { code: "unavailable" };
    return r.json();
  }

  function boot() {
    const w = id();
    if (!w) { done(); return; }
    w.on("init", async u => { if (u) { try { me = await call("GET", "/me"); } catch (e) { me = null; } } done(); });
    w.on("login", () => { w.close(); location.reload(); });
    w.on("logout", () => location.reload());
    setTimeout(done, 6000); // never leave the page waiting if sign-in can't load
  }
  boot();

  // Sign in / sign out in the header
  function navLink() {
    const nav = document.getElementById("nav"); if (!nav || document.getElementById("authLink")) return;
    const a = document.createElement("a"); a.href = "#"; a.id = "authLink";
    a.textContent = me ? "Sign out" : "Sign in";
    a.title = me ? "Signed in as " + me.email : "Sign in with your Ashesi email";
    a.addEventListener("click", e => { e.preventDefault(); const w = id(); if (!w) return; me ? w.logout() : w.open(); });
    nav.appendChild(a);
  }
  ready.then(() => { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", navLink); else navLink(); });

  // Data: posters and scores, refreshed after each change
  const subs = {};
  const snap = list => ({ docs: list.map(d => ({ id: d.id, exists: true, data: () => d })), size: list.length, empty: !list.length });
  let posters = [];
  async function loadPosters() { posters = await call("GET", "/posters"); (subs.posters || []).forEach(f => f(snap(posters))); }
  async function loadScores() { const o = await call("GET", "/scores"); const l = Object.entries(o || {}).map(([k, v]) => Object.assign({ id: k }, v)); (subs.scores || []).forEach(f => f(snap(l))); }
  const loaders = { posters: loadPosters, scores: loadScores };
  setInterval(() => { if (me && document.visibilityState === "visible" && subs.scores) loadScores().catch(() => {}); }, 60000);

  const db = {
    collection(name) {
      return {
        onSnapshot(next, error) {
          (subs[name] || (subs[name] = [])).push(next);
          const l = loaders[name];
          if (l) l().catch(e => error && error(e)); else setTimeout(() => next(snap([])), 0);
          return () => { subs[name] = (subs[name] || []).filter(f => f !== next); };
        },
      };
    },
    doc(path) {
      const [col, docId] = path.split("/");
      const url = "/" + col + "/" + encodeURIComponent(docId);
      return {
        async get() {
          if (col === "posters") { const p = posters.find(x => x.id === docId); return { exists: !!p, data: () => p }; }
          const d = await call("GET", url); return { exists: !!d, data: () => d || undefined };
        },
        async set(d) { await call("PUT", url, d); if (loaders[col]) loaders[col]().catch(() => {}); },
        async update(d) { await call("PATCH", url, d); if (loaders[col]) loaders[col]().catch(() => {}); },
        async delete() { await call("DELETE", url); if (loaders[col]) loaders[col]().catch(() => {}); },
      };
    },
  };

  const user = {
    async isOwner() { return false; },
    async canEdit() { return !!(me && me.isAdmin); },
    async can() { return !!me; },
    async id() { return me ? me.id : null; },
    async me() { return me ? { id: me.id, name: me.name, email: me.email, isOwner: false, canEdit: me.isAdmin } : { id: null, name: "", email: null }; },
    async profiles(ids) { const list = [].concat(ids).filter(Boolean); if (!list.length) return {}; return call("GET", "/users?ids=" + encodeURIComponent(list.join(","))); },
  };

  const assets = {
    async upload(blob) {
      const buf = new Uint8Array(await blob.arrayBuffer()); let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      if (buf.length > 4.5e6) throw { code: "too_large" };
      return call("POST", "/upload", { type: blob.type || "image/jpeg", data: btoa(bin) });
    },
  };

  // Extras only the Netlify site has
  window.ftpExtra = {
    ask: q => call("POST", "/feedback", q),
    feedback: () => call("GET", "/feedback"),
    resolve: key => call("DELETE", "/feedback/" + encodeURIComponent(key)),
  };

  window.claude = {
    async use(name) {
      await ready;
      if (!me) return null;
      if (name === "db") return db;
      if (name === "user") return user;
      if (name === "assets") return me.isAdmin ? assets : null;
      return null;
    },
  };
})();
