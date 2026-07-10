const { App } = require('@slack/bolt');
const { analyzeBug } = require('../agents/analyzer');
const { generateFix } = require('../agents/fixer');
const { reviewFix } = require('../agents/reviewer');
const { createFixPR } = require('../github/prCreator');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Jab koi bot ko @mention kare
app.event('app_mention', async ({ event, say }) => {
  // Mention text se bot ka naam hata do, bas bug description bacha lo
  const bugDescription = event.text.replace(/<@[^>]+>/g, '').trim();

  if (!bugDescription) {
    await say("Please describe the bug you'd like me to fix. Example: `@DevSentinel fix: login page crashes with null pointer`");
    return;
  }

  await say(`🔍 Got it! Analyzing the issue now... this may take a moment.`);

  try {
    // ⚠️ Abhi ke liye repo/owner/token hardcoded hai — baad mein per-user config banayenge
    const owner = process.env.DEFAULT_GITHUB_OWNER;
    const repo = process.env.DEFAULT_GITHUB_REPO;
    const accessToken = process.env.GITHUB_TOKEN;
    const fullRepoName = `${owner}/${repo}`;

    const analysis = await analyzeBug(bugDescription, fullRepoName);
    if (analysis.error) {
      await say(`❌ Couldn't analyze the issue: ${analysis.error}`);
      return;
    }

    const fix = await generateFix(analysis, bugDescription, fullRepoName);
    if (fix.error) {
      await say(`❌ Couldn't generate a fix: ${fix.error}`);
      return;
    }

    const review = await reviewFix(analysis, fix, bugDescription);

    let pr = null;
    try {
      pr = await createFixPR({ owner, repo, accessToken, fix, analysis, review, bugDescription });
    } catch (prError) {
      await say(`⚠️ Fix generated but PR creation failed: ${prError.message}`);
      return;
    }

    await say(
      `✅ *Fix ready!*\n\n` +
      `*Root cause:* ${analysis.rootCause}\n\n` +
      `*Confidence Score:* ${review.confidenceScore}% — _${review.verdict}_\n` +
      `*Reasoning:* ${review.reasoning}\n\n` +
      `📎 *PR:* ${pr.prUrl}`
    );
  } catch (error) {
    console.error('Slack bot error:', error.message);
    await say(`❌ Something went wrong: ${error.message}`);
  }
});

module.exports = { app };