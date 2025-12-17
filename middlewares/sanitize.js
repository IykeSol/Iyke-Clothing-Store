const xss = require('xss');

function sanitizeValue(v) {
  if (typeof v === 'string') {
    return xss(v.trim());
  }
  if (Array.isArray(v)) {
    return v.map(sanitizeValue);
  }
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) {
      if (k.startsWith('$')) continue; // prevent Mongo operator injection
      out[k] = sanitizeValue(v[k]);
    }
    return out;
  }
  return v;
}

module.exports = function sanitize(req, res, next) {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};
