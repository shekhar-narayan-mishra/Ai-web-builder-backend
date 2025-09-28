require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function run() {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {role:"system",content:"Reply with 'hello'"},
        {role:"user",content:"Test prompt"}
      ],
      model: "llama-3.1-8b-instant",
      max_tokens: 10,
      temperature: 0,
    });
    console.log(completion.choices[0].message.content);
  } catch (e) {
    console.error("Test error:", e);
  }
}
run();
