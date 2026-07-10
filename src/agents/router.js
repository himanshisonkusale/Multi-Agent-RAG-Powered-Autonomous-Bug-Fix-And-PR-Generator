const Groq = require('groq-sdk');
const { retrieveRelevantChunks } = require('../rag/retriever');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Decide whether the user's message is a bug report (needs Analyzer -> Fixer -> Reviewer -> PR)
 * or a general question about the codebase (just needs a plain answer).
 */
async function classifyIntent(message) {
  const prompt = `Classify the following user message into exactly one category:

Message: "${message}"

Categories:
- "bug_fix": describes a bug, error, crash, unexpected behavior, or something broken that needs fixing
- "general_question": asks about the codebase, project structure, how something works, or any other general question

Respond with ONLY one word: either "bug_fix" or "general_question". No punctuation, no explanation.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 10,
  });

  const answer = completion.choices[0].message.content.trim().toLowerCase();
  return answer.includes('bug_fix') ? 'bug_fix' : 'general_question';
}

/**
 * Answer a general question about the codebase using RAG (no fix/PR involved).
 */
async function answerGeneralQuestion(message, repo) {
  const relevantChunks = await retrieveRelevantChunks(message, repo, 5);

  const codeContext = relevantChunks
    .map((chunk) => `File: ${chunk.filePath}\n\`\`\`\n${chunk.text}\n\`\`\``)
    .join('\n\n---\n\n');

  const prompt = `You are a helpful assistant answering questions about a codebase.

Question: "${message}"

Relevant code from the repository:
${codeContext || 'No relevant code found in the indexed repository.'}

Answer the question clearly and concisely based on the code above. If the code context doesn't contain enough information to answer confidently, say so honestly instead of guessing.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  return {
    answer: completion.choices[0].message.content.trim(),
    relevantFiles: relevantChunks.map((c) => c.filePath),
  };
}

module.exports = { classifyIntent, answerGeneralQuestion };