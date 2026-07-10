const { Octokit } = require('@octokit/rest');

async function createFixPR({ owner, repo, accessToken, fix, analysis, review, bugDescription }) {
  const octokit = new Octokit({ auth: accessToken });

  // Step 1: Default branch ka SHA lo
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });
  const baseSha = refData.object.sha;

  // Step 2: Naya branch banao
  const branchName = `devsentinel-fix-${Date.now()}`;
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  // Step 3: File ka current content lo (naye branch se)
  const { data: fileData } = await octokit.repos.getContent({
    owner,
    repo,
    path: fix.filePath,
    ref: branchName,
  });

  const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

  // Step 4: originalCode ko fixedCode se replace karo
  if (!currentContent.includes(fix.originalCode)) {
    throw new Error(
      `Original code snippet not found in ${fix.filePath}. File may have changed, or AI's originalCode didn't match exactly.`
    );
  }

  const updatedContent = currentContent.replace(fix.originalCode, fix.fixedCode);

  // Step 5: Updated file ko naye branch pe commit karo
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: fix.filePath,
    message: `fix: ${analysis.rootCause.slice(0, 60)}...`,
    content: Buffer.from(updatedContent).toString('base64'),
    sha: fileData.sha,
    branch: branchName,
  });

  // Step 6: PR create karo — description mein confidence score, reasoning sab daalo
  const prBody = `## 🤖 Automated Fix by DevSentinel

**Bug Report:**
${bugDescription}

**Root Cause:**
${analysis.rootCause}

**Fix Explanation:**
${fix.explanation}

---

### 📊 Confidence Score: ${review.confidenceScore}%
**Verdict:** ${review.verdict}

**Reasoning:**
${review.reasoning}

**Potential Side Effects:**
${review.potentialSideEffects}

**Uncertainty (if any):**
${review.uncertaintyReasons}

---
⚠️ This PR was generated autonomously by AI. Please review carefully before merging, especially if confidence score is below 90%.
`;

  const { data: prData } = await octokit.pulls.create({
    owner,
    repo,
    title: `🤖 Fix: ${analysis.rootCause.slice(0, 70)}`,
    head: branchName,
    base: defaultBranch,
    body: prBody,
  });

  return {
    prUrl: prData.html_url,
    prNumber: prData.number,
    branchName,
  };
}

module.exports = { createFixPR };