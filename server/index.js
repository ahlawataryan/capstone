require('dotenv').config({ path: '/server/.env' });
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");
const jwksRsa = require("jwks-rsa");
const { ManagementClient } = require("auth0");
process.loadEnvFile();

/*
In the directory capstone/server, run node index.js. Then run npm run dev in frontend
*/

const port = 5000;
const app = express();
const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(express.json());
app.use(cors(corsOptions));

//http://localhost:5000/api/authmgt
app.post("/api/authmgt", async (req, res) => {
  try{
  const toDelete = req.body.email;
  const client = new ManagementClient({
    domain: 'dev-6qyiyqksmtwrjpbi.us.auth0.com',
    clientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
    clientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET
  });
  let user = await client.users.listUsersByEmail({
    fields: 'user_id',
    include_fields: true,
    email: toDelete,
  });
  console.log(user[0].user_id);
  if(user){
    await client.users.delete(user[0].user_id);
    res.send('User successfully deleted');
  }
} catch (err) {
  console.log(err);
  res.send('Failed to delete user');
}
});

app.get("/", (req, res) => console.log("Ok"));
app.get("/api/health", (req, res) => res.json({ ok: true }));

//Pretty sure this is all garbage
// --- Auth0 JWT verification ---
const jwksClient = jwksRsa.expressJwtSecret({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  jwt.verify(
    token,
    jwksClient,
    {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ["RS256"],
    },
    (err, decoded) => {
      if (err) return res.status(401).json({ error: "Invalid token" });
      req.user = decoded;
      next();
    }
  );
}

// Who am I? (used later for role-based routing)
app.get("/api/me", requireAuth, (req, res) => {
  const row = db
    .prepare("SELECT role, created_at FROM users WHERE auth0_sub = ?")
    .get(req.user.sub);

  if (!row) return res.json({ role: "unknown" });
  res.json(row);
});

// --- POST /api/auth/sync ---
// Called by the frontend on every login.
// Creates the user row if it doesn't exist yet, then returns their role.
app.post("/api/auth/sync", requireAuth, (req, res) => {
  const sub = req.user.sub;
  // Auth0 puts email in a namespaced claim OR the standard "email" field
  // depending on how your Auth0 Actions/Rules are configured.
  const email =
    req.user["https://capstone/email"] || req.user.email || null;

  // Insert only if this auth0_sub has never been seen before.
  // DO NOTHING means existing users (and their roles) are never overwritten.
  db.prepare(`
    INSERT INTO users (auth0_sub, email, role)
    VALUES (?, ?, 'client')
    ON CONFLICT(auth0_sub) DO NOTHING
  `).run(sub, email);

  const row = db
    .prepare("SELECT role, email, created_at FROM users WHERE auth0_sub = ?")
    .get(sub);

  res.json({ role: row.role, email: row.email });
});

// Dev helper: set your role quickly (remove later if you want)
app.post("/api/dev/set-role", requireAuth, (req, res) => {
  const { role } = req.body;
  if (!["admin", "client", "student"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  db.prepare(
    `INSERT INTO users (auth0_sub, role)
     VALUES (?, ?)
     ON CONFLICT(auth0_sub) DO UPDATE SET role=excluded.role`
  ).run(req.user.sub, role);

  res.json({ ok: true, role });
});

//port 5173
app.listen(port, () => console.log(`Server running on ${port}`));

