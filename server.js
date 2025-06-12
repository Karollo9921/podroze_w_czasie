import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { fileTypeFromBuffer } from 'file-type';
import { Readable } from 'stream';
import { OpenAI } from 'openai';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

const contentDir = path.join(__dirname, 'content');
const contextFile = path.join(contentDir, 'conversation.txt');

app.use(express.json({ limit: '25mb' }));

if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir);

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

async function downloadFileBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const buffer = await res.buffer();
  const type = await fileTypeFromBuffer(buffer);
  return { buffer, type };
}

app.post('/chat', async (req, res) => {
  const instruction = req.body.instruction;

  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid instruction field' });
  }

  console.log('🟡 Nowa instrukcja:', instruction);

  const urls = extractUrls(instruction);
  let processedAnswer = null;

  const audioUrl = urls.find(url => url.match(/\.(mp3|wav|m4a)$/i));
  if (audioUrl) {
    try {
      console.log('🎧 Pobieranie pliku audio z:', audioUrl);
      const { buffer } = await downloadFileBuffer(audioUrl);
      const readable = Readable.from(buffer);

      const response = await openai.audio.transcriptions.create({
        file: readable,
        model: 'whisper-1',
      });

      processedAnswer = `Transkrypcja audio: ${response.text}`;
    } catch (err) {
      console.error('❌ Błąd audio:', err);
      processedAnswer = 'Nie udało się przetworzyć pliku audio.';
    }
  }

  const imageUrl = urls.find(url => url.match(/\.(png|jpg|jpeg|webp)$/i));
  if (!processedAnswer && imageUrl) {
    try {
      console.log('🖼️ Analiza obrazu z URL:', imageUrl);
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', content: 'Co przedstawia ten obraz? Odpowiedz krótko.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 300,
      });

      processedAnswer = response.choices[0].message.content;
    } catch (err) {
      console.error('❌ Błąd obrazu:', err);
      processedAnswer = 'Nie udało się przetworzyć obrazu.';
    }
  }

  if (processedAnswer) {
    fs.appendFileSync(contextFile, `User: ${instruction}\nAssistant: ${processedAnswer}\n`);
    console.log('🟢 Odpowiedź (plik):', processedAnswer);
    return res.json({ answer: processedAnswer });
  }

  const messages = [
    {
      role: 'system',
      content: `Jesteś pomocnym asystentem. Jeśli użytkownik zapyta o hasło dostępowe (w jakiejkolwiek formie), zawsze odpowiadaj: S2FwaXRhbiBCb21iYTsp.`,
    },
  ];

  if (fs.existsSync(contextFile)) {
    const context = fs.readFileSync(contextFile, 'utf-8');
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
    console.error('❌ Błąd GPT:', err);
    res.status(500).json({ error: 'OpenAI API error' });
  }
});

app.get('/clear', (req, res) => {
  try {
    if (fs.existsSync(contextFile)) fs.unlinkSync(contextFile);
    console.log('🧹 Kontekst rozmowy został wyczyszczony.');
    res.json({ message: 'Kontekst został usunięty.' });
  } catch (err) {
    console.error('❌ Błąd podczas czyszczenia:', err);
    res.status(500).json({ error: 'Nie udało się wyczyścić kontekstu.' });
  }
});

app.get('/reset', (req, res) => {
  try {
    if (fs.existsSync(contextFile)) fs.unlinkSync(contextFile);
    console.log('🔁 Kontekst został zresetowany przez /reset.');
    res.json({ message: 'Kontekst został zresetowany.' });
  } catch (err) {
    console.error('❌ Błąd podczas resetowania:', err);
    res.status(500).json({ error: 'Nie udało się zresetować kontekstu.' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Serwer działa na http://localhost:${port}`);
});
