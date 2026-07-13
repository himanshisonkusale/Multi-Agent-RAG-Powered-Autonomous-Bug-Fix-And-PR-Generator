const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// Only JS and Python are validated for now — other extensions are skipped gracefully
const SYNTAX_CHECKERS = {
  '.js': (filePath) => execSync(`node --check "${filePath}"`, { stdio: 'pipe' }),
  '.jsx': (filePath) => execSync(`node --check "${filePath}"`, { stdio: 'pipe' }),
  '.mjs': (filePath) => execSync(`node --check "${filePath}"`, { stdio: 'pipe' }),
  '.cjs': (filePath) => execSync(`node --check "${filePath}"`, { stdio: 'pipe' }),
  '.py': (filePath) => execSync(`python3 -m py_compile "${filePath}"`, { stdio: 'pipe' }),
};

/**
 * Applies the proposed fix to the real file content (without committing anything)
 * and runs a syntax check on the result. This catches fixes that would break
 * the file before a pull request is ever opened.
 */
async function simulateFix({ owner, repo, accessToken, fix }) {
  const ext = path.extname(fix.filePath || '').toLowerCase();
  const checker = SYNTAX_CHECKERS[ext];

  if (!checker) {
    return {
      passed: null,
      message: `Simulation isn't supported for ${ext || 'this file type'} yet — skipped, relying on the reviewer's judgment instead.`,
    };
  }

  const octokit = new Octokit({ auth: accessToken });

  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path: fix.filePath,
      ref: defaultBranch,
    });

    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

    if (!currentContent.includes(fix.originalCode)) {
      return {
        passed: false,
        message: 'Could not locate the original code snippet in the current file — it may have changed since analysis.',
      };
    }

    const updatedContent = currentContent.replace(fix.originalCode, fix.fixedCode);
    const tmpFile = path.join(os.tmpdir(), `simulate-${Date.now()}${ext}`);
    fs.writeFileSync(tmpFile, updatedContent);

    try {
      checker(tmpFile);
      return { passed: true, message: 'Syntax check passed on the full updated file.' };
    } catch (err) {
      const detail = err.stderr ? err.stderr.toString().split('\n')[0] : err.message;
      return { passed: false, message: `Syntax check failed: ${detail}` };
    } finally {
      fs.unlinkSync(tmpFile);
    }
  } catch (err) {
    return { passed: null, message: `Could not run simulation: ${err.message}` };
  }
}

module.exports = { simulateFix };
