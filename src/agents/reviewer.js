const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function reviewFix(analysis, fix, bugDescription) {
  const prompt = `You are a senior code reviewer validating an AI-generated bug fix before it gets merged into production.

Bug Report:
"${bugDescription}"

Root Cause Analysis:
${analysis.rootCause}

Proposed Fix:
File: ${fix.filePath}
Original Code:
${fix.originalCode}

Fixed Code:
${fix.fixedCode}

Fix Explanation:
${fix.explanation}

Carefully review this fix and evaluate:
1. Does it actually address the root cause?
2. Could it introduce any side effects or break other functionality?
3. Is the code syntactically correct and consistent with good practices?
4. Is there enough context to be fully confident, or are there uncertainties?

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "confidenceScore": <number between 0-100>,
  "verdict": "safe to merge" or "needs review" or "risky",
  "reasoning": "clear explanation of why you gave this confidence score",
  "potentialSideEffects": "any risks or side effects you foresee, or 'None identified' if none",
  "uncertaintyReasons": "specific reasons you're not 100% confident, or 'None' if fully confident"
}

Be honest and critical — do not inflate the confidence score. If the fix seems incomplete or the context was limited, reflect that in a lower score.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });

  const responseText = completion.choices[0].message.content;

  let review;
  try {
    const cleaned = responseText.replace(/```json|```/g, '').trim();
    review = JSON.parse(cleaned);
  } catch (err) {
    return { error: 'Failed to parse review response', raw: responseText };
  }

  return review;
}

module.exports = { reviewFix };