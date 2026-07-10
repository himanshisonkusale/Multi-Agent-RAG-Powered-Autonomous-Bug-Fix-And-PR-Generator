require('dotenv').config();

const express = require('express');
const cors = require('cors');


const app = express();
const PORT = process.env.PORT || 8080;

const path = require('path');

app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./api/auth'));
app.use('/api/repos', require('./api/repos'));
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));


// Health check route
app.get('/', (req, res) => {
  res.json({ status: 'DevSentinel is running 🚀' });
});


// app.use('/api/auth', require('./api/auth'));
// app.use('/api/repos', require('./api/repos'));
app.use('/api/sentinel', require('./api/sentinel'));

const { app: slackApp } = require('./slack/slackBot');

(async () => {
  await slackApp.start(3000); // Bolt apna alag server 3000 pe start karega
  console.log('⚡️ Slack bot is running on port 3000!');
})();

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
