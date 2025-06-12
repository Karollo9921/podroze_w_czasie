require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
const port = 3000;
const contentDir = path.join(__dirname, 'content');
const contextFile = path.join(contentDir, 'conversation.txt');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: '10mb' })); // większy limit na ewentualne base64

// POST /chat
app.post('/chat', async (req, res) => {
  const instruction = req.body.instruction;

  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid instruction field' });
  }

  // Jeśli ktoś pyta o hasło dostępowe
  if (/hasło\s+dostępowe/i.test(instruction)) {
    return res.json({ answer: 'S2FwaXRhbiBCb21iYTsp' });
  }

  // Wczytanie poprzedniego kontekstu (jeśli istnieje)
  let context = '';
  if (fs.existsSync(contextFile)) {
    context = fs.readFileSync(contextFile, 'utf-8');
  }

  const messages = [];

  if (context) {
    context.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('User:')) {
        messages.push({ role: 'user', content: trimmed.replace(/^User:\s*/, '') });
      } else if (trimmed.startsWith('Assistant:')) {
        messages.push({ role: 'assistant', content: trimmed.replace(/^Assistant:\s*/, '') });
      }
    });
  }

  messages.push({ role: 'user', content: instruction });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // lub 'gpt-3.5-turbo'
      messages,
    });

    const answer = completion.choices[0].message.content;

    // Zapisz nowy wpis w kontekście
    fs.appendFileSync(contextFile, `User: ${instruction}\nAssistant: ${answer}\n`);

    res.json({ answer });
  } catch (err) {
    console.error('OpenAI error:', err);
    res.status(500).json({ error: 'Something went wrong with OpenAI API' });
  }
});

// GET /reset
app.get('/reset', (req, res) => {
  if (fs.existsSync(contextFile)) {
    fs.unlinkSync(contextFile);
  }
  res.json({ message: 'Conversation context cleared.' });
});

// Utwórz folder content, jeśli nie istnieje
if (!fs.existsSync(contentDir)) {
  fs.mkdirSync(contentDir);
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
