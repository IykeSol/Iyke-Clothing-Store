module.exports = function errorHandler(err, req, res, next) {
  console.error('❌ ERROR:', err.message);
  console.error('Stack:', err.stack);
  
  const status = err.statusCode || 500;
  const payload =
    status >= 500
      ? { error: 'Internal server error' }
      : { error: err.message || 'Request failed' };
  
  res.status(status).json(payload);
};
