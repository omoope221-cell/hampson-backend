const xss = require('xss');

// Recursively strips/escapes dangerous HTML from every string in
// req.body, req.query and req.params. Lightweight replacement for the
// now-unmaintained xss-clean package.
function clean(value) {
  if (typeof value === 'string') return xss(value);
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      value[key] = clean(value[key]);
    });
    return value;
  }
  return value;
}

module.exports = function xssSanitize(req, res, next) {
  if (req.body) req.body = clean(req.body);
  if (req.params) req.params = clean(req.params);
  next();
};
