const { Pinecone } = require('@pinecone-database/pinecone');

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX);

/**
 * Bug description ke liye relevant code chunks dhundo
 * @param {string} query - User ka bug description
 * @param {string} repo - "owner/repo" format mein, results filter karne ke liye
 * @param {number} topK - Kitne top results chahiye
 */
async function retrieveRelevantChunks(query, repo, topK = 5) {
  const searchResponse = await index.searchRecords({
    query: {
      inputs: { text: query },
      topK,
      filter: repo ? { repo: { $eq: repo } } : undefined,
    },
  });

  // Results ko simple format mein convert karo
  const chunks = searchResponse.result.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    filePath: hit.fields.filePath,
    text: hit.fields.text,
    chunkIndex: hit.fields.chunkIndex,
  }));

  return chunks;
}

module.exports = { retrieveRelevantChunks };