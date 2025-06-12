import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

const contentDir = path.join(__dirname, 'content');
const contextFile = path.join(contentDir, 'conversation.txt');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: '10mb' }));

app.post('/chat', async (req, res) => {
  const instruction = req.body.question;

  console.log('🟡 Nowa instrukcja:', instruction);


  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid instruction field' });
  }

  if (/hasło\s+dostępowe/i.test(instruction)) {
    return res.json({ answer: 'S2FwaXRhbiBCb21iYTsp' });
  }

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
      model: 'gpt-4o',
      messages,
    });

    const answer = completion.choices[0].message.content;

    fs.appendFileSync(contextFile, `User: ${instruction}\nAssistant: ${answer}\n`);

    console.log('🟢 Odpowiedź GPT:', answer);

    res.json({ answer });
  } catch (err) {
    console.error('OpenAI error:', err);
    res.status(500).json({ error: 'Something went wrong with OpenAI API' });
  }
});

app.get('/reset', (req, res) => {
  if (fs.existsSync(contextFile)) {
    fs.unlinkSync(contextFile);
  }
  res.json({ message: 'Conversation context cleared.' });
});

if (!fs.existsSync(contentDir)) {
  fs.mkdirSync(contentDir);
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
