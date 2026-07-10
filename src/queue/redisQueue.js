const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// Uses REDIS_HOST from .env — 'redis' when running in Docker, 'localhost' otherwise
const connection = new IORedis(process.env.REDIS_HOST || 'localhost', 6379, {
  maxRetriesPerRequest: null,
});

const bugFixQueue = new Queue('bug-fix-pipeline', { connection });

module.exports = { bugFixQueue, connection };