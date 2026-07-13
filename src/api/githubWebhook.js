const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { updateFixStatus } = require('../utils/memory');

function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !req.rawBody) return false;

  const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false; // length mismatch etc.
  }
}

router.post('/webhook', async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const event = req.headers['x-github-event'];

  if (event === 'pull_request') {
    const { action, pull_request, repository } = req.body;

    if (action === 'closed') {
      const status = pull_request.merged ? 'merged' : 'rejected';
      await updateFixStatus(repository.full_name, pull_request.number, status);
      console.log(`PR #${pull_request.number} on ${repository.full_name} marked as ${status}`);
    }
  }

  res.json({ received: true });
});

module.exports = router;
