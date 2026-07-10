const { Octokit } = require('@octokit/rest');
const { Pinecone } = require('@pinecone-database/pinecone');

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX);

// Sirf code files index karenge — ye extensions allow honge
const ALLOWED_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rb', '.php', '.json', '.md'];

// Ignore karne wale folders
const IGNORE_PATHS = ['node_modules', '.git', 'dist', 'build', 'vendor', '.next'];

function shouldIndexFile(path) {
  if (IGNORE_PATHS.some((ignored) => path.includes(ignored))) return false;
  return ALLOWED_EXTENSIONS.some((ext) => path.endsWith(ext));
}

// Bade files ko chunks mein todo (roughly 100 lines per chunk)
function chunkContent(content, chunkSize = 100) {
  const lines = content.split('\n');
  const chunks = [];
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize).join('\n'));
  }
  return chunks;
}

async function indexRepository(owner, repo, accessToken) {
  const octokit = new Octokit({ auth: accessToken });

  console.log(`📦 Fetching repo tree: ${owner}/${repo}`);

  // Repo ka poora file tree lo (recursive)
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: defaultBranch,
    recursive: 'true',
  });

  const filesToIndex = treeData.tree.filter(
    (item) => item.type === 'blob' && shouldIndexFile(item.path)
  );

  console.log(`📄 Found ${filesToIndex.length} files to index`);

  const vectors = [];

  for (const file of filesToIndex) {
    try {
      const { data: blobData } = await octokit.git.getBlob({
        owner,
        repo,
        file_sha: file.sha,
      });

      const content = Buffer.from(blobData.content, 'base64').toString('utf-8');
      const chunks = chunkContent(content);

      chunks.forEach((chunk, idx) => {
  vectors.push({
    id: `${owner}-${repo}-${file.path}-chunk${idx}`,
    text: chunk,
    filePath: file.path,
    chunkIndex: idx,
    repo: `${owner}/${repo}`,
  });
});
    } catch (err) {
      console.error(`⚠️ Skipping file ${file.path}:`, err.message);
    }
  }

  console.log(`🔢 Total chunks to upsert: ${vectors.length}`);

  // Pinecone mein batches mein upsert karo (100 ek baar mein)
  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await index.upsertRecords({ records: batch });// integrated embedding index ke liye ye method
    console.log(`✅ Upserted batch ${i / BATCH_SIZE + 1}`);
  }

  console.log(`🎉 Indexing complete for ${owner}/${repo}`);
  return { totalFiles: filesToIndex.length, totalChunks: vectors.length };
}

module.exports = { indexRepository };