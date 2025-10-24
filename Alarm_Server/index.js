import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://jf.justinschwarz.de'
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS: ' + origin));
  }
}));
app.use(bodyParser.json());

// In-Memory Token Store
const tokens = new Set();

app.get('/', (_, res) => res.send('JF Push Server OK'));

app.post('/register', (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'token missing' });
  tokens.add(token);
  return res.json({ ok: true, count: tokens.size });
});

app.post('/alarm', async (req, res) => {
  const { title = 'JF Alarm', body = 'Alarm für eure Gruppe!', data = {} } = req.body || {};
  if (tokens.size === 0) return res.json({ ok: true, sent: 0, note: 'no tokens registered' });

  const messages = Array.from(tokens).map(to => ({ to, sound: 'default', title, body, data }));
  try {
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chunk)
      });
    }
    res.json({ ok: true, sent: messages.length });
  } catch (e) {
    console.error('push failed', e);
    res.status(500).json({ error: 'push failed' });
  }
});

app.get('/stats', (_, res) => res.json({ tokens: tokens.size }));

app.listen(PORT, () => console.log(`JF Push Server listening on http://localhost:${PORT}`));
