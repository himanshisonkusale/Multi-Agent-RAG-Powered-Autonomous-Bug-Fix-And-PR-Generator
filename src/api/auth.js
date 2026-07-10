const express = require('express');
const axios = require('axios');
const router = express.Router();

// Step 1: User ko GitHub login page pe redirect karo
router.get('/github', (req, res) => {
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo,user`;
  res.redirect(redirectUrl);
});

// Step 2: GitHub callback — code milega, usse access token lenge
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No code provided by GitHub' });
  }

  try {
    // Code ko GitHub access token se exchange karo
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      return res.status(400).json({ error: 'Failed to get access token', details: tokenResponse.data });
    }

    // User ki GitHub profile info nikaalo
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${accessToken}` },
    });

    // Abhi ke liye simple response — baad mein iske saath JWT bhi banayenge
   res.redirect(`/dashboard/index.html?token=${accessToken}&username=${userResponse.data.login}`);
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.status(500).json({ error: 'GitHub OAuth failed' });
  }
});

module.exports = router;