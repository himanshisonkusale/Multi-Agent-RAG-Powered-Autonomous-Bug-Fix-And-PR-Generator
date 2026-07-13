const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// Locally (Docker), REDIS_HOST=redis builds redis://redis:6379
// On a hosting platform (Render, Railway, etc.), REDIS_URL is provided directly
const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:6379`;

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

const bugFixQueue = new Queue('bug-fix-pipeline', { connection });

module.exports = { bugFixQueue, connection };