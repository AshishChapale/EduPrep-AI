import { verifyToken } from "@clerk/backend";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import Quiz from "./models/Quiz.js";
import { calculateTopicPriorities } from "./utils/studyPlanner.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 30 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/pdf" &&
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed."));
    }
  }
});

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Clerk authentication middleware
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const token = authHeader.split(" ")[1];

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    req.userId = payload.sub;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token"
    });
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Check environment variables
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing from backend/.env");
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is missing from backend/.env");
  process.exit(1);
}

// Gemini configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.7
  }
});

// MongoDB connection
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });

    console.log("MongoDB Atlas connected successfully!");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

// Health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "EduPrep API is running",
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// Save completed quiz to MongoDB
// Save completed quiz for the authenticated user
app.post("/api/quizzes", requireAuth, async (req, res) => {
  try {
    const {
      stream,
      subject,
      topic,
      difficulty,
      score,
      totalQuestions
    } = req.body;

    // Validate input
    if (
      !subject ||
      !difficulty ||
      !Number.isInteger(score) ||
      !Number.isInteger(totalQuestions) ||
      totalQuestions <= 0 ||
      score < 0 ||
      score > totalQuestions
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz data."
      });
    }

    const quiz = await Quiz.create({
      userId: req.userId,

      stream: stream || "Computer Science / IT",
      subject,
      topic: topic || "General",
      difficulty,
      score,
      totalQuestions,
      percentage: Math.round((score / totalQuestions) * 100)
    });

    return res.status(201).json({
      success: true,
      message: "Quiz saved successfully!",
      quiz
    });

  } catch (error) {
    console.error("SAVE QUIZ ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save quiz."
    });
  }
});

// Get quiz attempts belonging to the authenticated user
app.get("/api/quizzes", requireAuth, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ userId: req.userId })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: quizzes.length,
      quizzes
    });

  } catch (error) {
    console.error("FETCH QUIZZES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch quiz history."
    });
  }
});

// Calculate topic priorities for the study planner
app.post("/api/planner/priorities", requireAuth, async (req, res) => {  try {
    const { topics } = req.body;

    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one topic."
      });
    }

    const validTopics = topics.filter(
      (item) =>
        item &&
        typeof item.subject === "string" &&
        item.subject.trim() &&
        typeof item.topic === "string" &&
        item.topic.trim()
    );

    if (validTopics.length !== topics.length) {
      return res.status(400).json({
        success: false,
        message: "Every topic must have a subject and topic name."
      });
    }

const quizzes = await Quiz.find({ userId: req.userId })
  .sort({ createdAt: 1 });
    const priorities = calculateTopicPriorities(
      validTopics,
      quizzes
    );

    return res.status(200).json({
      success: true,
      count: priorities.length,
      priorities
    });

  } catch (error) {
    console.error("PLANNER PRIORITY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to calculate topic priorities."
    });
  }
});




// Extract and parse JSON safely
function parseQuizResponse(text) {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");

  if (start === -1 || end === -1) {
    throw new Error("Gemini did not return a valid JSON array.");
  }

  return JSON.parse(cleaned.substring(start, end + 1));
}

function splitTextIntoChunks(text, chunkSize = 20000, overlap = 500) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    if (end < text.length) {
      // Try to split at a sentence or paragraph boundary
      const boundary = text.lastIndexOf("\n", end);

      if (boundary > start + chunkSize * 0.7) {
        end = boundary;
      }
    }

    chunks.push(text.substring(start, end).trim());

    start = end - overlap;

    if (start < 0) {
      start = 0;
    }
  }

  return chunks.filter(chunk => chunk.length > 0);
}

// Generate quiz
app.post("/api/generate", requireAuth, (req, res) => {
    upload.single("pdf")(req, res, async (uploadError) => {

    // Handle upload errors
    if (uploadError) {
      return res.status(400).json({
        success: false,
        message: uploadError.message || "PDF upload failed."
      });
    }

    try {
      const {
        notes,
        stream = "Computer Science / IT",
        subject = "General",
        topic = "General",
        difficulty = "Medium",
        count = 10
      } = req.body;

      let studyMaterial = "";

      // CASE 1: PDF uploaded
      if (req.file) {

        // Verify actual PDF signature
        const pdfSignature = req.file.buffer
          .subarray(0, 5)
          .toString();

        if (pdfSignature !== "%PDF-") {
          return res.status(400).json({
            success: false,
            message: "Invalid PDF file."
          });
        }

        console.log("Extracting text from uploaded PDF...");

        const pdfData = await pdfParse(req.file.buffer);

        studyMaterial = pdfData.text.trim();

        if (!studyMaterial) {
          return res.status(400).json({
            success: false,
            message: "No readable text found in this PDF. Please upload a text-based PDF."
          });
        }

        console.log("PDF text extracted successfully.");
      }

      // CASE 2: Manual notes
      else if (notes && typeof notes === "string") {
        studyMaterial = notes.trim();
      }

      // CASE 3: No input
      else {
        return res.status(400).json({
          success: false,
          message: "Please provide study notes or upload a PDF."
        });
      }

      // Limit extracted text / notes
      // Safety limit for extremely large documents
if (studyMaterial.length > 500000) {
  return res.status(400).json({
    success: false,
    message: "Document is too large to process. Please upload a smaller PDF."
  });
}

      const questionCount = Number(count);

      if (![5, 10, 15].includes(questionCount)) {
        return res.status(400).json({
          success: false,
          message: "Question count must be 5, 10 or 15."
        });
      }

      const allowedDifficulties = [
        "Easy",
        "Medium",
        "Hard",
        "Mixed"
      ];

      if (!allowedDifficulties.includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: "Invalid difficulty selected."
        });
      }

      console.log(`Generating ${questionCount} questions...`);
      console.log(`Subject: ${subject}, Topic: ${topic}`);
      console.log(`Input type: ${req.file ? "PDF" : "Notes"}`);

     let quizData = [];

if (req.file) {
  // PDF MODE: Split PDF into chunks
  const chunks = splitTextIntoChunks(studyMaterial);

  console.log(`PDF divided into ${chunks.length} chunks`);

  // Select up to 5 representative chunks across the document
  const selectedChunks = [];

  const chunkLimit = Math.min(5, chunks.length);

  for (let i = 0; i < chunkLimit; i++) {
    const index = Math.floor(
      i * (chunks.length - 1) / Math.max(1, chunkLimit - 1)
    );

    selectedChunks.push(chunks[index]);
  }

  // Distribute requested questions across selected chunks
  const questionsPerChunk = Math.floor(
    questionCount / selectedChunks.length
  );

  let remainingQuestions = questionCount;
  const generatedQuestions = [];

  for (let i = 0; i < selectedChunks.length; i++) {
    const questionsForChunk =
      i === selectedChunks.length - 1
        ? remainingQuestions
        : questionsPerChunk;

    remainingQuestions -= questionsForChunk;

    console.log(
      `Generating ${questionsForChunk} questions from PDF section ${i + 1}/${selectedChunks.length}`
    );

    const materialForChunk = selectedChunks[i];

    const prompt = `
You are an experienced engineering professor creating an exam practice quiz.

Create exactly ${questionsForChunk} multiple-choice questions using ONLY the study material provided below.

QUIZ DETAILS:
Stream: ${stream}
Subject: ${subject}
Topic: ${topic}
Difficulty: ${difficulty}

DIFFICULTY RULES:
- Easy: Test fundamental concepts and definitions.
- Medium: Test understanding and application.
- Hard: Test deeper reasoning and problem solving.
- Mixed: Include a balanced mixture of easy, medium and hard questions.

QUESTION RULES:
1. Every question must be relevant to the provided study material.
2. Each question must have exactly four options.
3. Options must be meaningful and distinct.
4. Only one option must be correct.
5. Avoid duplicate questions.
6. Do not invent facts that contradict the study material.
7. The correct answer must be represented by its letter: A, B, C or D.
8. Provide a short explanation for every correct answer.

OUTPUT:
Return ONLY a valid JSON array.
Do not include Markdown or any text outside the JSON.

Use this exact structure:

[
  {
    "question": "Question text",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "answer": "A",
    "explanation": "Explanation of why option A is correct."
  }
]

STUDY MATERIAL:
${materialForChunk}
`;

    const result = await model.generateContent(prompt);

    const responseText = result.response.text();

    const chunkQuestions = parseQuizResponse(responseText);

    if (!Array.isArray(chunkQuestions)) {
      throw new Error("Gemini returned invalid questions for a PDF section.");
    }

    generatedQuestions.push(...chunkQuestions);
  }

  quizData = generatedQuestions;

} else {
  // NOTES MODE: Existing single-request generation

  const questionsForChunk = questionCount;
  const materialForChunk = studyMaterial;

  const prompt = `
You are an experienced engineering professor creating an exam practice quiz.

Create exactly ${questionsForChunk} multiple-choice questions using the study material provided below.

QUIZ DETAILS:
Stream: ${stream}
Subject: ${subject}
Topic: ${topic}
Difficulty: ${difficulty}

DIFFICULTY RULES:
- Easy: Test fundamental concepts and definitions.
- Medium: Test understanding and application.
- Hard: Test deeper reasoning and problem solving.
- Mixed: Include a balanced mixture of easy, medium and hard questions.

QUESTION RULES:
1. Every question must be relevant to the provided study material.
2. Each question must have exactly four options.
3. Options must be meaningful and distinct.
4. Only one option must be correct.
5. Avoid duplicate questions.
6. Do not invent facts that contradict the study material.
7. The correct answer must be represented by its letter: A, B, C or D.
8. Provide a short explanation for every correct answer.

OUTPUT:
Return ONLY a valid JSON array.
Do not include Markdown or any text outside the JSON.

Use this exact structure:

[
  {
    "question": "Question text",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "answer": "A",
    "explanation": "Explanation of why option A is correct."
  }
]

STUDY MATERIAL:
${materialForChunk}
`;

  const result = await model.generateContent(prompt);

  const responseText = result.response.text();

  quizData = parseQuizResponse(responseText);
}

      if (
        !Array.isArray(quizData) ||
        quizData.length !== questionCount
      ) {
        throw new Error(
          `Expected ${questionCount} questions, but received ${quizData?.length || 0}. Please try again.`
        );
      }

      const validQuestions = quizData.map((question, index) => {
        const answer = String(question.answer || "")
          .trim()
          .toUpperCase();

        if (
          !question.question ||
          !Array.isArray(question.options) ||
          question.options.length !== 4 ||
          !["A", "B", "C", "D"].includes(answer)
        ) {
          throw new Error(
            `Invalid question format at question ${index + 1}.`
          );
        }

        return {
          question: String(question.question),
          options: question.options.map(option => String(option)),
          answer,
          explanation: String(
            question.explanation ||
            "Review the study material for this concept."
          )
        };
      });

      console.log("Quiz generated successfully.");

      return res.status(200).json(validQuestions);

    } catch (error) {
      console.error("QUIZ GENERATION ERROR:", error);

      return res.status(500).json({
        success: false,
        message: error.message ||
          "Unable to generate quiz. Please try again."
      });
    }
  });
});

// Start server only after MongoDB connects
async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`EduPrep backend running at http://localhost:${PORT}`);
  });
}

startServer();
