const { connection } = require('../queue/redisQueue');

/**
 * Records a newly created fix/PR so its outcome can be tracked later.
 */
async function recordFix(repoFullName, record) {
  const key = `history:${repoFullName}`;
  await connection.rpush(key, JSON.stringify({ ...record, status: 'pending' }));
}

/**
 * Returns the full fix history for a repository.
 */
async function getRepoHistory(repoFullName) {
  const key = `history:${repoFullName}`;
  const raw = await connection.lrange(key, 0, -1);
  return raw.map((r) => JSON.parse(r));
}

/**
 * Called by the GitHub webhook when a PR is closed — updates its stored status
 * to either 'merged' or 'rejected'.
 */
async function updateFixStatus(repoFullName, prNumber, status) {
  const key = `history:${repoFullName}`;
  const raw = await connection.lrange(key, 0, -1);
  if (!raw.length) return;

  const updated = raw.map((r) => {
    const parsed = JSON.parse(r);
    if (parsed.prNumber === prNumber) parsed.status = status;
    return JSON.stringify(parsed);
  });

  await connection.del(key);
  await connection.rpush(key, ...updated);
}

/**
 * Turns the raw history into a short summary the Reviewer agent can reason about.
 */
function summarizeHistory(history) {
  const total = history.length;
  const merged = history.filter((h) => h.status === 'merged').length;
  const rejected = history.filter((h) => h.status === 'rejected').length;
  const pending = total - merged - rejected;
  return { total, merged, rejected, pending };
}

module.exports = { recordFix, getRepoHistory, updateFixStatus, summarizeHistory };
