require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

// IMPORTANT: only ONE express.json() call, with verify, and it must come
// before all routes so req.rawBody is available everywhere (needed by the webhook)
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

app.use('/api/auth', require('./api/auth'));
app.use('/api/repos', require('./api/repos'));
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));
app.use('/api/github', require('./api/githubWebhook'));

// Health check route
app.get('/', (req, res) => {
  res.json({ status: 'Autonomous Bug Fixer is running' });
});

app.use('/api/sentinel', require('./api/sentinel'));

const { app: slackApp } = require('./slack/slackBot');

(async () => {
  await slackApp.start(3000); // Bolt apna alag server 3000 pe start karega
  console.log('⚡️ Slack bot is running on port 3000!');
})();

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});