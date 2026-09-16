// Vercel serverless entry point.
//
// server.js exports the Express app without calling listen() unless it is the
// process entry, so it can be mounted directly as a Node function handler.
// Every /api/* path is rewritten here by vercel.json, which keeps the dynamic
// routes (/api/audits/:id) resolving through Express instead of the
// filesystem router.
module.exports = require('../server.js');
