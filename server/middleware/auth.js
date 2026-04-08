require("dotenv").config();
const jwt = require("jsonwebtoken");
const jwksRsa = require("jwks-rsa");

const jwksClient = jwksRsa.expressJwtSecret({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

/**
 * requireAuth  – validates the Bearer token and attaches req.user.
 * On failure returns 401.
 */
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
      if (err) return res.status(401).json({ error: "Invalid token", detail: err.message });
      req.user = decoded;
      next();
    }
  );
}

module.exports = { requireAuth };