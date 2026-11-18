import mongoose from "mongoose";

const quizSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },

  stream: {
    type: String,
    required: true
  },

  subject: {
    type: String,
    required: true
  },

  topic: {
    type: String,
    default: "General"
  },

  difficulty: {
    type: String,
    required: true
  },

  score: {
    type: Number,
    required: true
  },

  totalQuestions: {
    type: Number,
    required: true
  },

  percentage: {
    type: Number,
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Quiz = mongoose.model("Quiz", quizSchema);

export default Quiz;