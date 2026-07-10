const express = require('express');
const router = express.Router();
const { analyzeBug } = require('../agents/analyzer');
const { bugFixQueue } = require('../queue/redisQueue');
require('../queue/worker'); // starts the background worker as soon as this file loads

// Kept for direct/manual analysis testing — not part of the main async flow
router.post('/analyze', async (req, res) => {
  const { bugDescription, repo } = req.body;

  if (!bugDescription || !repo) {
    return res.status(400).json({ error: 'bugDescription and repo required' });
  }

  try {
    const result = await analyzeBug(bugDescription, repo);
    res.json(result);
  } catch (error) {
    console.error('Analysis error:', error.message);
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});

// Step 1: Enqueue the job and return immediately with a jobId
router.post('/process', async (req, res) => {
  const { bugDescription, repo, owner, accessToken, createPR } = req.body;

  if (!bugDescription || !repo || !owner) {
    return res.status(400).json({ error: 'bugDescription, repo, and owner required' });
  }

  try {
    const job = await bugFixQueue.add('process-bug', {
      bugDescription,
      repo,
      owner,
      accessToken,
      createPR,
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    console.error('Queue error:', error.message);
    res.status(500).json({ error: 'Failed to queue job', details: error.message });
  }
});

// Step 2: Poll this endpoint to check job progress / result
router.get('/status/:jobId', async (req, res) => {
  try {
    const job = await bugFixQueue.getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();

    if (state === 'completed') {
      return res.json({ status: 'completed', result: job.returnvalue });
    }

    if (state === 'failed') {
      return res.json({ status: 'failed', error: job.failedReason });
    }

    // waiting, active, or delayed — still in progress
    const progress = job.progress || {};
    return res.json({ status: 'in_progress', stage: progress.stage || state });
  } catch (error) {
    console.error('Status check error:', error.message);
    res.status(500).json({ error: 'Failed to check job status', details: error.message });
  }
});

module.exports = router;