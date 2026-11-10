// Runs after a sign-up is confirmed. Gives the admin role to anyone listed in ADMIN_EMAILS.
const { adminEmails } = require("./lib");
exports.handler = async event => {
  let user = {};
  try { user = JSON.parse(event.body).user || {}; } catch (e) {}
  const email = String(user.email || "").toLowerCase();
  const roles = new Set(((user.app_metadata || {}).roles) || []);
  if (adminEmails().includes(email)) roles.add("admin");
  return { statusCode: 200, body: JSON.stringify({ app_metadata: { ...(user.app_metadata || {}), roles: [...roles] } }) };
};
