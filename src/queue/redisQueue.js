const { Queue } = require('bullmq');
const IORedis = require('ioredis');


const connection = new IORedis(process.env.REDIS_HOST || 'localhost', 6379, {
  maxRetriesPerRequest: null,
});

const bugFixQueue = new Queue('bug-fix-pipeline', { connection });

module.exports = { bugFixQueue, connection };