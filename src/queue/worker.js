const { Worker } = require('bullmq');
const { connection } = require('./redisQueue');
const { classifyIntent, answerGeneralQuestion } = require('../agents/router');
const { analyzeBug } = require('../agents/analyzer');
const { generateFix } = require('../agents/fixer');
const { reviewFix } = require('../agents/reviewer');
const { simulateFix } = require('../simulation/simulator');
const { createFixPR } = require('../github/prCreator');
const { recordFix, getRepoHistory, summarizeHistory } = require('../utils/memory');
const { savePending, getPending, deletePending } = require('../utils/pendingFixes');

// Shared by the confirm-fix step: takes an existing analysis and runs the rest
// of the pipeline (Fixer -> Simulation -> Reviewer -> PR).
async function runFixPipeline({ owner, repo, accessToken, createPR, bugDescription, analysis, job }) {
  const fullRepoName = `${owner}/${repo}`;

  await job.updateProgress({ stage: 'fixing' });
  const fix = await generateFix(analysis, bugDescription, fullRepoName);
  if (fix.error) return { type: 'error', error: fix.error };

  await job.updateProgress({ stage: 'simulating' });
  const simulation = await simulateFix({ owner, repo, accessToken, fix });

  await job.updateProgress({ stage: 'reviewing' });
  const history = await getRepoHistory(fullRepoName);
  const historySummary = summarizeHistory(history);
  const review = await reviewFix(analysis, fix, bugDescription, simulation, historySummary);

  let pr = null;
  const simulationBlocksPR = simulation.passed === false;

  if (createPR && accessToken && !simulationBlocksPR) {
    await job.updateProgress({ stage: 'creating_pr' });
    try {
      pr = await createFixPR({ owner, repo, accessToken, fix, analysis, review, bugDescription });
      await recordFix(fullRepoName, {
        prNumber: pr.prNumber,
        filePath: fix.filePath,
        confidenceScore: review.confidenceScore,
        timestamp: Date.now(),
      });
    } catch (prError) {
      return { type: 'fix', analysis, fix, review, simulation, historySummary, prError: prError.message };
    }
  }

  return {
    type: 'fix',
    analysis,
    fix,
    review,
    simulation,
    historySummary,
    pr,
    prSkipped: simulationBlocksPR,
  };
}

const worker = new Worker(
  'bug-fix-pipeline',
  async (job) => {
    // ===== Step 2: user confirmed "yes, fix it" — resume from the saved analysis =====
    if (job.name === 'confirm-fix') {
      const { pendingId } = job.data;
      const pending = await getPending(pendingId);

      if (!pending) {
        return { type: 'error', error: "This request has expired — please describe the bug again." };
      }

      const result = await runFixPipeline({ ...pending, job });
      await deletePending(pendingId);
      return result;
    }

    // ===== Step 1 (default): classify, then only analyze — do not fix yet =====
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

    // Remember everything needed to resume, keyed by this job's own id
    await savePending(job.id, { owner, repo, accessToken, createPR, bugDescription, analysis });

    return {
      type: 'analysis',
      analysis,
      pendingId: job.id,
    };
  },
  { connection, concurrency: 3 }
);

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

module.exports = { worker };