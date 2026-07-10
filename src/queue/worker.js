const { Worker } = require('bullmq');
const { connection } = require('./redisQueue');
const { classifyIntent, answerGeneralQuestion } = require('../agents/router');
const { analyzeBug } = require('../agents/analyzer');
const { generateFix } = require('../agents/fixer');
const { reviewFix } = require('../agents/reviewer');
const { createFixPR } = require('../github/prCreator');

const worker = new Worker(
  'bug-fix-pipeline',
  async (job) => {
    const { bugDescription, repo, owner, accessToken, createPR } = job.data;
    const fullRepoName = `${owner}/${repo}`;

    await job.updateProgress({ stage: 'classifying' });
    const intent = await classifyIntent(bugDescription);

    if (intent === 'general_question') {
      await job.updateProgress({ stage: 'answering' });
      const result = await answerGeneralQuestion(bugDescription, fullRepoName);
      return {
        type: 'chat',
        answer: result.answer,
        relevantFiles: result.relevantFiles,
      };
    }

    await job.updateProgress({ stage: 'analyzing' });
    const analysis = await analyzeBug(bugDescription, fullRepoName);
    if (analysis.error) return { type: 'error', error: analysis.error };

    await job.updateProgress({ stage: 'fixing' });
    const fix = await generateFix(analysis, bugDescription, fullRepoName);
    if (fix.error) return { type: 'error', error: fix.error };

    await job.updateProgress({ stage: 'reviewing' });
    const review = await reviewFix(analysis, fix, bugDescription);

    let pr = null;
    if (createPR && accessToken) {
      await job.updateProgress({ stage: 'creating_pr' });
      try {
        pr = await createFixPR({ owner, repo, accessToken, fix, analysis, review, bugDescription });
      } catch (prError) {
        return { type: 'fix', analysis, fix, review, prError: prError.message };
      }
    }

    return { type: 'fix', analysis, fix, review, pr };
  },
  { connection, concurrency: 3 }
);

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

module.exports = { worker };
