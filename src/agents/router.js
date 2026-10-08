const Groq = require('groq-sdk');
const { retrieveRelevantChunks } = require('../rag/retriever');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Decide whether the user's message is a bug report
 * or a general question about the codebase.
 *
 * bug_fix:
 *   Analyzer -> Fixer -> Reviewer -> PR
 *
 * general_question:
 *   RAG-based answer only
 */
async function classifyIntent(message) {
  const prompt = `Classify this user request into exactly one category.

Categories:
- bug_fix
- general_question

Choose "bug_fix" if the user wants to:
- fix an error
- fix a bug
- solve a problem
- repair broken code
- change incorrect code
- resolve an issue
- create or open a pull request for a fix
- check an error and fix it

Examples:
"Fix the error in index.js" = bug_fix
"Check the error and fix it" = bug_fix
"Fix this bug and create a PR" = bug_fix
"Create a PR for this issue" = bug_fix
"Make the code work correctly" = bug_fix

Choose "general_question" ONLY when the user wants information
or an explanation and does NOT want the code changed.

Examples:
"How does this code work?" = general_question
"Explain the router" = general_question
"Which database does this project use?" = general_question
"How is Redis used?" = general_question
"Why does this function return 0?" = general_question

IMPORTANT:
If the user mentions an error, bug, problem, broken behavior,
or incorrect code AND asks to check, solve, fix, repair, resolve,
change, or create a PR, classify it as "bug_fix".

User message:
${message}

Return ONLY:
bug_fix
or
general_question`;

  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0,
    max_tokens: 20,
  });

  const choice = completion.choices?.[0];

  console.log(
    '🔍 CLASSIFIER RAW RESPONSE:',
    JSON.stringify(choice, null, 2)
  );

  const content = choice?.message?.content || '';
  const reasoning = choice?.message?.reasoning || '';

  const responseText = `${content} ${reasoning}`
    .trim()
    .toLowerCase();

  console.log('🧠 INTENT RAW TEXT:', responseText);

  if (responseText.includes('bug_fix')) {
    console.log('🧠 INTENT: bug_fix');
    return 'bug_fix';
  }

  if (responseText.includes('general_question')) {
    console.log('🧠 INTENT: general_question');
    return 'general_question';
  }

  // If the model returns an empty or unexpected response,
  // send the request through the bug-fix pipeline instead
  // of silently treating it as a general question.
  console.log(
    '⚠️ CLASSIFIER DID NOT RETURN A VALID INTENT'
  );
  console.log('⚠️ DEFAULTING TO: bug_fix');

  return 'bug_fix';
}

/**
 * Answer a general question about the codebase using RAG.
 * No fix or PR is created in this path.
 */
async function answerGeneralQuestion(message, repo) {
  const relevantChunks = await retrieveRelevantChunks(
    message,
    repo,
    5
  );

  const codeContext = relevantChunks
    .map(
      (chunk) =>
        `File: ${chunk.filePath}\n\`\`\`\n${chunk.text}\n\`\`\``
    )
    .join('\n\n---\n\n');

  const prompt = `You are a helpful assistant answering questions about a codebase.

Question:
"${message}"

Relevant code from the repository:
${codeContext || 'No relevant code found in the indexed repository.'}

Answer the question clearly and concisely based on the code above.

If the code context does not contain enough information to answer
confidently, say so honestly instead of guessing.`;

  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
  });

  return {
    answer: completion.choices[0].message.content.trim(),
    relevantFiles: relevantChunks.map(
      (chunk) => chunk.filePath
    ),
  };
}

module.exports = {
  classifyIntent,
  answerGeneralQuestion,
};