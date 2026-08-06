import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // CORE STATS
  const [stats, setStats] = useState({ quizzesTaken: 0, avgScore: 0, streak: 1, totalQuestions: 0, totalCorrect: 0 });
  const [topicStats, setTopicStats] = useState({}); // Stores { "Subject:Topic": { correct: 5, total: 10 } }
  
  // QUIZ STATE
  const [quizPhase, setQuizPhase] = useState('setup'); 
  const [notes, setNotes] = useState('');
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

  // 1. LOAD DATA ON BOOT
  useEffect(() => {
    const savedStats = localStorage.getItem('eduprep_db');
    const savedTopics = localStorage.getItem('eduprep_topics');
    if (savedStats) setStats(JSON.parse(savedStats));
    if (savedTopics) setTopicStats(JSON.parse(savedTopics));
  }, []);

  // 2. SAVE DATA AFTER QUIZ
  const finishQuiz = () => {
    // Update Core Stats
    const newTotalCorrect = stats.totalCorrect + score;
    const newTotalQ = stats.totalQuestions + questions.length;
    const newStats = {
      quizzesTaken: stats.quizzesTaken + 1,
      avgScore: Math.round((newTotalCorrect / newTotalQ) * 100),
      streak: stats.streak,
      totalQuestions: newTotalQ,
      totalCorrect: newTotalCorrect
    };
    setStats(newStats);
    localStorage.setItem('eduprep_db', JSON.stringify(newStats));

    // Update Topic Breakdown
    const topicKey = `${subject}:${topic.trim() || 'General'}`;
    const newTopicStats = { ...topicStats };
    if (!newTopicStats[topicKey]) newTopicStats[topicKey] = { correct: 0, total: 0 };
    newTopicStats[topicKey].correct += score;
    newTopicStats[topicKey].total += questions.length;
    setTopicStats(newTopicStats);
    localStorage.setItem('eduprep_topics', JSON.stringify(newTopicStats));

    setQuizPhase('result');
  };

  const handleGenerate = async () => {
    if (!notes.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(
  'https://eduprep-ms15.onrender.com/api/generate',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      notes,
      stream,
      subject,
      topic,
      difficulty,
      count: qCount
    })
  }
);
      const data = await response.json();

if (!response.ok) {
    console.error(data);
    alert(JSON.stringify(data));
    return;
}
      setQuestions(data);
      setQuizPhase('active');
      setCurrentQ(0);
      setScore(0);
      setIsAnswered(false);
      setSelectedOpt(null);
    } catch (error) {
    console.error(error);
    alert(error.message);
} finally {
      setLoading(false);
    }
  };

  const handleAnswer = (optIndex, optionText) => {
    if (isAnswered) return;
    setSelectedOpt(optIndex);
    setIsAnswered(true);
    const correctAnswer = String(questions[currentQ].answer || questions[currentQ].correctAnswer || "").toLowerCase().trim();
    if (String(optionText).toLowerCase().trim().includes(correctAnswer) || correctAnswer.includes(String(optionText).toLowerCase().trim())) {
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
          <button className={`nav-item ${activeTab === 'quiz' ? 'active' : ''}`} onClick={() => { setActiveTab('quiz'); setQuizPhase('setup'); }}>⚡ Practice Quiz</button>
          <button className={`nav-item ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>📅 Study Plan</button>
          <button className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>📈 Analytics</button>
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.28)', marginBottom:'7px', textTransform:'uppercase', letterSpacing:'.07em' }}>Streams</div>
          <span className="sbadge sbadge-cs">CS / IT</span>
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
                <div className="s-value" style={{color:'var(--text)'}}>{stats.quizzesTaken}</div>
                <div className="s-hint">Session Total</div>
              </div>
              <div className="stat-card">
                <div className="s-label">Topics Attempted</div>
                <div className="s-value" style={{color:'var(--text)'}}>{topicEntries.length}</div>
                <div className="s-hint">Unique areas tested</div>
              </div>
              <div className="stat-card">
                <div className="s-label">Total Questions</div>
                <div className="s-value" style={{color:'var(--text)'}}>{stats.totalQuestions}</div>
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
                  <textarea className="form-input" rows="5" placeholder="Paste your lecture slides, notes, or textbook paragraphs here..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <select className="form-input" style={{ width: '100px', marginBottom: 0 }} value={qCount} onChange={(e) => setQCount(e.target.value)}>
                      <option value="5">5 Qs</option><option value="10">10 Qs</option><option value="15">15 Qs</option>
                    </select>
                    <button className="btn btn-primary" onClick={handleGenerate} disabled={loading || !notes.trim()} style={{ flex: 1 }}>
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
                      const correctAnswer = String(questions[currentQ].answer || questions[currentQ].correctAnswer || "").toLowerCase().trim();
                      if (isAnswered) {
                        const isCorrectOpt = String(opt).toLowerCase().trim().includes(correctAnswer) || correctAnswer.includes(String(opt).toLowerCase().trim());
                        if (isCorrectOpt) btnClass += " correct";
                        else if (selectedOpt === i) btnClass += " wrong";
                      }
                      return (
                        <div key={i} className={btnClass} onClick={() => handleAnswer(i, opt)}>
                          <div className="opt-letter">{['A','B','C','D'][i]}</div>
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
                        <circle cx="60" cy="60" r="46" fill="none" stroke="#E2E8F8" strokeWidth="16"/>
                        <circle cx="60" cy="60" r="46" fill="none" stroke="#16A34A" strokeWidth="16" strokeDasharray={`${sDash} ${circ - sDash}`} strokeDashoffset="0" transform="rotate(-90 60 60)"/>
                        <circle cx="60" cy="60" r="46" fill="none" stroke="#D97706" strokeWidth="16" strokeDasharray={`${aDash} ${circ - aDash}`} strokeDashoffset={-sDash} transform="rotate(-90 60 60)"/>
                        <circle cx="60" cy="60" r="46" fill="none" stroke="#DC2626" strokeWidth="16" strokeDasharray={`${wDash} ${circ - wDash}`} strokeDashoffset={-(sDash + aDash)} transform="rotate(-90 60 60)"/>
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
                        {topicEntries.sort((a,b) => (b[1].correct/b[1].total) - (a[1].correct/a[1].total)).map(([key, data], idx) => {
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
                      <div className="reco-topics">{weakTopics.map((t, i) => <div key={i}>· {t.name}</div>)}<br/><strong>Suggested: 90 min/day</strong></div>
                    </div>
                  )}
                  {avgTopics.length > 0 && (
                    <div className="reco-card review">
                      <div className="reco-icon">📖</div><div className="reco-title">Needs Revision</div>
                      <div className="reco-topics">{avgTopics.map((t, i) => <div key={i}>· {t.name}</div>)}<br/><strong>Suggested: 45 min/day</strong></div>
                    </div>
                  )}
                  {strongTopics.length > 0 && (
                    <div className="reco-card master">
                      <div className="reco-icon">✅</div><div className="reco-title">Mastered — Maintain</div>
                      <div className="reco-topics">{strongTopics.map((t, i) => <div key={i}>· {t.name}</div>)}<br/><strong>Suggested: Weekly mock only</strong></div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* --- VIEW: STUDY PLAN (Empty) --- */}
        {activeTab === 'plan' && (
          <div className="page">
             <div className="empty-state">
                <div className="empty-icon">📅</div>
                <div className="empty-title">Study Schedule</div>
                <div className="empty-desc">Once you accumulate enough quiz data, the system will generate a daily study calendar targeting your weak points.</div>
              </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;