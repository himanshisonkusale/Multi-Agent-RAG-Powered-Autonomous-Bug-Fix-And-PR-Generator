const express = require('express');
const router = express.Router();
const { indexRepository } = require('../rag/indexer');

router.post('/index', async (req, res) => {
  const { owner, repo, accessToken } = req.body;

  if (!owner || !repo || !accessToken) {
    return res.status(400).json({ error: 'owner, repo, and accessToken required' });
  }

  try {
    const result = await indexRepository(owner, repo, accessToken);
    res.json({ message: 'Repo indexed successfully ✅', ...result });
  } catch (error) {
    console.error('Indexing error:', error.message);
    res.status(500).json({ error: 'Indexing failed', details: error.message });
  }
});

module.exports = router;