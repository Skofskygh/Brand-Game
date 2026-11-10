// Runs when someone signs up. Only Ashesi email addresses (or listed admins) can create an account.
const { emailAllowed } = require("./lib");
exports.handler = async event => {
  let user = {};
  try { user = JSON.parse(event.body).user || {}; } catch (e) {}
  if (!emailAllowed(user.email)) return { statusCode: 400, body: JSON.stringify({ error: "Please sign up with your Ashesi email address." }) };
  return { statusCode: 200, body: "{}" };
};
