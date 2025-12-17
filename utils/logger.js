const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// Helper functions for logging user and admin actions
logger.userAction = function(userId, action, metadata = {}) {
  this.info({
    type: 'USER_ACTION',
    userId,
    action,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
};

logger.adminAction = function(adminId, action, metadata = {}) {
  this.info({
    type: 'ADMIN_ACTION',
    adminId,
    action,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
};

logger.securityEvent = function(event, metadata = {}) {
  this.warn({
    type: 'SECURITY_EVENT',
    event,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
};

module.exports = logger;
