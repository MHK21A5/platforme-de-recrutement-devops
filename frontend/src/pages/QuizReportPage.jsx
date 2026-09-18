import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import api from "../services/api";
import { TiltCard } from "../components/TiltCard";
import { ArrowLeftIcon, CheckCircleIcon, AlertTriangleIcon, UserIcon, CalendarIcon, ClockIcon } from "../components/icons";

/* ── AI analysis generator ─────────────────────────────────────────────── */
function generateOverallAnalysis(report) {
  if (!report) return "";
  const score = report.score ?? 0;
  const wrong = (report.answers || []).filter((a) => !a.isCorrect).length;
  const total = report.totalQuestions || 1;
  const weakTopics = (report.questions || [])
    .filter((q) => {
      const a = (report.answers || []).find((a) => a.questionId === q.questionId);
      return a && !a.isCorrect;
    })
    .slice(0, 3)
    .map((q) => q.prompt || q.question || "this topic");

  if (score >= 90) {
    return `Excellent performance. The candidate demonstrated mastery of the subject, answering ${total - wrong} out of ${total} questions correctly. Only minor gaps remain${weakTopics.length ? ` around ${weakTopics.join(", ")}` : ""}. This candidate is well-prepared and shows strong command of fundamentals.`;
  }
  if (score >= 70) {
    return `Good overall result with a score of ${score}%. The candidate has a solid foundation but missed ${wrong} question${wrong !== 1 ? "s" : ""}${weakTopics.length ? `, particularly around ${weakTopics.join(", ")}` : ""}. These gaps are bridgeable with targeted revision.`;
  }
  if (score >= 50) {
    return `The candidate passed with a score of ${score}%, but there are notable knowledge gaps. ${wrong} out of ${total} questions were answered incorrectly${weakTopics.length ? `, especially in ${weakTopics.join(", ")}` : ""}. Further assessment or additional preparation is recommended before proceeding.`;
  }
  return `The candidate scored ${score}% — below the passing threshold. ${wrong} out of ${total} questions were incorrect${weakTopics.length ? `, with significant weaknesses in ${weakTopics.join(", ")}` : ""}. A comprehensive review of core concepts is strongly advised before re-evaluation.`;
}

function generateQuestionAnalysis(question, answer) {
  if (!answer || answer.isCorrect) return null;
  const q = question.prompt || question.question || "";
  const given = answer.answer || "No answer provided";
  const correct = question.correctAnswer || "";
  const explanation = question.explanation || "";

  if (explanation) {
    return explanation;
  }

  // Fallback AI-style text
  return `The candidate answered "${given}", but the correct answer is "${correct}". This suggests a misunderstanding of ${q.toLowerCase().replace(/\?$/, "").slice(0, 60)}. Reviewing this concept thoroughly is recommended to avoid similar mistakes.`;
}

/* ── Donut chart (pure SVG, no deps) ────────────────────────────────────── */
function DonutChart({ correct, wrong, total }) {
  const size = 160;
  const r = 60;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const correctPct = total > 0 ? (correct / total) : 0;
  const wrongPct = total > 0 ? (wrong / total) : 0;
  const correctLen = correctPct * circumference;
  const wrongLen = wrongPct * circumference;
  const gap = total > 0 ? Math.min(3, circumference * 0.01) : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {/* bg ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={18} />
      {/* correct arc */}
      {correct > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#22c55e"
          strokeWidth={18}
          strokeDasharray={`${correctLen - gap} ${circumference - correctLen + gap}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
        />
      )}
      {/* wrong arc */}
      {wrong > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#ef4444"
          strokeWidth={18}
          strokeDasharray={`${wrongLen - gap} ${circumference - wrongLen + gap}`}
          strokeDashoffset={circumference * 0.25 - correctLen + gap}
          strokeLinecap="round"
        />
      )}
      {/* center label */}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#f8fafc" fontSize={22} fontWeight={700}>
        {total > 0 ? Math.round((correct / total) * 100) : 0}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--muted-foreground)" fontSize={11}>
        correct
      </text>
    </svg>
  );
}

/* ── Horizontal bar chart ────────────────────────────────────────────────── */
function BarChart({ correct, wrong }) {
  const total = correct + wrong;
  const correctW = total > 0 ? (correct / total) * 100 : 0;
  const wrongW = total > 0 ? (wrong / total) * 100 : 0;
  return (
    <div style={{ display: "grid", gap: "0.65rem" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--muted-foreground)", marginBottom: "0.3rem" }}>
          <span>Correct</span><span style={{ color: "#22c55e", fontWeight: 700 }}>{correct}</span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ width: `${correctW}%`, height: "100%", background: "linear-gradient(90deg,#16a34a,#22c55e)", borderRadius: 999, transition: "width 0.6s ease" }} />
        </div>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--muted-foreground)", marginBottom: "0.3rem" }}>
          <span>Incorrect</span><span style={{ color: "#ef4444", fontWeight: 700 }}>{wrong}</span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ width: `${wrongW}%`, height: "100%", background: "linear-gradient(90deg,#dc2626,#ef4444)", borderRadius: 999, transition: "width 0.6s ease" }} />
        </div>
      </div>
    </div>
  );
}

function formatDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── main page ───────────────────────────────────────────────────────────── */
export default function QuizReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [report, setReport] = useState(location.state?.report || null);
  const [loading, setLoading] = useState(!location.state?.report);
  const [error, setError] = useState("");

  useEffect(() => {
    // If report was passed via navigation state, no need to fetch
    if (location.state?.report) return;
    if (!id) return;
    setLoading(true);
    api.get(`/interviews/admin/quiz-results/${id}`)
      .then((res) => setReport(res.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load report."))
      .finally(() => setLoading(false));
  }, [id]);

  const correctCount = useMemo(() => (report?.answers || []).filter((a) => a.isCorrect).length, [report]);
  const wrongCount = useMemo(() => (report?.answers || []).filter((a) => !a.isCorrect).length, [report]);
  const totalQ = report?.totalQuestions || 0;
  const analysis = useMemo(() => generateOverallAnalysis(report), [report]);

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.topbar}>
          <button style={S.back} onClick={() => navigate(-1)}><ArrowLeftIcon size={15} /> Back</button>
          <span style={S.topTitle}>Quiz Report</span>
        </div>
        <div style={S.center}><div style={S.spinner} /></div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={S.page}>
        <div style={S.topbar}>
          <button style={S.back} onClick={() => navigate(-1)}><ArrowLeftIcon size={15} /> Back</button>
          <span style={S.topTitle}>Quiz Report</span>
        </div>
        <div style={S.center}><div style={{ color: "#ef4444", fontSize: "0.95rem" }}>{error || "Report not found."}</div></div>
      </div>
    );
  }

  const passed = report.passed;
  const score = report.score ?? 0;
  const jobLabel = report.jobTitle || report.jobPosition || report.job?.title || "Unknown position";

  return (
    <div style={S.page}>
      {/* ── topbar ── */}
      <div style={S.topbar}>
        <button style={S.back} onClick={() => navigate(-1)}><ArrowLeftIcon size={15} /> Back to dashboard</button>
        <span style={S.topTitle}>Quiz Report</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ ...S.badge, background: passed ? "var(--success-dim)" : "var(--danger-dim)", color: passed ? "var(--success)" : "var(--danger)", border: `1px solid ${passed ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
            {passed ? "Passed" : "Needs review"}
          </span>
          <span style={{ ...S.badge, background: "var(--brand-dim)", color: "var(--brand)", border: "1px solid rgba(59,130,246,0.3)" }}>
            {score}% score
          </span>
        </div>
      </div>

      <div style={S.content}>
        {/* ── hero header ── */}
        <Motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ ...S.hero, position: "relative", overflow: "hidden" }}
        >
          <div style={{ ...S.heroGlow, background: passed ? "var(--success-dim)" : "var(--danger-dim)" }} />
          <div style={S.heroLeft}>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", marginBottom: "0.4rem" }}>
              Candidate assessment report
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--foreground)", lineHeight: 1.2 }}>
              {report.candidate?.name || "Unknown Candidate"}
            </div>
            <div style={{ fontSize: "0.9rem", color: "var(--muted-foreground)", marginTop: "0.35rem" }}>{jobLabel}</div>
          </div>
          <div style={S.heroMeta}>
            <div style={S.metaItem}>
              <UserIcon size={13} />
              <span>Recruiter: {report.recruiter?.name || "—"}</span>
            </div>
            <div style={S.metaItem}>
              <CalendarIcon size={13} />
              <span>Completed: {formatDate(report.completedAt)}</span>
            </div>
            <div style={S.metaItem}>
              <ClockIcon size={13} />
              <span>Started: {formatDate(report.startedAt)}</span>
            </div>
          </div>
        </Motion.div>

        {/* ── stats row ── */}
        <div style={S.statsRow}>
          {[
            { label: "Total questions", value: totalQ, color: "var(--muted-foreground)" },
            { label: "Answered", value: report.answeredCount, color: "var(--muted-foreground)" },
            { label: "Correct", value: correctCount, color: "#22c55e" },
            { label: "Incorrect", value: wrongCount, color: "#ef4444" },
            { label: "Score", value: `${score}%`, color: passed ? "#22c55e" : "#f97316" },
          ].map((s, i) => (
            <TiltCard key={s.label} maxTilt={5} style={S.statCard}>
              <Motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
              >
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted-foreground)", marginBottom: "0.4rem" }}>{s.label}</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: s.color }}>{s.value}</div>
              </Motion.div>
            </TiltCard>
          ))}
        </div>

        {/* ── charts + analysis ── */}
        <div style={S.chartsRow}>
          {/* donut */}
          <div style={S.panel}>
            <div style={S.panelTitle}>Score breakdown</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}>
              <DonutChart correct={correctCount} wrong={wrongCount} total={totalQ} />
              <div style={{ display: "flex", gap: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e", display: "inline-block" }} />
                  Correct ({correctCount})
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444", display: "inline-block" }} />
                  Incorrect ({wrongCount})
                </div>
              </div>
            </div>
          </div>

          {/* bar chart */}
          <div style={S.panel}>
            <div style={S.panelTitle}>Performance distribution</div>
            <div style={{ marginTop: "0.5rem" }}>
              <BarChart correct={correctCount} wrong={wrongCount} />
            </div>
            <div style={{ marginTop: "1.25rem" }}>
              <div style={{ height: 10, borderRadius: 999, background: "var(--border)", overflow: "hidden", marginBottom: "0.4rem" }}>
                <div style={{ width: `${Math.max(0, Math.min(100, score))}%`, height: "100%", background: `linear-gradient(90deg, ${score >= 50 ? "#16a34a,#22c55e" : "#dc2626,#f97316"})`, borderRadius: 999, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Overall score: {score}%</div>
            </div>
          </div>

          {/* AI analysis */}
          <div style={{ ...S.panel, flex: "1 1 300px" }}>
            <div style={S.panelTitle}>AI assessment</div>
            <div style={{ fontSize: "0.88rem", lineHeight: 1.7, color: "var(--foreground)", marginTop: "0.25rem" }}>
              {analysis}
            </div>
            <div style={{ marginTop: "1rem", padding: "0.6rem 0.85rem", borderRadius: "0.4rem", background: "var(--background)", border: "1px solid var(--border)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
              This analysis is generated from the candidate's quiz answers and highlights key strengths and areas for improvement.
            </div>
          </div>
        </div>

        {/* ── questions breakdown ── */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Question-by-question breakdown</div>
          <div style={{ display: "grid", gap: "0.9rem", marginTop: "0.75rem" }}>
            {(report.questions || []).map((question, idx) => {
              const answer = (report.answers || []).find((a) => a.questionId === question.questionId);
              const correct = answer?.isCorrect;
              const qAnalysis = generateQuestionAnalysis(question, answer);
              const promptText = question.prompt || question.question || "—";

              return (
                <Motion.div
                  key={question.questionId}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.25, delay: Math.min(idx, 10) * 0.04 }}
                  style={{ ...S.qCard, borderLeft: `3px solid ${correct ? "#22c55e" : "#ef4444"}` }}
                >
                  {/* question header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted-foreground)", whiteSpace: "nowrap", paddingTop: "0.1rem" }}>Q{idx + 1}</span>
                      <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--foreground)", lineHeight: 1.5 }}>{promptText}</div>
                    </div>
                    <span style={{
                      flexShrink: 0,
                      padding: "3px 10px", borderRadius: "var(--radius-full)",
                      fontSize: "0.72rem", fontWeight: 700,
                      background: correct ? "var(--success-dim)" : "var(--danger-dim)",
                      color: correct ? "var(--success)" : "var(--danger)",
                      border: `1px solid ${correct ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                    }}>
                      {correct ? "✓ Correct" : "✗ Incorrect"}
                    </span>
                  </div>

                  {/* options grid */}
                  {Array.isArray(question.options) && question.options.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.45rem", marginBottom: "0.85rem" }}>
                      {question.options.map((opt) => {
                        const isCorrectOpt = opt === question.correctAnswer;
                        const isCandidateOpt = opt === answer?.answer;
                        const bg = isCorrectOpt ? "var(--success-dim)" : isCandidateOpt && !correct ? "var(--danger-dim)" : "var(--bg-input)";
                        const border = isCorrectOpt ? "rgba(34,197,94,0.35)" : isCandidateOpt && !correct ? "rgba(239,68,68,0.35)" : "var(--border-hi)";
                        const color = isCorrectOpt ? "var(--success)" : isCandidateOpt && !correct ? "var(--danger)" : "var(--fg-muted)";
                        return (
                          <div key={opt} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.4rem", background: bg, border: `1px solid ${border}`, fontSize: "0.82rem", color, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            {isCorrectOpt && <span style={{ fontSize: "0.7rem" }}>✓</span>}
                            {isCandidateOpt && !correct && <span style={{ fontSize: "0.7rem" }}>✗</span>}
                            {opt}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* answer rows */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: correct ? 0 : "0.75rem" }}>
                    <div style={{ padding: "0.6rem 0.85rem", borderRadius: "0.4rem", background: "var(--background)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted-foreground)", marginBottom: "0.25rem" }}>Candidate answered</div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: correct ? "var(--success)" : "var(--danger)" }}>
                        {answer?.answer || <span style={{ color: "var(--fg-subtle)", fontStyle: "italic" }}>No answer</span>}
                      </div>
                    </div>
                    <div style={{ padding: "0.6rem 0.85rem", borderRadius: "0.4rem", background: "var(--bg-input)", border: "1px solid rgba(34,197,94,0.25)" }}>
                      <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-subtle)", marginBottom: "0.25rem" }}>Correct answer</div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--success)" }}>{question.correctAnswer || "—"}</div>
                    </div>
                  </div>

                  {/* AI explanation for wrong answers */}
                  {!correct && qAnalysis && (
                    <div style={{ padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--bg-input)", border: "1px solid var(--border-hi)", display: "flex", gap: "8px", marginTop: "10px" }}>
                      <div style={{ flexShrink: 0, marginTop: "2px" }}>
                        <AlertTriangleIcon size={13} style={{ color: "var(--brand)" }} />
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--fg-muted)", lineHeight: 1.6 }}>{qAnalysis}</div>
                    </div>
                  )}
                  {correct && question.explanation && (
                    <div style={{ padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--success-dim)", border: "1px solid rgba(34,197,94,0.2)", fontSize: "0.82rem", color: "var(--success)", lineHeight: 1.6, marginTop: "10px" }}>
                      {question.explanation}
                    </div>
                  )}
                </Motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── styles ─────────────────────────────────────────────────────────────── */
const S = {
  page: { minHeight: "100vh", background: "var(--bg-base)", color: "var(--fg)", display: "flex", flexDirection: "column" },
  topbar: {
    background: "var(--bg-surface)", borderBottom: "1px solid var(--border)",
    padding: "0 24px", height: 54, flexShrink: 0,
    display: "flex", alignItems: "center", gap: "12px",
    position: "sticky", top: 0, zIndex: 20,
    boxShadow: "0 1px 0 var(--border)",
  },
  back: {
    display: "inline-flex", alignItems: "center", gap: "6px",
    padding: "5px 12px", borderRadius: "var(--radius-sm)",
    background: "transparent", border: "1px solid var(--border-hi)",
    cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500,
    color: "var(--fg-muted)", transition: "all 140ms",
  },
  topTitle: { fontWeight: 700, fontSize: "0.9375rem", color: "var(--fg)" },
  badge: { padding: "4px 12px", borderRadius: "var(--radius-full)", fontWeight: 600, fontSize: "0.75rem" },
  content: { flex: 1, maxWidth: 1000, width: "100%", margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: "20px" },
  center: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  spinner: { width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  hero: {
    background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)",
    padding: "28px", display: "flex", justifyContent: "space-between", gap: "24px", flexWrap: "wrap",
    boxShadow: "var(--shadow-brand)",
  },
  heroGlow: {
    position: "absolute", top: "-40%", right: "-10%", width: 320, height: 320,
    borderRadius: "50%", filter: "blur(60px)", opacity: 0.5, pointerEvents: "none",
  },
  heroLeft: { flex: 1, minWidth: 200, position: "relative" },
  heroMeta: { display: "flex", flexDirection: "column", gap: "8px", justifyContent: "center", position: "relative" },
  metaItem: { display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", color: "var(--fg-muted)" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" },
  statCard: {
    background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: "16px 20px",
  },
  chartsRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  panel: {
    flex: "1 1 200px", background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: "20px",
    boxShadow: "var(--shadow-xs)",
  },
  panelTitle: { fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-subtle)", marginBottom: "16px" },
  qCard: {
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: "18px 20px",
  },
};
