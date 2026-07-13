const { connection } = require('../queue/redisQueue');

const PENDING_TTL_SECONDS = 30 * 60; // pending confirmations expire after 30 minutes

async function savePending(id, data) {
  await connection.set(`pending:${id}`, JSON.stringify(data), 'EX', PENDING_TTL_SECONDS);
}

async function getPending(id) {
  const raw = await connection.get(`pending:${id}`);
  return raw ? JSON.parse(raw) : null;
}

async function deletePending(id) {
  await connection.del(`pending:${id}`);
}

module.exports = { savePending, getPending, deletePending };