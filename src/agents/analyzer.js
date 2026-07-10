const Groq = require('groq-sdk');
const { retrieveRelevantChunks } = require('../rag/retriever');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function analyzeBug(bugDescription, repo) {
  // Step 1: RAG se relevant code chunks dhundo
  const relevantChunks = await retrieveRelevantChunks(bugDescription, repo, 5);

  if (relevantChunks.length === 0) {
    return {
      error: 'No relevant code found. Is the repo indexed?',
    };
  }

  // Step 2: Chunks ko ek context string mein combine karo
  const codeContext = relevantChunks
    .map((chunk) => `File: ${chunk.filePath}\n\`\`\`\n${chunk.text}\n\`\`\``)
    .join('\n\n---\n\n');

  // Step 3: Groq (LLaMA) ko bug + code context bhejo, analysis maango
  const prompt = `You are a senior software engineer analyzing a bug report.

Bug Report:
"${bugDescription}"

Relevant code from the repository:
${codeContext}

Analyze this bug and respond in this exact JSON format (no markdown, just raw JSON):
{
  "rootCause": "clear explanation of what is causing the bug",
  "affectedFile": "the file path most likely responsible",
  "affectedLines": "approximate line numbers or code section if identifiable",
  "explanation": "why this is happening, in simple terms"
}`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2, // Low temperature — hallucination kam karne ke liye
  });

  const responseText = completion.choices[0].message.content;

  let analysis;
  try {
    // Kabhi kabhi model markdown code block mein wrap kar deta hai, clean karo
    const cleaned = responseText.replace(/```json|```/g, '').trim();
    analysis = JSON.parse(cleaned);
  } catch (err) {
    return { error: 'Failed to parse AI response', raw: responseText };
  }

  return {
    ...analysis,
    relevantFiles: relevantChunks.map((c) => c.filePath),
  };
}

module.exports = { analyzeBug };