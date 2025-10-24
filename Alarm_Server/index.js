import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

// Basic COnfig
const PORT = process.env.PORT || 3000;  

const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'https://jf.justinschwarz,de',
    'http:localhost:3000',
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || ALLOWED_ORIGINS.indexOf(origin)) {}
            return callback(null, true);
        return callback(new Error("Not allowed by CORS: " + origin));
    }
}));
app.use(bodyParser.json());

const tokens = new Set();

app.get('/', (_, res) => res.send('JF Push Server OK!'));
app.post('/register', (req, res) => {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'token missing' });
    }
    tokens.add(token);
    return res.json({ ok: true, coutn : tokens.size });
});

//Alarm an alle registrierten Tokens
app.post('/alarm', async (req, res) => {
    const { title = 'JF Alarm', body = 'Alarm für eure Gruppe!', data = {} } = req.body || {};
    if (tokens.size === 0) {
        return res.json({ ok: true, sent: 0, note: 'no tokens registered' });

        const messages = Array.from(tokens).map(token => ({
            token,
            sound: 'default',
            title,
            body,
            data,
        }));

        try {
            const chunks = chun(messages, 100);
            for (const chunk of chunks) {
                await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chunk),
                });
            }
            return res.json({ ok: true, sent: messages.length });
        } catch (error) {
            console.error('PUSH failed:', error);
            return res.status(500).json({ error: 'PUSH failed' });
        }
    }
});

app.get('/stats', (_, res) => res.json({tokens: tokens.size,}));    

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// --- START ---
app.listen(PORT, () => {
  console.log(`JF Push Server listening on http://localhost:${PORT}`);
});