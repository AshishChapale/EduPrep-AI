
const normalize = (value) =>
  String(value || '').trim().toLowerCase();

const difficultyWeights = {
  Easy: 1,
  Medium: 1.15,
  Hard: 1.3,
  Mixed: 1.1
};

export function calculateTopicPriorities(topics, quizzes) {
  const topicMap = new Map();

  // 1. Aggregate quiz performance by subject and topic
  quizzes.forEach((quiz) => {
    const key = `${normalize(quiz.subject)}|${normalize(quiz.topic)}`;

    if (!topicMap.has(key)) {
      topicMap.set(key, {
        correct: 0,
        total: 0,
        attempts: 0,
        difficulties: [],
        latestAttempt: null
      });
    }

    const record = topicMap.get(key);

    record.correct += quiz.score;
    record.total += quiz.totalQuestions;
    record.attempts += 1;
    record.difficulties.push(quiz.difficulty);

    const attemptDate = new Date(quiz.createdAt);

    if (
      !record.latestAttempt ||
      attemptDate > record.latestAttempt
    ) {
      record.latestAttempt = attemptDate;
    }
  });

  // 2. Calculate priority for every syllabus topic
  return topics.map(({ subject, topic }) => {
    const key = `${normalize(subject)}|${normalize(topic)}`;
    const record = topicMap.get(key);

    // Unattempted topics are new, not weak
    if (!record || record.total === 0) {
      return {
        subject,
        topic,
        accuracy: null,
        attempts: 0,
        difficulty: 'Not assessed',
        priorityScore: 65,
        priority: 'New',
        status: 'Not Assessed'
      };
    }

    const accuracy = Math.round(
      (record.correct / record.total) * 100
    );

    // Use the latest quiz difficulty
    const difficulty = record.difficulties[
      record.difficulties.length - 1
    ];

    const weight = difficultyWeights[difficulty] || 1.15;

    // Lower accuracy and higher difficulty increase priority
    const priorityScore = Math.round(
      (100 - accuracy) * weight
    );

    let priority;

    if (priorityScore >= 75) {
      priority = 'Very High';
    } else if (priorityScore >= 50) {
      priority = 'High';
    } else if (priorityScore >= 25) {
      priority = 'Medium';
    } else {
      priority = 'Low';
    }

    return {
      subject,
      topic,
      accuracy,
      attempts: record.attempts,
      difficulty,
      priorityScore,
      priority,
      status: 'Assessed',
      latestAttempt: record.latestAttempt
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}
