import express from "express";
import bodyParser from "body-parser";
import OpenAI from 'openai';
import { prompt } from "./prompt.js";
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});


app.post("/get-description", async (req, res) => {
  const instruction = req.body.instruction;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: 'user', content: prompt },
      {
        role: 'user',
        content: instruction,
      },
    ],
    stream: false,
    response_format: { type: 'text' },
  });

  return res.json({ description: response['choices'][0].message.content });
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
