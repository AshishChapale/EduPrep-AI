import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/generate', async (req, res) => {
  let responseText = "";

  try {
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({
        error: "Please provide notes to generate the quiz."
      });
    }

    console.log("Received notes...");
    console.log("Calling Gemini...");

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    const prompt = `
Act as an expert engineering professor.

Generate EXACTLY 10 multiple-choice questions.

Return ONLY a JSON array.

Format:

[
  {
    "question":"...",
    "options":["A","B","C","D"],
    "answer":"..."
  }
]

Notes:

${notes}
`;

    const result = await model.generateContent(prompt);

    responseText = result.response.text();

    console.log("Gemini Raw Response:");
    console.log(responseText);

    const cleanedText = responseText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const quizData = JSON.parse(cleanedText);

    console.log("Quiz generated successfully.");

    return res.json(quizData);

  } catch (error) {

    console.error("========== AI ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
      rawResponse: responseText || "No response received from Gemini"
    });

  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});