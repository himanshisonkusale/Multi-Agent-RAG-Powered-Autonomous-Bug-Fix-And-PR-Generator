const express = require('express');
const router = express.Router();
const { analyzeBug } = require('../agents/analyzer');
const { generateFix } = require('../agents/fixer');
const { reviewFix } = require('../agents/reviewer');
const { createFixPR } = require('../github/prCreator');
const { classifyIntent, answerGeneralQuestion } = require('../agents/router');

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

router.post('/process', async (req, res) => {
  const { bugDescription, repo, owner, accessToken, createPR } = req.body;

  if (!bugDescription || !repo || !owner) {
    return res.status(400).json({ error: 'bugDescription, repo, and owner required' });
  }

  try {
    const fullRepoName = `${owner}/${repo}`;

    // Step 0: Decide first — is this a bug report or a general question?
    const intent = await classifyIntent(bugDescription);

    if (intent === 'general_question') {
      const result = await answerGeneralQuestion(bugDescription, fullRepoName);
      return res.json({
        type: 'chat',
        answer: result.answer,
        relevantFiles: result.relevantFiles,
      });
    }

    // Step 1: Analyzer
    const analysis = await analyzeBug(bugDescription, fullRepoName);
    if (analysis.error) return res.status(400).json(analysis);

    // Step 2: Fixer
    const fix = await generateFix(analysis, bugDescription, fullRepoName);
    if (fix.error) return res.status(400).json(fix);

    // Step 3: Reviewer
    const review = await reviewFix(analysis, fix, bugDescription);

    let pr = null;

    // Step 4: PR creation — sirf jab createPR true ho aur accessToken diya ho
    if (createPR && accessToken) {
      try {
        pr = await createFixPR({ owner, repo, accessToken, fix, analysis, review, bugDescription });
      } catch (prError) {
        return res.json({
          type: 'fix',
          analysis,
          fix,
          review,
          prError: prError.message,
        });
      }
    }

    res.json({
      type: 'fix',
      analysis,
      fix,
      review,
      pr,
    });
  } catch (error) {
    console.error('Pipeline error:', error.message);
    res.status(500).json({ error: 'Pipeline failed', details: error.message });
  }
});

module.exports = router;