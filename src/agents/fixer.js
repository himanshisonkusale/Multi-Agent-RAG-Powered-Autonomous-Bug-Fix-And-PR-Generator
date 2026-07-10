const Groq = require('groq-sdk');
const { retrieveRelevantChunks } = require('../rag/retriever');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generateFix(analysis, bugDescription, repo) {
  // Analyzer ne jo affected file bataya, uska full context RAG se dobara le lo
  // (zyada precise fix ke liye, us specific file pe focus karke)
  const relevantChunks = await retrieveRelevantChunks(
    `${analysis.affectedFile} ${analysis.rootCause}`,
    repo,
    3
  );

  const codeContext = relevantChunks
    .map((chunk) => `File: ${chunk.filePath}\n\`\`\`\n${chunk.text}\n\`\`\``)
    .join('\n\n---\n\n');

  const prompt = `You are a senior software engineer fixing a bug.

Bug Report:
"${bugDescription}"

Root Cause Analysis:
${analysis.rootCause}

Affected File: ${analysis.affectedFile}

Relevant code:
${codeContext}

Generate a precise code fix. Respond in this exact JSON format (no markdown, just raw JSON):
{
  "filePath": "the exact file path to modify",
  "originalCode": "the exact original code snippet that needs to change (copy exactly as it appears)",
  "fixedCode": "the corrected code snippet that should replace the original",
  "explanation": "clear explanation of what changed and why this fixes the bug"
}

IMPORTANT: 
- originalCode must be an EXACT substring match from the provided code context, so it can be used for find-and-replace.
- Keep the fix minimal and focused — only change what's necessary to fix the bug.
- Do not invent code that isn't related to the actual file content shown above.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1, // Bahut low — precise code fix ke liye, creativity nahi chahiye
  });

  const responseText = completion.choices[0].message.content;

  let fix;
  try {
    const cleaned = responseText.replace(/```json|```/g, '').trim();
    fix = JSON.parse(cleaned);
  } catch (err) {
    return { error: 'Failed to parse fix response', raw: responseText };
  }

  return fix;
}

module.exports = { generateFix };