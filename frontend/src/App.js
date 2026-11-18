import { useUser, useAuth, UserButton } from '@clerk/react'; import AuthScreen from './AuthScreen';
import React, { useState, useEffect } from 'react';
import './App.css';

function EduPrepApp() {
    const { getToken } = useAuth();
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState('dashboard');

    // CORE STATS

    // QUIZ HISTORY AND DATABASE-BACKED STATS
    const [quizHistory, setQuizHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState('');

    const stats = {
        quizzesTaken: quizHistory.length,

        totalQuestions: quizHistory.reduce(
            (sum, quiz) => sum + quiz.totalQuestions, 0
        ),

        totalCorrect: quizHistory.reduce(
            (sum, quiz) => sum + quiz.score, 0
        ),

        avgScore: 0,
        streak: 0
    };

    stats.avgScore = stats.totalQuestions > 0
        ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
        : 0;

    const topicStats = {};

    quizHistory.forEach((quiz) => {
        const topicKey = `${quiz.subject}:${quiz.topic || 'General'}`;

        if (!topicStats[topicKey]) {
            topicStats[topicKey] = { correct: 0, total: 0 };
        }

        topicStats[topicKey].correct += quiz.score;
        topicStats[topicKey].total += quiz.totalQuestions;
    });


    // QUIZ STATE
    const [quizPhase, setQuizPhase] = useState('setup');
    const [notes, setNotes] = useState('');
    const [pdfFile, setPdfFile] = useState(null);
    const [inputMode, setInputMode] = useState('notes');
    const [stream, setStream] = useState('Computer Science / IT');
    const [subject, setSubject] = useState('Data Structures & Algorithms');
    const [topic, setTopic] = useState('');
    const [difficulty, setDifficulty] = useState('Medium');
    const [qCount, setQCount] = useState(10);

    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedOpt, setSelectedOpt] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);

    // STUDY PLANNER STATE
    const [plannerMode, setPlannerMode] = useState('weekly');
    const [dailyStudyHours, setDailyStudyHours] = useState(2);
    const [studyDays, setStudyDays] = useState([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday'
    ]);
    const [examDate, setExamDate] = useState('');
    const [subjectTopics, setSubjectTopics] = useState([
        { subject: '', topics: '' }
    ]);
    const [studyPlan, setStudyPlan] = useState(null);
    const [plannerLoading, setPlannerLoading] = useState(false);
    // Track completed study tasks
    const [completedTasks, setCompletedTasks] = useState(() => {
        try {
            return JSON.parse(
                localStorage.getItem('eduprep_completed_tasks') || '{}'
            );
        } catch {
            return {};
        }
    });


    // Calculate study hours for each topic
    const topicAllocations = studyPlan
        ? (() => {
            const totalHours = studyPlan.dailyStudyHours *
                studyPlan.studyDays.length;

            const weights = {
                'Very High': 4,
                'High': 3,
                'Medium': 2,
                'New': 1.5,
                'Low': 1
            };

            const totalWeight = studyPlan.priorities.reduce(
                (sum, item) => sum + (weights[item.priority] || 1),
                0
            );

            return studyPlan.priorities.map(item => ({
                ...item,
                allocatedHours: Number(
                    (
                        totalHours *
                        (weights[item.priority] || 1) /
                        totalWeight
                    ).toFixed(1)
                )
            }));
        })()
        : [];

    // Generate a day-wise study timetable


    const weeklySchedule = studyPlan
        ? (() => {
            const days = studyPlan.studyDays;
            const topics = [...topicAllocations];

            if (!days.length || !topics.length) return [];

            const totalSessions =
                days.length * studyPlan.dailyStudyHours * 2;

            const weights = {
                'Very High': 4,
                'High': 3,
                'Medium': 2,
                'New': 1.5,
                'Low': 1
            };

            const totalWeight = topics.reduce(
                (sum, topic) => sum + (weights[topic.priority] || 1),
                0
            );

            const allocations = topics.map(topic => {
                const exactSessions =
                    totalSessions *
                    (weights[topic.priority] || 1) /
                    totalWeight;

                return {
                    ...topic,
                    sessions: Math.floor(exactSessions),
                    remainder: exactSessions - Math.floor(exactSessions)
                };
            });

            let leftover = totalSessions -
                allocations.reduce((sum, topic) => sum + topic.sessions, 0);

            [...allocations]
                .sort((a, b) => b.remainder - a.remainder)
                .forEach(topic => {
                    if (leftover > 0) {
                        topic.sessions++;
                        leftover--;
                    }
                });

            const schedule = days.map(day => ({
                day,
                tasks: []
            }));

            let topicIndex = 0;

            schedule.forEach(dayPlan => {
                const dailySessions = studyPlan.dailyStudyHours * 2;

                for (let i = 0; i < dailySessions; i++) {
                    let attempts = 0;

                    while (
                        allocations[topicIndex].sessions === 0 &&
                        attempts < allocations.length
                    ) {
                        topicIndex = (topicIndex + 1) % allocations.length;
                        attempts++;
                    }

                    const topic = allocations[topicIndex];

                    dayPlan.tasks.push({
                        subject: topic.subject,
                        topic: topic.topic,
                        duration: 30
                    });

                    topic.sessions--;
                    topicIndex = (topicIndex + 1) % allocations.length;
                }
            });

            return schedule;
        })()

        : [];


    // Calculate study completion progress
    const totalTasks = weeklySchedule.reduce(
        (sum, day) => sum + day.tasks.length,
        0
    );

    const completedCount = weeklySchedule.reduce(
        (sum, day) =>
            sum + day.tasks.filter((task, index) =>
                completedTasks[`${day.day}-${index}`]
            ).length,
        0
    );

    const completionPercentage = totalTasks > 0
        ? Math.round((completedCount / totalTasks) * 100)
        : 0;

    // Fetch quiz history from MongoDB





    // Fetch quiz history from MongoDB
    const fetchQuizHistory = async () => {
        try {
            setHistoryError('');

            const token = await getToken();

            const response = await fetch(
                'http://localhost:5000/api/quizzes',
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch quiz history.');
            }

            setQuizHistory(data.quizzes || []);

            console.log('Quiz history loaded:', data.quizzes);

        } catch (error) {
            console.error('Quiz history error:', error);
            setHistoryError(error.message);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Load data when application starts
    useEffect(() => {
        fetchQuizHistory();
    }, []);

    // Save completed tasks in browser storage
    useEffect(() => {
        localStorage.setItem(
            'eduprep_completed_tasks',
            JSON.stringify(completedTasks)
        );
    }, [completedTasks]);


    // 2. SAVE DATA AFTER QUIZ


    const finishQuiz = async () => {
        try {
            const token = await getToken();

            const response = await fetch(
                'http://localhost:5000/api/quizzes',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        stream,
                        subject,
                        topic: topic.trim() || 'General',
                        difficulty,
                        score,
                        totalQuestions: questions.length
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Unable to save quiz.');
            }

            console.log('Quiz saved to MongoDB:', data.quiz);

            // Refresh dashboard from MongoDB
            await fetchQuizHistory();

        } catch (error) {
            console.error('MongoDB save error:', error);
            alert('Quiz completed, but saving to database failed.');
        } finally {
            setQuizPhase('result');
        }
    };



    const handleGenerate = async () => {
        if (inputMode === 'notes' && !notes.trim()) {
            alert('Please enter your study notes.');
            return;
        }

        if (inputMode === 'pdf' && !pdfFile) {
            alert('Please select a PDF file.');
            return;
        }

        setLoading(true);

        try {
            let response;
            const token = await getToken();

            if (inputMode === 'pdf') {
                const formData = new FormData();

                formData.append('pdf', pdfFile);
                formData.append('stream', stream);
                formData.append('subject', subject);
                formData.append('topic', topic);
                formData.append('difficulty', difficulty);
                formData.append('count', qCount);

                response = await fetch('http://localhost:5000/api/generate', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: formData
                });
            } else {
                response = await fetch('http://localhost:5000/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        notes,
                        stream,
                        subject,
                        topic,
                        difficulty,
                        count: qCount
                    })
                });
            }

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || 'Failed to generate quiz.');
                return;
            }

            console.log("FIRST QUESTION:", data[0]);

            setQuestions(data);
            setQuizPhase('active');
            setCurrentQ(0);
            setScore(0);
            setIsAnswered(false);
            setSelectedOpt(null);

        } catch (error) {
            console.error(error);
            alert(error.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (optIndex, optionText) => {
        if (isAnswered) return;
        setSelectedOpt(optIndex);
        setIsAnswered(true);
        const correctAnswer = String(questions[currentQ].answer || questions[currentQ].correctAnswer || "").toLowerCase().trim();
        if (["A", "B", "C", "D"][optIndex] === correctAnswer.toUpperCase()) {
            setScore(score + 1);
        }
    };

    const handleNext = () => {
        if (currentQ < questions.length - 1) {
            setCurrentQ(currentQ + 1);
            setIsAnswered(false);
            setSelectedOpt(null);
        } else {
            finishQuiz();
        }
    };

    // --- ANALYTICS ENGINE CALCS ---
    const topicEntries = Object.entries(topicStats);
    let strongTopics = [], avgTopics = [], weakTopics = [];
    const subjectAgg = {};

    topicEntries.forEach(([key, data]) => {
        const pct = Math.round((data.correct / data.total) * 100);
        const [sub, top] = key.split(':');

        // Categorize
        if (pct >= 75) strongTopics.push({ name: top, pct });
        else if (pct >= 50) avgTopics.push({ name: top, pct });
        else weakTopics.push({ name: top, pct });

        // Aggregate by Subject for the Progress Bars
        if (!subjectAgg[sub]) subjectAgg[sub] = { correct: 0, total: 0 };
        subjectAgg[sub].correct += data.correct;
        subjectAgg[sub].total += data.total;
    });

    // Math for the SVG Donut Chart
    const totalT = topicEntries.length || 1;
    const circ = 2 * Math.PI * 46; // approx 289
    const sDash = (strongTopics.length / totalT) * circ;
    const aDash = (avgTopics.length / totalT) * circ;
    const wDash = (weakTopics.length / totalT) * circ;

    return (
        <div className="app-container">
            {/* SIDEBAR */}
            <aside className="sidebar">
                <div className="logo">
                    <div className="logo-text">Edu<span>Prep</span></div>
                    <div className="logo-sub">Engineering Platform</div>
                </div>
                <nav className="nav">
                    <div className="nav-label">Main</div>
                    <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
                    <button
                        className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        📚 Quiz History
                    </button>
                    <button className={`nav-item ${activeTab === 'quiz' ? 'active' : ''}`} onClick={() => { setActiveTab('quiz'); setQuizPhase('setup'); }}>⚡ Practice Quiz</button>
                    <button className={`nav-item ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>📅 Study Plan</button>
                    <button className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>📈 Analytics</button>
                </nav>
                <div className="sidebar-footer">

                    {/* USER PROFILE */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '20px',
                        padding: '10px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '10px'
                    }}>
                        <UserButton />

                        <div>
                            <div style={{
                                color: 'white',
                                fontSize: '13px',
                                fontWeight: '600'
                            }}>
                                {user?.fullName || user?.firstName || 'User'}
                            </div>

                            <div style={{
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: '11px'
                            }}>
                            </div>
                        </div>
                    </div>

                    {/* EXISTING STREAMS */}
                    <div style={{
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.28)',
                        marginBottom: '7px',
                        textTransform: 'uppercase',
                        letterSpacing: '.07em'
                    }}>
                        Streams
                    </div>

                    <span className="badge badge-cs">CS / IT</span>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="main">
                <div className="topbar">
                    <div className="topbar-left">
                        <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
                        <p>Welcome! Let's optimize your engineering studies.</p>
                    </div>
                    <div className="streak-pill">🔥 {stats.streak}-day streak</div>
                </div>

                {/* --- VIEW: DASHBOARD --- */}
                {activeTab === 'dashboard' && (
                    <div className="page">
                        <div className="stats-grid">
                            <div className="stat-card accent">
                                <div className="s-label">Overall Readiness</div>
                                <div className="s-value">{stats.avgScore || 0}%</div>
                                <div className="s-hint">Cumulative Accuracy</div>
                            </div>
                            <div className="stat-card">
                                <div className="s-label">Quizzes Taken</div>
                                <div className="s-value" style={{ color: 'var(--text)' }}>{stats.quizzesTaken}</div>
                                <div className="s-hint">Session Total</div>
                            </div>
                            <div className="stat-card">
                                <div className="s-label">Topics Attempted</div>
                                <div className="s-value" style={{ color: 'var(--text)' }}>{topicEntries.length}</div>
                                <div className="s-hint">Unique areas tested</div>
                            </div>
                            <div className="stat-card">
                                <div className="s-label">Total Questions</div>
                                <div className="s-value" style={{ color: 'var(--text)' }}>{stats.totalQuestions}</div>
                                <div className="s-hint">Solved on platform</div>
                            </div>
                        </div>

                        <div className="section-title">Quick Actions</div>
                        <div className="card" style={{ display: 'flex', gap: '20px' }}>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Generate AI Practice Exam</h3>
                                <p style={{ color: '#64748B', fontSize: '14px', lineHeight: '1.6' }}>Convert your raw syllabus, PDFs, and notes into personalized multiple-choice questions instantly.</p>
                                <button className="btn btn-primary" style={{ marginTop: '15px' }} onClick={() => { setActiveTab('quiz'); setQuizPhase('setup'); }}>⚡ Start Practice →</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- VIEW: QUIZ --- */}
                {activeTab === 'quiz' && (
                    <div className="page">
                        {quizPhase === 'setup' && (
                            <div style={{ maxWidth: '720px' }}>
                                <div className="card">
                                    <div className="section-title" style={{ marginTop: 0 }}>Quiz Configuration</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '5px' }}>STREAM</label>
                                            <select className="form-input" style={{ marginBottom: 0 }} value={stream} onChange={(e) => setStream(e.target.value)}>
                                                <option>Computer Science / IT</option>
                                                <option>Electronics & Electrical</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '5px' }}>SUBJECT</label>
                                            <select className="form-input" style={{ marginBottom: 0 }} value={subject} onChange={(e) => setSubject(e.target.value)}>
                                                <option>Data Structures & Algorithms</option>
                                                <option>Operating Systems</option>
                                                <option>Computer Networks</option>
                                                <option>DBMS</option>
                                                <option>Microprocessors</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '5px' }}>TOPIC (Optional)</label>
                                            <input className="form-input" style={{ marginBottom: 0 }} placeholder="e.g. Binary Trees, 80386..." value={topic} onChange={(e) => setTopic(e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '5px' }}>DIFFICULTY</label>
                                            <select className="form-input" style={{ marginBottom: 0 }} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                                                <option>Easy</option><option>Medium</option><option>Hard</option><option>Mixed</option>
                                            </select>
                                        </div>
                                    </div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '5px' }}>SYLLABUS CONTEXT</label>
                                    <div style={{ marginBottom: "15px" }}>
                                        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                                            <button
                                                type="button"
                                                onClick={() => setInputMode("notes")}
                                                className="form-input"
                                                style={{ cursor: "pointer" }}
                                            >
                                                Paste Notes
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setInputMode("pdf")}
                                                className="form-input"
                                                style={{ cursor: "pointer" }}
                                            >
                                                Upload PDF
                                            </button>
                                        </div>

                                        {inputMode === "notes" ? (
                                            <textarea
                                                className="form-input"
                                                rows="5"
                                                placeholder="Paste your lecture slides, notes, or textbook paragraphs here..."
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                            />
                                        ) : (
                                            <div>
                                                <input
                                                    type="file"
                                                    accept=".pdf,application/pdf"
                                                    onChange={(e) => setPdfFile(e.target.files[0] || null)}
                                                />

                                                {pdfFile && (
                                                    <p style={{ marginTop: "10px" }}>
                                                        Selected file: {pdfFile.name}
                                                    </p>
                                                )}

                                                <p style={{ fontSize: "13px", color: "#888" }}>
                                                    Upload a PDF file (maximum 30 MB).
                                                </p>
                                            </div>
                                        )}
                                    </div>                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                        <select className="form-input" style={{ width: '100px', marginBottom: 0 }} value={qCount} onChange={(e) => setQCount(e.target.value)}>
                                            <option value="5">5 Qs</option><option value="10">10 Qs</option><option value="15">15 Qs</option>
                                        </select>
                                        <button className="btn btn-primary" onClick={handleGenerate} disabled={loading || (inputMode === "notes" ? !notes.trim() : !pdfFile)} style={{ flex: 1 }}>
                                            {loading ? '⚙️ Processing Context & Generating...' : '📝 Generate Practice Exam'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {quizPhase === 'active' && questions.length > 0 && (
                            <div style={{ maxWidth: '700px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                    <span style={{ fontWeight: '600', color: '#1B4FD8', fontSize: '14px' }}>{subject} {topic && `- ${topic}`}</span>
                                    <span style={{ fontWeight: '600', color: '#64748B', fontSize: '14px' }}>Question {currentQ + 1} of {questions.length}</span>
                                </div>
                                <div className="question-card">
                                    <div className="q-text">{questions[currentQ].question}</div>
                                    <div className="q-options">
                                        {questions[currentQ].options.map((opt, i) => {
                                            let btnClass = "q-opt";
                                            const correctAnswer = String(
                                                questions[currentQ].answer || questions[currentQ].correctAnswer || ""
                                            ).trim();
                                            const optionLetter = ["A", "B", "C", "D"][i];

                                            if (isAnswered) {
                                                const isCorrectOpt = ["A", "B", "C", "D"][i] === correctAnswer.toUpperCase(); if (isCorrectOpt) btnClass += " correct";
                                                else if (selectedOpt === i) btnClass += " wrong";
                                            }
                                            return (
                                                <div key={i} className={btnClass} onClick={() => handleAnswer(i, opt)}>
                                                    <div className="opt-letter">{['A', 'B', 'C', 'D'][i]}</div>
                                                    <span>{String(opt).replace(/^[A-D][.)]\s*/, '')}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                {isAnswered && (
                                    <div className="card" style={{ background: '#f8fafc', borderColor: '#e2e8f0', marginTop: '15px' }}>
                                        <strong style={{ color: '#334155' }}>System Explanation:</strong>
                                        <p style={{ fontSize: '14px', marginTop: '8px', color: '#475569' }}>The correct answer is <strong>{questions[currentQ].answer || questions[currentQ].correctAnswer}</strong>.</p>
                                        <button className="btn btn-primary" style={{ marginTop: '15px' }} onClick={handleNext}>
                                            {currentQ < questions.length - 1 ? 'Next Question →' : 'Finish Quiz'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {quizPhase === 'result' && (
                            <div style={{ maxWidth: '760px' }}>
                                <div className="result-hero">
                                    <div>
                                        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '24px', fontWeight: '800' }}>Quiz Complete!</h2>
                                        <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '5px' }}>Your progress has been saved to your analytics dashboard.</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="result-big">{Math.round((score / questions.length) * 100)}%</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="btn btn-primary" onClick={() => { setQuizPhase('setup'); setNotes(''); }}>+ New Quiz</button>
                                    <button className="btn" style={{ background: '#fff', border: '1px solid #E2E8F8' }} onClick={() => setActiveTab('analytics')}>View Analytics</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* --- VIEW: QUIZ HISTORY --- */}
                {activeTab === 'history' && (
                    <div className="page">
                        <div className="section-title">Your Quiz History</div>

                        {historyLoading ? (
                            <div className="card">Loading quiz history...</div>
                        ) : historyError ? (
                            <div className="card">
                                Unable to load quiz history: {historyError}
                            </div>
                        ) : quizHistory.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📚</div>
                                <div className="empty-title">No quizzes yet</div>
                                <div className="empty-desc">
                                    Complete your first practice quiz to see your history here.
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setActiveTab('quiz');
                                        setQuizPhase('setup');
                                    }}
                                >
                                    Start Practice →
                                </button>
                            </div>
                        ) : (
                            <div className="card">
                                <div className="card-title">
                                    Completed Quizzes ({quizHistory.length})
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table className="topic-table">
                                        <thead>
                                            <tr>
                                                <th>Subject / Topic</th>
                                                <th>Difficulty</th>
                                                <th>Score</th>
                                                <th>Accuracy</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {[...quizHistory]
                                                .sort(
                                                    (a, b) =>
                                                        new Date(b.createdAt) - new Date(a.createdAt)
                                                )
                                                .map((quiz) => {
                                                    const percentage = quiz.totalQuestions > 0
                                                        ? Math.round(
                                                            (quiz.score / quiz.totalQuestions) * 100
                                                        )
                                                        : 0;

                                                    return (
                                                        <tr key={quiz._id}>
                                                            <td>
                                                                <strong>{quiz.subject}</strong>
                                                                <div style={{
                                                                    fontSize: '12px',
                                                                    color: '#64748B',
                                                                    marginTop: '4px'
                                                                }}>
                                                                    {quiz.topic || 'General'}
                                                                </div>
                                                            </td>

                                                            <td>{quiz.difficulty}</td>

                                                            <td>
                                                                {quiz.score}/{quiz.totalQuestions}
                                                            </td>

                                                            <td>
                                                                <strong>{percentage}%</strong>
                                                            </td>

                                                            <td>
                                                                {quiz.createdAt
                                                                    ? new Date(quiz.createdAt).toLocaleDateString()
                                                                    : 'N/A'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* --- VIEW: ANALYTICS (FULL ENGAI DESIGN) --- */}
                {activeTab === 'analytics' && (
                    <div className="page">
                        {stats.quizzesTaken === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📊</div>
                                <div className="empty-title">No analytics data yet</div>
                                <div className="empty-desc">Complete at least one practice quiz to generate your performance breakdown.</div>
                                <button className="btn btn-primary" style={{ marginTop: '15px' }} onClick={() => { setActiveTab('quiz'); setQuizPhase('setup'); }}>⚡ Start Practice →</button>
                            </div>
                        ) : (
                            <div>
                                <div className="analytics-hero">
                                    <div>
                                        <h2>Performance Analytics</h2>
                                        <p>AI-powered weak vs strong topic breakdown</p>
                                        <div className="hero-chips">
                                            <span className="hero-chip">{stats.quizzesTaken} Quizzes</span>
                                            <span className="hero-chip">{topicEntries.length} Topics</span>
                                        </div>
                                    </div>
                                    <div className="hero-score">
                                        <div className="big">{stats.avgScore}%</div>
                                        <div className="sub">Overall Readiness</div>
                                    </div>
                                </div>

                                <div className="mini-grid">
                                    <div className="mini-stat">
                                        <div className="ms-label">Strong Topics</div>
                                        <div className="ms-val" style={{ color: 'var(--green)' }}>{strongTopics.length}</div>
                                        <div className="ms-sub">≥75% accuracy</div>
                                    </div>
                                    <div className="mini-stat">
                                        <div className="ms-label">Average Topics</div>
                                        <div className="ms-val" style={{ color: 'var(--amber)' }}>{avgTopics.length}</div>
                                        <div className="ms-sub">50–74% accuracy</div>
                                    </div>
                                    <div className="mini-stat">
                                        <div className="ms-label">Weak Topics</div>
                                        <div className="ms-val" style={{ color: 'var(--red)' }}>{weakTopics.length}</div>
                                        <div className="ms-sub">&lt;50% · needs focus</div>
                                    </div>
                                </div>

                                <div className="analytics-2col">
                                    {/* LEFT COL: Donut & Subjects */}
                                    <div className="card">
                                        <div className="card-title">Topic Strength Distribution</div>
                                        <div className="donut-wrap">
                                            <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
                                                <circle cx="60" cy="60" r="46" fill="none" stroke="#E2E8F8" strokeWidth="16" />
                                                <circle cx="60" cy="60" r="46" fill="none" stroke="#16A34A" strokeWidth="16" strokeDasharray={`${sDash} ${circ - sDash}`} strokeDashoffset="0" transform="rotate(-90 60 60)" />
                                                <circle cx="60" cy="60" r="46" fill="none" stroke="#D97706" strokeWidth="16" strokeDasharray={`${aDash} ${circ - aDash}`} strokeDashoffset={-sDash} transform="rotate(-90 60 60)" />
                                                <circle cx="60" cy="60" r="46" fill="none" stroke="#DC2626" strokeWidth="16" strokeDasharray={`${wDash} ${circ - wDash}`} strokeDashoffset={-(sDash + aDash)} transform="rotate(-90 60 60)" />
                                                <text x="60" y="55" textAnchor="middle" fontFamily="Syne,sans-serif" fontSize="17" fontWeight="800" fill="#0F172A">{topicEntries.length}</text>
                                                <text x="60" y="70" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="9" fill="#64748B">topics</text>
                                            </svg>
                                            <div className="donut-legend">
                                                <div className="legend-item"><div className="legend-dot" style={{ background: '#16A34A' }}></div><span className="legend-label">Strong</span><span className="legend-val">{strongTopics.length}</span></div>
                                                <div className="legend-item"><div className="legend-dot" style={{ background: '#D97706' }}></div><span className="legend-label">Average</span><span className="legend-val">{avgTopics.length}</span></div>
                                                <div className="legend-item"><div className="legend-dot" style={{ background: '#DC2626' }}></div><span className="legend-label">Weak</span><span className="legend-val">{weakTopics.length}</span></div>
                                            </div>
                                        </div>
                                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '4px' }}>
                                            <div className="card-title">Subject Accuracy</div>
                                            {Object.entries(subjectAgg).map(([sub, data], idx) => {
                                                const pct = Math.round((data.correct / data.total) * 100);
                                                const color = pct >= 75 ? 'linear-gradient(90deg,#16A34A,#4ADE80)' : pct >= 50 ? 'linear-gradient(90deg,#D97706,#FCD34D)' : 'linear-gradient(90deg,#DC2626,#F87171)';
                                                const tc = pct >= 75 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';
                                                return (
                                                    <div className="sbar-row" key={idx}>
                                                        <div className="sbar-label">{sub}</div>
                                                        <div className="sbar-track"><div className="sbar-fill" style={{ width: `${pct}%`, background: color }}></div></div>
                                                        <div className="sbar-score" style={{ color: tc }}>{pct}%</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* RIGHT COL: Topic Table */}
                                    <div className="card">
                                        <div className="card-title">Topic-wise Accuracy Breakdown</div>
                                        <table className="topic-table">
                                            <thead>
                                                <tr><th>Topic</th><th>Accuracy</th><th>Status</th></tr>
                                            </thead>
                                            <tbody>
                                                {topicEntries.sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total)).map(([key, data], idx) => {
                                                    const pct = Math.round((data.correct / data.total) * 100);
                                                    const color = pct >= 75 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';
                                                    const name = key.split(':')[1];
                                                    return (
                                                        <tr key={idx}>
                                                            <td style={{ fontWeight: '500' }}>{name}</td>
                                                            <td>
                                                                <div className="acc-wrap">
                                                                    <div className="acc-bar"><div className="acc-fill" style={{ width: `${pct}%`, background: color }}></div></div>
                                                                    <div className="acc-num" style={{ color: color }}>{pct}%</div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                {pct >= 75 && <span className="sbadge2 strong">★ Strong</span>}
                                                                {pct >= 50 && pct < 75 && <span className="sbadge2 avg">~ Average</span>}
                                                                {pct < 50 && <span className="sbadge2 weak">✗ Weak</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* AI RECOMMENDATIONS */}
                                <div className="section-title">System <span>Recommendations</span></div>
                                <div className="reco-grid">
                                    {weakTopics.length > 0 && (
                                        <div className="reco-card urgent">
                                            <div className="reco-icon">🚨</div><div className="reco-title">Urgent — Focus Now</div>
                                            <div className="reco-topics">{weakTopics.map((t, i) => <div key={i}>· {t.name}</div>)}<br /><strong>Suggested: 90 min/day</strong></div>
                                        </div>
                                    )}
                                    {avgTopics.length > 0 && (
                                        <div className="reco-card review">
                                            <div className="reco-icon">📖</div><div className="reco-title">Needs Revision</div>
                                            <div className="reco-topics">{avgTopics.map((t, i) => <div key={i}>· {t.name}</div>)}<br /><strong>Suggested: 45 min/day</strong></div>
                                        </div>
                                    )}
                                    {strongTopics.length > 0 && (
                                        <div className="reco-card master">
                                            <div className="reco-icon">✅</div><div className="reco-title">Mastered — Maintain</div>
                                            <div className="reco-topics">{strongTopics.map((t, i) => <div key={i}>· {t.name}</div>)}<br /><strong>Suggested: Weekly mock only</strong></div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}
                    </div>
                )}


                {/* --- VIEW: STUDY PLANNER --- */}
                {activeTab === 'plan' && (
                    <div className="page">
                        <div className="section-title">Personalized Study Planner</div>

                        <div className="card" style={{ maxWidth: '850px' }}>
                            <h3 style={{ marginBottom: '8px' }}>
                                Create Your Study Plan
                            </h3>

                            <p style={{ color: '#64748B', marginBottom: '22px' }}>
                                Build a realistic study schedule based on your goals,
                                available time and preparation level.
                            </p>

                            <label className="form-label">PLANNING MODE</label>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '15px',
                                marginBottom: '22px'
                            }}>
                                <button
                                    className="btn"
                                    style={{
                                        background: plannerMode === 'weekly' ? '#DBEAFE' : '#F8FAFC',
                                        border: plannerMode === 'weekly' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                                        color: '#1E293B',
                                        padding: '18px'
                                    }}
                                    onClick={() => setPlannerMode('weekly')}
                                >
                                    📅 Weekly Routine
                                    <div style={{ fontSize: '12px', marginTop: '6px' }}>
                                        Ongoing weekly schedule
                                    </div>
                                </button>

                                <button
                                    className="btn"
                                    style={{
                                        background: plannerMode === 'exam' ? '#DBEAFE' : '#F8FAFC',
                                        border: plannerMode === 'exam' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                                        color: '#1E293B',
                                        padding: '18px'
                                    }}
                                    onClick={() => setPlannerMode('exam')}
                                >
                                    🎯 Exam Preparation
                                    <div style={{ fontSize: '12px', marginTop: '6px' }}>
                                        Prepare for a specific exam
                                    </div>
                                </button>
                            </div>

                            {plannerMode === 'exam' && (
                                <div style={{ marginBottom: '20px' }}>
                                    <label className="form-label">EXAM DATE</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={examDate}
                                        onChange={(e) => setExamDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                            )}

                            <div style={{ marginBottom: '22px' }}>
                                <label className="form-label">DAILY STUDY TIME</label>
                                <select
                                    className="form-input"
                                    value={dailyStudyHours}
                                    onChange={(e) => setDailyStudyHours(Number(e.target.value))}
                                >
                                    <option value={1}>1 hour per day</option>
                                    <option value={2}>2 hours per day</option>
                                    <option value={3}>3 hours per day</option>
                                    <option value={4}>4 hours per day</option>
                                    <option value={5}>5 hours per day</option>
                                    <option value={6}>6 hours per day</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '22px' }}>
                                <label className="form-label">AVAILABLE STUDY DAYS</label>

                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '10px'
                                }}>
                                    {[
                                        'Monday', 'Tuesday', 'Wednesday', 'Thursday',
                                        'Friday', 'Saturday', 'Sunday'
                                    ].map((day) => (
                                        <label
                                            key={day}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '9px 12px',
                                                border: '1px solid #E2E8F0',
                                                borderRadius: '8px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={studyDays.includes(day)}
                                                onChange={(e) => {
                                                    setStudyDays((prev) =>
                                                        e.target.checked
                                                            ? [...prev, day]
                                                            : prev.filter((d) => d !== day)
                                                    );
                                                }}
                                            />
                                            {day.slice(0, 3)}
                                        </label>
                                    ))}
                                </div>
                            </div>


                            <div style={{ marginBottom: '22px' }}>
                                <label className="form-label">SUBJECT-WISE SYLLABUS</label>

                                {subjectTopics.map((item, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            border: '1px solid #E2E8F0',
                                            borderRadius: '10px',
                                            padding: '15px',
                                            marginBottom: '14px'
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '12px'
                                        }}>
                                            <strong>Subject {index + 1}</strong>

                                            {subjectTopics.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="btn"
                                                    onClick={() =>
                                                        setSubjectTopics(prev =>
                                                            prev.filter((_, i) => i !== index)
                                                        )
                                                    }
                                                >
                                                    ✕ Remove
                                                </button>
                                            )}
                                        </div>

                                        <label className="form-label">SUBJECT NAME</label>
                                        <input
                                            className="form-input"
                                            placeholder="e.g. Data Structures & Algorithms"
                                            value={item.subject}
                                            onChange={e =>
                                                setSubjectTopics(prev =>
                                                    prev.map((s, i) =>
                                                        i === index ? { ...s, subject: e.target.value } : s
                                                    )
                                                )
                                            }
                                        />

                                        <label className="form-label">TOPICS</label>
                                        <textarea
                                            className="form-input"
                                            rows="3"
                                            placeholder="Enter topics separated by commas, e.g. Arrays, Trees, Graphs"
                                            value={item.topics}
                                            onChange={e =>
                                                setSubjectTopics(prev =>
                                                    prev.map((s, i) =>
                                                        i === index ? { ...s, topics: e.target.value } : s
                                                    )
                                                )
                                            }
                                        />
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    className="btn"
                                    style={{
                                        width: '100%',
                                        border: '1px dashed #2563EB',
                                        color: '#2563EB'
                                    }}
                                    onClick={() =>
                                        setSubjectTopics(prev => [
                                            ...prev,
                                            { subject: '', topics: '' }
                                        ])
                                    }
                                >
                                    + Add Another Subject
                                </button>
                            </div>


                            {plannerMode === 'exam' && !examDate && (
                                <p style={{ color: '#DC2626', fontSize: '13px', marginBottom: '12px' }}>
                                    Please select your exam date.
                                </p>
                            )}

                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '14px' }}
                                disabled={
                                    !studyDays.length ||
                                    !subjectTopics.some(
                                        item => item.subject.trim() && item.topics.trim()
                                    ) ||
                                    (plannerMode === 'exam' && !examDate) ||
                                    plannerLoading
                                }

                                onClick={async () => {
                                    setPlannerLoading(true);

                                    try {
                                        // Convert subject-wise syllabus into backend format
                                        const topics = subjectTopics.flatMap(item =>
                                            item.topics
                                                .split(',')
                                                .map(topic => topic.trim())
                                                .filter(Boolean)
                                                .map(topic => ({
                                                    subject: item.subject.trim(),
                                                    topic
                                                }))
                                        ).filter(item => item.subject);

                                        const token = await getToken();

                                        const response = await fetch(
                                            'http://localhost:5000/api/planner/priorities',
                                            {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    Authorization: `Bearer ${token}`
                                                },
                                                body: JSON.stringify({ topics })
                                            }
                                        );

                                        const data = await response.json();

                                        if (!response.ok) {
                                            throw new Error(data.message || 'Failed to generate priorities.');
                                        }

                                        setStudyPlan({
                                            priorities: data.priorities,
                                            mode: plannerMode,
                                            dailyStudyHours,
                                            studyDays,
                                            examDate
                                        });

                                        alert('Topic priorities calculated successfully!');

                                        console.log('Planner priorities:', data.priorities);

                                    } catch (error) {
                                        console.error('Planner error:', error);
                                        alert(error.message);
                                    } finally {
                                        setPlannerLoading(false);
                                    }
                                }}

                            >
                                ✨ Generate Personalized Study Plan
                            </button>


                            {studyPlan && (
                                <div style={{ marginTop: '25px' }}>
                                    <div className="section-title">
                                        Your Topic Priority Analysis
                                    </div>

                                    {topicAllocations.map((item, index) => (<div
                                        key={`${item.subject}-${item.topic}`}
                                        className="card"
                                        style={{
                                            marginBottom: '12px',
                                            padding: '16px'
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: '10px'
                                        }}>
                                            <div>
                                                <strong>{item.topic}</strong>
                                                <p style={{
                                                    color: '#64748B',
                                                    fontSize: '13px',
                                                    marginTop: '4px'
                                                }}>
                                                    {item.subject}
                                                </p>
                                            </div>

                                            <span style={{
                                                padding: '5px 10px',
                                                borderRadius: '20px',
                                                background:
                                                    item.priority === 'Very High' ? '#FEE2E2' :
                                                        item.priority === 'High' ? '#FFEDD5' :
                                                            item.priority === 'Medium' ? '#FEF3C7' :
                                                                '#DCFCE7',
                                                color:
                                                    item.priority === 'Very High' ? '#B91C1C' :
                                                        item.priority === 'High' ? '#C2410C' :
                                                            item.priority === 'Medium' ? '#A16207' :
                                                                '#15803D',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                height: 'fit-content'
                                            }}>
                                                {item.priority}
                                            </span>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            gap: '20px',
                                            flexWrap: 'wrap',
                                            marginTop: '14px',
                                            fontSize: '13px',
                                            color: '#475569'
                                        }}>
                                            <span>
                                                Accuracy: {item.accuracy === null
                                                    ? 'Not assessed'
                                                    : `${item.accuracy}%`}
                                            </span>
                                            <span>Difficulty: {item.difficulty}</span>
                                            <span>Status: {item.status}</span>
                                            <span>
                                                Study Time: {item.allocatedHours} hrs/week
                                            </span>
                                        </div>
                                    </div>
                                    ))}
                                    <div style={{ marginTop: '30px' }}>
                                        <div className="card" style={{ marginBottom: '20px' }}>
                                            <h3 style={{ marginBottom: '12px' }}>
                                                Weekly Progress
                                            </h3>

                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: '10px'
                                            }}>
                                                <strong>
                                                    {completedCount} / {totalTasks} Sessions Completed
                                                </strong>

                                                <strong style={{ color: '#2563EB' }}>
                                                    {completionPercentage}%
                                                </strong>
                                            </div>

                                            <div style={{
                                                width: '100%',
                                                height: '12px',
                                                background: '#E2E8F0',
                                                borderRadius: '10px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    width: `${completionPercentage}%`,
                                                    height: '100%',
                                                    background: '#2563EB',
                                                    borderRadius: '10px',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                        </div>
                                        <div className="section-title">
                                            Your Weekly Study Timetable
                                        </div>

                                        <p style={{
                                            color: '#64748B',
                                            fontSize: '14px',
                                            marginBottom: '16px'
                                        }}>
                                            Your daily study sessions, divided into 30-minute blocks.
                                        </p>


                                        {weeklySchedule.map((dayPlan) => (
                                            <div
                                                key={dayPlan.day}
                                                className="card"
                                                style={{
                                                    marginBottom: '14px',
                                                    padding: '18px'
                                                }}
                                            >
                                                <h3 style={{ marginBottom: '14px' }}>
                                                    {dayPlan.day}
                                                </h3>

                                                {dayPlan.tasks.map((task, index) => {
                                                    const taskId = `${dayPlan.day}-${index}`;

                                                    return (
                                                        <div
                                                            key={taskId}
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                gap: '12px',
                                                                padding: '12px',
                                                                marginBottom: '8px',
                                                                background: '#F8FAFC',
                                                                borderRadius: '8px'
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={!!completedTasks[taskId]}
                                                                onChange={(e) => {
                                                                    setCompletedTasks(prev => ({
                                                                        ...prev,
                                                                        [taskId]: e.target.checked
                                                                    }));
                                                                }}
                                                                style={{
                                                                    width: '18px',
                                                                    height: '18px',
                                                                    cursor: 'pointer',
                                                                    flexShrink: 0
                                                                }}
                                                            />

                                                            <div style={{ flex: 1 }}>
                                                                <strong>{task.topic}</strong>
                                                                <p style={{
                                                                    color: '#64748B',
                                                                    fontSize: '12px',
                                                                    marginTop: '4px'
                                                                }}>
                                                                    {task.subject}
                                                                </p>
                                                            </div>

                                                            <span style={{
                                                                color: '#2563EB',
                                                                fontWeight: 'bold',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {task.duration} min
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}


                                    </div>
                                </div>
                            )}


                        </div>
                    </div>
                )}


            </main>
        </div>
    );
}

function App() {
    const { isSignedIn, isLoaded } = useUser();

    if (!isLoaded) {
        return <div>Loading...</div>;
    }

    if (!isSignedIn) {
        return <AuthScreen />;
    }

    return <EduPrepApp />;
}

export default App;