import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { motion as Motion } from "framer-motion";
import api from "../services/api";
import { useToast } from "../context/useToast";
import { TiltCard } from "../components/TiltCard";
import { Avatar } from "../components/AppShell";
import { Badge } from "../components/ui/Badge";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  SendIcon,
  VideoIcon,
  VideoOffIcon,
  FileTextIcon,
  CheckCircleIcon,
  MicIcon,
  MicOffIcon,
  MonitorIcon,
  PhoneIcon,
  PhoneOffIcon,
} from "../components/icons";

const SOCKET_URL = "http://localhost:5000";
const LOGO_URL   = "http://localhost:5000/uploads/logo.png";
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/* ── helpers ─────────────────────────────────────────────────────────────── */
const statusVariant = (s) =>
  s === "finished" ? "success" : s === "ongoing" ? "info" : "warning";
const statusLabel = (s) =>
  !s ? "Pending" : s.charAt(0).toUpperCase() + s.slice(1);
function formatDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleString(undefined, {
    weekday:"short", month:"short", day:"numeric",
    year:"numeric", hour:"2-digit", minute:"2-digit",
  });
}
const formatTime = (iso) =>
  !iso ? "" : new Date(iso).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});

function generateQuizAnalysis(quizResult) {
  if (!quizResult) return "";
  const score = quizResult.score ?? 0;
  const wrongCount = (quizResult.answers || []).filter((a) => !a.isCorrect).length;
  const wrongQuestions = (quizResult.questions || [])
    .filter((question) => {
      const answer = (quizResult.answers || []).find((a) => a.questionId === question.questionId);
      return answer && !answer.isCorrect;
    })
    .slice(0, 3)
    .map((question) => question.prompt || question.question || "this topic");

  if (score >= 90) {
    return `Strong performance overall. The candidate demonstrated solid command of the core concepts, with only ${wrongCount} minor mistake${wrongCount === 1 ? "" : "s"} across the quiz. Focus on reviewing ${wrongQuestions.join(", ")} to close the gap.`;
  }

  if (score >= 70) {
    return `Good score, but the candidate still missed ${wrongCount} question${wrongCount === 1 ? "" : "s"}. The areas that need improvement include ${wrongQuestions.join(", ")}. Reinforcing those topics will help turn this into a confident passing result.`;
  }

  if (score >= 50) {
    return `The candidate passed, but only narrowly. There are ${wrongCount} incorrect response${wrongCount === 1 ? "" : "s"}, especially around ${wrongQuestions.join(", ")}. I recommend targeted review on those concepts before the next round.`;
  }

  return `The candidate struggled on this quiz, with ${wrongCount} incorrect answer${wrongCount === 1 ? "" : "s"}. Key weaknesses appeared in ${wrongQuestions.join(", ")} and related fundamentals. This report highlights the most important follow-up topics.`;
}

/* ── styles ──────────────────────────────────────────────────────────────── */
const S = {
  page: { display:"flex", flexDirection:"column", height:"100vh", background:"var(--bg-base)", overflow:"hidden", minHeight:0, color:"var(--fg)" },
  topbar: {
    background:"var(--bg-surface)", borderBottom:"1px solid var(--border)",
    padding:"0 20px", height:54, flexShrink:0,
    display:"flex", alignItems:"center", gap:"12px",
    position:"sticky", top:0, zIndex:20,
  },
  logo: { width:28, height:28, objectFit:"contain" },
  topbarTitle: { fontWeight:600, fontSize:"0.9375rem", color:"var(--fg)", flex:1, minWidth:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  topbarRight: { display:"flex", alignItems:"center", gap:"8px", flexShrink:0 },
  backBtn: {
    display:"inline-flex", alignItems:"center", gap:"6px",
    padding:"5px 12px", borderRadius:"var(--radius-sm)",
    background:"transparent", border:"1px solid var(--border-hi)",
    cursor:"pointer", fontSize:"0.8125rem", fontWeight:500,
    color:"var(--fg-muted)", flexShrink:0, transition:"all 140ms",
  },
  body: { flex:1, display:"flex", overflow:"hidden", minHeight:0 },
  mainPanel: () => ({
    flex: "1 1 auto",
    display:"flex", flexDirection:"column",
    padding:"16px", gap:"12px", overflowY:"auto", overflowX:"hidden",
    minHeight:0, borderRight:"1px solid var(--border)",
    transition: "flex 220ms ease",
  }),
  card: { background:"var(--bg-card)", borderRadius:"var(--radius-lg)", border:"1px solid var(--border)", overflow:"hidden", flexShrink:0, boxShadow:"var(--shadow-xs)" },
  cardHeader: { padding:"14px 18px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"8px" },
  cardHeaderTitle: { fontWeight:600, fontSize:"0.9rem", color:"var(--fg)" },
  cardBody: { padding:"16px 18px" },
  detailGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" },
  detailLabel: { fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--fg-subtle)", marginBottom:"3px" },
  detailValue: { fontSize:"0.9rem", color:"var(--fg)" },
  participantRow: { display:"flex", alignItems:"center", gap:"10px", padding:"8px 0" },
  participantInfo: { display:"flex", flexDirection:"column" },
  participantName: { fontSize:"0.875rem", fontWeight:500, color:"var(--fg)" },
  participantRole: { fontSize:"0.75rem", color:"var(--fg-muted)", textTransform:"capitalize" },
  futurePlaceholder: {
    flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center",
    justifyContent:"center", gap:"12px", padding:"32px",
    borderRadius:"var(--radius-lg)", border:"2px dashed var(--border)",
    background:"rgba(255,255,255,0.02)", textAlign:"center", minHeight:180,
  },
  futureIcon: { width:48, height:48, borderRadius:"50%", background:"linear-gradient(135deg,var(--brand),#60a5fa)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" },
  futureTitle: { fontWeight:600, fontSize:"0.9rem", color:"var(--fg)" },
  futureSubtitle: { fontSize:"0.8125rem", color:"var(--fg-muted)", maxWidth:280 },
  chatPanel: (open) => ({
    width: open ? 360 : 0,
    minWidth: open ? 280 : 0,
    maxWidth: open ? 400 : 0,
    display:"flex", flexDirection:"column",
    background:"var(--bg-surface)",
    minHeight:0, height:"100%",
    overflow: "hidden",
    borderLeft: open ? "1px solid var(--border)" : "none",
    transition: "width 220ms ease, min-width 220ms ease, max-width 220ms ease",
    flexShrink: 0,
  }),
  chatToggleBtn: (open) => ({
    position: "absolute",
    right: open ? 360 : 0,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 30,
    width: 20,
    height: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--brand)",
    border: "none",
    borderRadius: open ? "6px 0 0 6px" : "0 6px 6px 0",
    cursor: "pointer",
    color: "#fff",
    fontSize: "0.65rem",
    fontWeight: 700,
    boxShadow: open ? "-2px 0 10px rgba(59,130,246,0.3)" : "2px 0 10px rgba(59,130,246,0.3)",
    transition: "right 220ms ease",
    padding: 0,
  }),
  chatHeader: { padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"8px", background:"var(--bg-surface)", flexShrink:0 },
  chatHeaderTitle: { fontWeight:600, fontSize:"0.875rem", color:"var(--fg)", flex:1 },
  chatMessages: { flex:1, overflowY:"auto", overflowX:"hidden", padding:"12px 14px", display:"flex", flexDirection:"column", gap:"8px" },
  msgRow: (m) => ({ display:"flex", justifyContent: m?"flex-end":"flex-start", paddingRight: m?"10px":0, paddingLeft: m?0:"10px" }),
  msgBubble: (m) => ({
    maxWidth:"85%", padding:"8px 12px",
    borderRadius: m?"14px 14px 3px 14px":"14px 14px 14px 3px",
    background: m?"var(--brand)":"var(--bg-card)",
    color: m?"#fff":"var(--fg)", fontSize:"0.875rem", lineHeight:1.5,
    boxShadow: m?"0 2px 8px rgba(59,130,246,0.25)":"var(--shadow-xs)", wordBreak:"break-word",
    border: m?"none":"1px solid var(--border)",
  }),
  msgMeta: (m) => ({ fontSize:"0.68rem", color: m?"rgba(255,255,255,0.65)":"var(--fg-subtle)", marginTop:"3px", textAlign: m?"right":"left" }),
  msgSenderName: (m) => ({ fontSize:"0.68rem", fontWeight:600, color: m?"rgba(255,255,255,0.8)":"var(--fg-muted)", marginBottom:"2px" }),
  sysMsg: { textAlign:"center", fontSize:"0.72rem", color:"var(--fg-subtle)", padding:"4px 0", fontStyle:"italic" },
  chatInputBar: { borderTop:"1px solid var(--border)", padding:"10px 12px", display:"flex", gap:"8px", alignItems:"flex-end", background:"var(--bg-surface)", flexShrink:0 },
  chatTextarea: {
    flex:1, resize:"none", border:"1px solid var(--border-hi)",
    borderRadius:"var(--radius)", padding:"8px 12px",
    fontSize:"0.875rem", fontFamily:"inherit",
    background:"var(--bg-input)", color:"var(--fg)",
    outline:"none", lineHeight:1.5, maxHeight:100, overflowY:"auto", transition:"border-color 140ms",
  },
  sendBtn: (d) => ({
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    width:36, height:36, borderRadius:"var(--radius-sm)",
    background: d?"var(--bg-input)":"var(--brand)",
    border: d?"1px solid var(--border)":"none",
    cursor: d?"not-allowed":"pointer",
    color: d?"var(--fg-subtle)":"#fff", flexShrink:0, transition:"all 140ms",
    boxShadow: d?"none":"0 2px 8px rgba(59,130,246,0.3)",
  }),
  videoArea: { position:"relative", background:"#0a0a0f", aspectRatio:"16/9", overflow:"hidden", minHeight:180 },
  remoteVideo: { width:"100%", height:"100%", objectFit:"cover", display:"block" },
  videoControls: { display:"flex", justifyContent:"center", alignItems:"center", gap:"10px", padding:"12px 16px", background:"var(--bg-surface)", borderTop:"1px solid var(--border)" },
  ctrlBtn: (active, danger) => ({
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    width:42, height:42, borderRadius:"50%", cursor:"pointer",
    border:"1.5px solid",
    borderColor: danger?"var(--danger)": active?"var(--brand)":"var(--border-hi)",
    background: danger?"var(--danger)": active?"var(--brand-dim)":"rgba(255,255,255,0.04)",
    color: danger?"#fff": active?"var(--brand)":"var(--fg)",
    transition:"all 140ms", flexShrink:0,
  }),
  callBtn: (color) => ({
    display:"inline-flex", alignItems:"center", justifyContent:"center", gap:"6px",
    padding:"8px 18px", borderRadius:"var(--radius)",
    border:"none", cursor:"pointer", fontWeight:600, fontSize:"0.875rem",
    background: color==="green"
      ? "linear-gradient(135deg,#16a34a,#22c55e)"
      : color==="red"
      ? "linear-gradient(135deg,#dc2626,#ef4444)"
      : "linear-gradient(135deg,#114592,#0081C6)",
    color:"#fff", transition:"opacity 120ms",
  }),
  reportCard: {
    padding:"16px", borderRadius:"var(--radius-lg)", border:"1px solid var(--border)",
    background:"var(--bg-card)", display:"grid", gap:"14px",
    boxShadow:"var(--shadow-sm)",
  },
  reportHeader: { display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"14px", flexWrap:"wrap" },
  reportStatGrid: { display:"grid", gridTemplateColumns:"repeat(3,minmax(100px,1fr))", gap:"10px" },
  reportStatCard: { padding:"12px 14px", borderRadius:"var(--radius)", background:"var(--bg-input)", border:"1px solid var(--border)" },
  reportStatLabel: { fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--fg-subtle)", marginBottom:"5px" },
  reportStatValue: { fontSize:"1rem", fontWeight:700, color:"var(--fg)" },
  reportAnalysis: { padding:"14px", borderRadius:"var(--radius)", background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--fg-muted)" },
  reportProgressBar: { width:"100%", height:8, borderRadius:999, background:"var(--bg-input)", overflow:"hidden" },
  reportProgressFill: { height:"100%", background:"var(--success)", borderRadius:999 },
  reportQuestionCard: { padding:"14px", borderRadius:"var(--radius)", background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--fg)" },
  reportQuestionHeader: { display:"flex", justifyContent:"space-between", gap:"14px", alignItems:"center", marginBottom:"10px" },
  reportQuestionText: { fontSize:"0.9rem", fontWeight:600, color:"var(--fg)" },
  reportQuestionMeta: { fontSize:"0.8rem", color:"var(--fg-muted)" },
  reportAnswerText: { fontSize:"0.875rem", color:"var(--fg)" },
  reportSmallText: { fontSize:"0.8rem", color:"var(--fg-muted)" },
};

/* ── component ───────────────────────────────────────────────────────────── */
export default function InterviewRoom() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const toast      = useToast();
  const user       = JSON.parse(localStorage.getItem("user") || "null");
  const token      = localStorage.getItem("token");

  // ── interview / chat ───────────────────────────────────────────────────────
  const [interview,        setInterview]        = useState(null);
  const [loadingInterview, setLoadingInterview] = useState(true);
  const [fetchError,       setFetchError]       = useState("");
  const [cvResponse, setCvResponse] = useState(null);
  const [messages,         setMessages]         = useState([]);
  const [inputText,        setInputText]        = useState("");
  const [connected,        setConnected]        = useState(false);
  const [onlineUserIds,    setOnlineUserIds]    = useState(new Set());
  const [quiz,             setQuiz]             = useState(null);
  const [quizLoading,      setQuizLoading]      = useState(false);
  const [quizError,        setQuizError]        = useState("");
  const [quizResult,       setQuizResult]       = useState(null);
  const [quizResultLoading,setQuizResultLoading]= useState(false);
  const [quizResultError,  setQuizResultError]  = useState("");
  const [selectedOption,   setSelectedOption]   = useState("");
  const [quizActionMessage,setQuizActionMessage]= useState("");
  const [tabAlert,         setTabAlert]         = useState("");
  const [questionTimer,    setQuestionTimer]    = useState(30);

  const recruiter    = interview?.recruiter;
  const candidate    = interview?.candidate;
  const isCandidate  = user?.role === "candidate";
  const isRecruiter  = user?.role === "recruiter";
  const quizTotalQuestions = quiz?.questions?.length ?? quiz?.totalQuestions ?? 0;
  const quizAnsweredCount = quiz?.answers?.length ?? quiz?.answeredCount ?? 0;
  const quizStatus = quiz?.status || "none";
  const hasQuizQuestions = Array.isArray(quiz?.questions) && quiz.questions.length > 0;
  const shouldShowGenerateButton = !quizLoading && isRecruiter && (!quiz || !hasQuizQuestions || quizStatus === "none");
  const shouldShowCandidateWaiting = !quizLoading && isCandidate && (!quiz || quizStatus === "none");
  const isQuizReadyToStart = quizStatus === "ready" && hasQuizQuestions;
  const isQuizInProgress = quizStatus === "in_progress";
  const isQuizCompleted = quizStatus === "completed";
  const quizCorrectCount = quizResult?.answers?.filter((a) => a.isCorrect).length ?? 0;
  const quizWrongCount = (quizResult?.answers?.length ?? 0) - quizCorrectCount;
  const quizResultScore = quizResult?.score ?? quiz?.score ?? 0;
  const quizResultPass = quizResult?.passed;
  const quizResultJobLabel = quizResult?.jobTitle || quizResult?.jobPosition || interview?.job?.title || interview?.job?.position || "Unknown";
  const quizAnalysis = useMemo(() => generateQuizAnalysis(quizResult), [quizResult]);

  const renderQuizReport = () => {
    if (quizResultLoading) {
      return (
        <div style={{ padding:"1rem", borderRadius:"var(--radius)", border:"1px solid var(--border)", background:"var(--muted)" }}>
          Loading saved report…
        </div>
      );
    }

    if (!quizResult) {
      return (
        <div style={{ padding:"0.85rem", borderRadius:"var(--radius)", border:"1px solid var(--border)", background:"var(--muted)", color:"var(--muted-foreground)" }}>
          No saved quiz result was found yet.
        </div>
      );
    }

    return (
      <Motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ ...S.reportCard, position: "relative", overflow: "hidden", boxShadow: "var(--shadow-brand)" }}
      >
        <div style={{
          position: "absolute", top: "-30%", right: "-8%", width: 220, height: 220,
          borderRadius: "50%", filter: "blur(56px)", opacity: 0.5, pointerEvents: "none",
          background: quizResultPass ? "var(--success-dim)" : "var(--danger-dim)",
        }} />
        <div style={{ ...S.reportHeader, position: "relative" }}>
          <div>
            <div style={{ fontSize:"1rem", fontWeight:700, color:"var(--fg)" }}>Quiz result report</div>
            <div style={{ fontSize:"0.88rem", color:"var(--fg-muted)", marginTop:"0.3rem" }}>
              {quizResultJobLabel} · {quizResult.candidate?.name || candidate?.name || "Candidate"}
            </div>
          </div>
          <div style={{ display:"grid", gap:"0.55rem" }}>
            <span style={{ padding:"0.35rem 0.75rem", borderRadius:999, background:quizResultPass ? "var(--success-dim)" : "var(--danger-dim)", color:quizResultPass ? "var(--success)" : "var(--danger)", fontWeight:700, border:`1px solid ${quizResultPass ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
              {quizResultPass ? "Passed" : "Needs review"}
            </span>
            <span style={{ padding:"0.35rem 0.75rem", borderRadius:999, background:"var(--brand-dim)", color:"var(--brand)", fontWeight:700, border:"1px solid rgba(59,130,246,0.3)" }}>
              {quizResultScore}% score
            </span>
          </div>
        </div>

        <div style={S.reportStatGrid}>
          {[
            { label: "Questions", value: quizResult.totalQuestions },
            { label: "Answered", value: quizResult.answeredCount },
            { label: "Incorrect", value: quizWrongCount },
          ].map((s, i) => (
            <TiltCard key={s.label} maxTilt={4} style={S.reportStatCard}>
              <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.05 }}>
                <div style={S.reportStatLabel}>{s.label}</div>
                <div style={S.reportStatValue}>{s.value}</div>
              </Motion.div>
            </TiltCard>
          ))}
        </div>

        <div style={S.reportAnalysis}>
          <div style={{ fontWeight:700, marginBottom:"0.75rem", color:"var(--fg)" }}>Report analysis</div>
          <div style={S.reportSmallText}>{quizAnalysis}</div>
          <div style={{ marginTop:"1rem", fontSize:"0.82rem", color:"var(--fg-muted)" }}>
            This summary is based on the completed quiz answers and highlights the candidate's strengths and most important improvement areas.
          </div>
        </div>

        <div style={{ display:"grid", gap:"0.75rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:"1rem", alignItems:"center" }}>
            <div style={{ fontWeight:700, color:"var(--fg)" }}>Performance breakdown</div>
            <div style={{ fontSize:"0.82rem", color:"var(--fg-muted)" }}>
              {Math.max(0, Math.min(100, quizResultScore))}% correct
            </div>
          </div>
          <div style={S.reportProgressBar}>
            <div style={{ ...S.reportProgressFill, width:`${Math.max(0, Math.min(100, quizResultScore))}%` }} />
          </div>
        </div>

        <div style={{ display:"grid", gap:"0.85rem" }}>
          {quizResult.questions.map((question, idx) => {
            const answer = (quizResult.answers || []).find((a) => a.questionId === question.questionId);
            const correct = answer?.isCorrect;
            return (
              <Motion.div
                key={question.questionId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx, 10) * 0.04 }}
                style={S.reportQuestionCard}
              >
                <div style={S.reportQuestionHeader}>
                  <div style={S.reportQuestionText}>{idx + 1}. {question.prompt || question.question}</div>
                  <span style={{ padding:"0.3rem 0.65rem", borderRadius:999, background:correct ? "var(--success-dim)" : "var(--danger-dim)", color:correct ? "var(--success)" : "var(--danger)", fontSize:"0.75rem", fontWeight:700, border:`1px solid ${correct ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                    {correct ? "Correct" : "Incorrect"}
                  </span>
                </div>
                <div style={{ display:"grid", gap:"0.6rem" }}>
                  <div style={S.reportSmallText}>Candidate answer</div>
                  <div style={S.reportAnswerText}>{answer?.answer || "No answer provided"}</div>
                  <div style={S.reportSmallText}>Correct answer</div>
                  <div style={S.reportAnswerText}>{question.correctAnswer}</div>
                </div>
              </Motion.div>
            );
          })}
        </div>
      </Motion.div>
    );
  };

  // ── video call ─────────────────────────────────────────────────────────────
  // callState: "idle" | "calling" | "incoming" | "in-call"
  const [callState,      setCallState]      = useState("idle");
  const [localMuted,     setLocalMuted]     = useState(false);
  const [localVideoOff,  setLocalVideoOff]  = useState(false);
  const [isScreenSharing,setIsScreenSharing]= useState(false);
  // React-tracked streams so effects re-run when streams arrive
  const [localStream,    setLocalStream]    = useState(null);
  const [remoteStream,   setRemoteStream]   = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);


  // ── refs ────────────────────────────────────────────────────────────────────
  const socketRef           = useRef(null);
  const messagesEndRef      = useRef(null);
  const textareaRef         = useRef(null);
  const localVideoRef       = useRef(null);
  const remoteVideoRef      = useRef(null);
  const localStreamRef      = useRef(null);   // ref mirror of localStream state
  const peerRef             = useRef(null);
  const pendingCandidatesRef= useRef([]);
  const callStateRef        = useRef("idle"); // readable from socket callbacks
  const isScreenSharingRef  = useRef(false);
  const endCallLocalRef     = useRef(null);   // set inside socket effect
  const analyserRef  = useRef(null);
const animFrameRef = useRef(null);

  /* ── callStateRef sync ───────────────────────────────────────────────────── */
  const setCallStateSync = (s) => {
    callStateRef.current = s;
    setCallState(s);
  };

  const startVoiceActivity = (stream) => {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  analyserRef.current = { analyser, ctx };
  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    setIsSpeaking(avg > 10);
    animFrameRef.current = requestAnimationFrame(tick);
  };
  tick();
};

const stopVoiceActivity = () => {
  if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  analyserRef.current?.ctx.close();
  analyserRef.current = null;
  setIsSpeaking(false);
};

  /* ── assign streams to video elements whenever stream or callState changes ─ */
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  /* ── build RTCPeerConnection ─────────────────────────────────────────────── */
  const buildPC = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    localStreamRef.current?.getTracks().forEach((t) =>
      pc.addTrack(t, localStreamRef.current)
    );

    // Remote stream arrives — use state so useEffect re-assigns after render
    pc.ontrack = ({ streams: [stream] }) => {
      setRemoteStream(stream);
    };

    // Send ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate)
        socketRef.current?.emit("webrtc-ice-candidate", { interviewId: id, candidate });
    };

    // Handle connection drop
    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState))
        endCallLocalRef.current?.();
    };

    peerRef.current = pc;
    return pc;
  };

  /* ── fetch interview ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    api.get(`/interviews/${id}`)
      .then((res) => setInterview(res.data))
      .catch((err) => setFetchError(err.response?.data?.message || "Interview not found."))
      .finally(() => setLoadingInterview(false));
  }, [id, token, navigate]);

  /* Fetch candidate CV (recruiter only); loading follows the requested candidate. */
  const cvCandidateId = isRecruiter ? interview?.candidate?._id : null;
  const cvInfoLoading = Boolean(cvCandidateId && cvResponse?.candidateId !== cvCandidateId);
  const cvInfo = cvResponse?.candidateId === cvCandidateId ? cvResponse?.data : null;
  useEffect(() => {
    if (!cvCandidateId) return;
    let active = true;
    api.get(`/users/candidates/${cvCandidateId}/cv-info`)
      .then((r) => {
        if (active) setCvResponse({ candidateId: cvCandidateId, data: r.data });
      })
      .catch(() => {
        if (active) setCvResponse({ candidateId: cvCandidateId, data: null });
      });
    return () => { active = false; };
  }, [cvCandidateId]);

  const fetchQuiz = useCallback(() => {
    if (!id) return;
    return api.get(`/interviews/${id}/quiz`).then((res) => {
      setQuiz(res.data.quiz);
    }).catch((err) => {
      setQuizError(err.response?.data?.message || "Unable to load quiz state.");
      setQuiz(null);
    }).finally(() => {
      setQuizLoading(false);
    });
  }, [id]);

  const loadQuizState = useCallback(() => {
    if (!id) return;
    setQuizLoading(true);
    setQuizError("");
    return fetchQuiz();
  }, [id, fetchQuiz]);

  const fetchQuizResult = useCallback(() => {
    if (!id) return;
    return api.get(`/interviews/${id}/quiz/result`).then((res) => {
      setQuizResult(res.data.quizResult);
    }).catch((err) => {
      setQuizResultError(err.response?.data?.message || "Unable to load quiz result.");
      setQuizResult(null);
    }).finally(() => {
      setQuizResultLoading(false);
    });
  }, [id]);

  const loadQuizResult = useCallback(() => {
    if (!id) return;
    setQuizResultLoading(true);
    setQuizResultError("");
    return fetchQuizResult();
  }, [id, fetchQuizResult]);

  useEffect(() => {
    if (!token || !interview) return;
    fetchQuiz();
  }, [interview, token, fetchQuiz]);

  const [previousInterview, setPreviousInterview] = useState(null);
  if (previousInterview !== interview) {
    setPreviousInterview(interview);
    if (token && interview) {
      setQuizLoading(true);
      setQuizError("");
    }
  }

  const [previousQuiz, setPreviousQuiz] = useState(null);
  if (previousQuiz !== quiz) {
    setPreviousQuiz(quiz);
    if (quiz?.status === "completed") {
      setQuizResultLoading(true);
      setQuizResultError("");
    } else {
      setQuizResult(null);
    }
  }
  useEffect(() => {
    if (quiz?.status === "completed") fetchQuizResult();
  }, [quiz, fetchQuizResult]);

  useEffect(() => {
    if (!isCandidate || !connected || !socketRef.current || !id) return;

    const sendVisibility = () => {
      const hidden = document.visibilityState !== "visible";
      const eventName = hidden ? "candidate-tab-hidden" : "candidate-tab-visible";
      socketRef.current.emit(eventName, { interviewId: id });
    };

    document.addEventListener("visibilitychange", sendVisibility);
    sendVisibility();
    return () => document.removeEventListener("visibilitychange", sendVisibility);
  }, [isCandidate, id, connected]);

  useEffect(() => {
    if (!tabAlert) return;
    const timer = setTimeout(() => setTabAlert(""), 8000);
    return () => clearTimeout(timer);
  }, [tabAlert]);

  // 30s per-question countdown for candidate
  // Use a ref for selectedOption so the interval always sees the latest value
  const selectedOptionRef = useRef("");
  useEffect(() => { selectedOptionRef.current = selectedOption; }, [selectedOption]);

  const autoSubmitAnswer = useCallback(async (questionId, answer) => {
    if (!id || !questionId) return;
    setQuizLoading(true);
    setQuizError("");
    try {
      const res = await api.post(`/interviews/${id}/quiz/answer`, {
        questionId,
        answer: answer || "No answer",
      });
      setQuiz(res.data.quiz);
      setSelectedOption("");
      // if quiz completed (no more currentQuestion), trigger completion
      if (!res.data.quiz?.currentQuestion && res.data.quiz?.status !== "completed") {
        // all questions answered — recruiter completes, candidate just waits
      }
    } catch (err) {
      setQuizError(err.response?.data?.message || "Unable to submit answer.");
    } finally {
      setQuizLoading(false);
    }
  }, [id]);

  const currentQuestionId = quiz?.currentQuestion?.questionId;
  const timerActive = isCandidate && quiz?.status === "in_progress" && Boolean(currentQuestionId);
  const timerKey = timerActive ? currentQuestionId : null;
  const [previousTimerKey, setPreviousTimerKey] = useState(null);
  if (previousTimerKey !== timerKey) {
    setPreviousTimerKey(timerKey);
    if (timerActive) setQuestionTimer(30);
  }
  useEffect(() => {
    if (!timerActive) return;
    let remaining = 30;
    const interval = setInterval(() => {
      remaining -= 1;
      setQuestionTimer(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        autoSubmitAnswer(currentQuestionId, selectedOptionRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentQuestionId, timerActive, autoSubmitAnswer]);

  const handleGenerateQuiz = async () => {
    if (!id) return;
    setQuizLoading(true);
    setQuizError("");
    setQuizActionMessage("Generating quiz...");
    // clear stale result so old questions don't flash
    setQuizResult(null);
    try {
      const res = await api.post(`/interviews/${id}/quiz/generate`);
      setQuiz(res.data.quiz);
      setQuizActionMessage("Quiz generated. Start it when ready.");
    } catch (err) {
      setQuizError(err.response?.data?.message || "Unable to generate quiz.");
      setQuizActionMessage("");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!id) return;
    setQuizLoading(true);
    setQuizError("");
    setQuizActionMessage("Starting quiz...");
    try {
      const res = await api.post(`/interviews/${id}/quiz/start`);
      setQuiz(res.data.quiz);
      setQuizActionMessage("Quiz started.");
    } catch (err) {
      setQuizError(err.response?.data?.message || "Unable to start quiz.");
      setQuizActionMessage("");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!quiz?.currentQuestion) {
      setQuizError("No active question.");
      return;
    }
    if (!selectedOption) {
      setQuizError("Please select an answer before submitting.");
      return;
    }
    setQuizLoading(true);
    setQuizError("");
    setQuizActionMessage("Submitting answer...");

    try {
      const res = await api.post(`/interviews/${id}/quiz/answer`, {
        questionId: quiz.currentQuestion.questionId,
        answer: selectedOption,
      });
      setQuiz(res.data.quiz);
      setSelectedOption("");
      setQuizActionMessage("Answer submitted.");
    } catch (err) {
      setQuizError(err.response?.data?.message || "Unable to submit answer.");
      setQuizActionMessage("");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleCompleteQuiz = async () => {
    if (!id) return;
    setQuizLoading(true);
    setQuizError("");
    setQuizActionMessage("Completing quiz...");
    try {
        const res = await api.post(`/interviews/${id}/quiz/complete`);
      setQuiz(res.data.quiz);
      setQuizActionMessage("Quiz completed.");
    } catch (err) {
      setQuizError(err.response?.data?.message || "Unable to complete quiz.");
      setQuizActionMessage("");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleStopQuiz = async () => {
    if (!id) return;
    setQuizLoading(true);
    setQuizError("");
    setQuizActionMessage("Stopping quiz...");
    try {
      const res = await api.post(`/interviews/${id}/quiz/complete`);
      setQuiz(res.data.quiz);
      setQuizActionMessage("Quiz stopped.");
    } catch (err) {
      setQuizError(err.response?.data?.message || "Unable to stop quiz.");
      setQuizActionMessage("");
    } finally {
      setQuizLoading(false);
    }
  };

  /* ── socket + WebRTC signaling ───────────────────────────────────────────── */
  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      upgrade: true,
      path: "/socket.io",
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    /* local cleanup — no socket emit */
    function endCallLocal() {
      if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      callStateRef.current   = "idle";
      isScreenSharingRef.current = false;
      pendingCandidatesRef.current = [];
      setCallState("idle");
      setLocalMuted(false);
      setLocalVideoOff(false);
      setIsScreenSharing(false);
      setLocalStream(null);
      stopVoiceActivity();
      setRemoteStream(null);
    }
    endCallLocalRef.current = endCallLocal;

    /* flush queued ICE candidates */
    async function flushICE() {
      const arr = [...pendingCandidatesRef.current];
      pendingCandidatesRef.current = [];
      for (const c of arr) {
        try { await peerRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch { /* Best effort: the peer or camera may no longer be available. */ }
      }
    }

    /* ── chat events ─────────────────────────────────────────────────────── */
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-room", { interviewId: id, userName: user?.name || "User" });
    });
    socket.on("disconnect", () => { setConnected(false); setOnlineUserIds(new Set()); });
    socket.on("message-history", (h) => setMessages(h.map((m) => ({ ...m, _type:"msg" }))));
    socket.on("message",    (msg) => setMessages((p) => [...p, { ...msg, _type:"msg" }]));
    socket.on("user-joined", ({ userName, timestamp }) =>
      setMessages((p) => [...p, { id:`sys-${Date.now()}`, _type:"sys", text:`${userName} joined the room`, timestamp }]));
    socket.on("user-left", ({ userName, timestamp }) =>
      setMessages((p) => [...p, { id:`sys-${Date.now()}`, _type:"sys", text:`${userName} left the room`, timestamp }]));
    socket.on("presence-update", (list) =>
      setOnlineUserIds(new Set(list.map((u) => u.userId))));
    socket.on("interview-status-updated", (s) =>
      setInterview((p) => ({ ...p, status: s })));
    socket.on("quiz:generated", () => loadQuizState());
    socket.on("quiz:started", () => loadQuizState());
    socket.on("quiz:answer-submitted", () => loadQuizState());
    socket.on("quiz:progress-updated", () => loadQuizState());
    socket.on("quiz:completed", () => {
      loadQuizState();
      loadQuizResult();
    });
    socket.on("candidate-tab-hidden", ({ userName }) => {
      if (user?.role === "recruiter") {
        setTabAlert(`${userName} switched away from the interview tab.`);
      }
    });
    socket.on("candidate-tab-visible", ({ userName }) => {
      if (user?.role === "recruiter") {
        setTabAlert(`${userName} returned to the interview tab.`);
      }
    });
    socket.on("connect_error", (e) => console.error("[socket]", e.message));

    /* ── WebRTC: incoming call ────────────────────────────────────────────── */
    socket.on("webrtc-call-request", () => {
      if (callStateRef.current === "idle") {
        callStateRef.current = "incoming";
        setCallState("incoming");
      }
    });

    /* ── WebRTC: callee accepted — we're the initiator, send offer ─────────
       NOTE: getUserMedia was already called in startCall() (user-gesture).
       We must NOT call getUserMedia here — no user gesture in socket handler. */
    socket.on("webrtc-call-accept", async () => {
      if (!localStreamRef.current) {
        // Stream not available (should not happen); abort gracefully
        console.error("[webrtc] No local stream available for offer");
        callStateRef.current = "idle";
        setCallState("idle");
        return;
      }
      callStateRef.current = "in-call";
      setCallState("in-call");
      try {
        const pc = buildPC();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc-offer", { interviewId: id, offer });
      } catch (err) {
        console.error("[webrtc] Error creating offer:", err);
        endCallLocal();
      }
    });

    /* ── WebRTC: call rejected ───────────────────────────────────────────── */
    socket.on("webrtc-call-reject", () => {
      if (callStateRef.current === "calling") {
        // Stop pre-acquired stream
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        callStateRef.current = "idle";
        setCallState("idle");
      }
    });

    /* ── WebRTC: receive offer (we're the callee) ────────────────────────── */
    socket.on("webrtc-offer", async ({ offer }) => {
      // Defensive: if PC isn't ready yet (shouldn't happen after fix, but just in case)
      if (!peerRef.current) {
        console.warn("[webrtc] offer arrived before PC was built — ignoring");
        return;
      }
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        await flushICE();
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit("webrtc-answer", { interviewId: id, answer });
      } catch (err) { console.error("[webrtc] offer error:", err); }
    });

    /* ── WebRTC: receive answer (we're the initiator) ────────────────────── */
    socket.on("webrtc-answer", async ({ answer }) => {
      if (!peerRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await flushICE();
      } catch (err) { console.error("[webrtc] answer error:", err); }
    });

    /* ── WebRTC: ICE candidate ───────────────────────────────────────────── */
    socket.on("webrtc-ice-candidate", async ({ candidate }) => {
      try {
        if (peerRef.current?.remoteDescription)
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        else
          pendingCandidatesRef.current.push(candidate);
      } catch (err) { console.error("[webrtc] ICE error:", err); }
    });

    /* ── WebRTC: other side ended call ───────────────────────────────────── */
    socket.on("webrtc-call-end", () => endCallLocal());

    return () => {
      endCallLocal();
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  /* ── auto-scroll chat ────────────────────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ══════════════════ CALL CONTROLS ══════════════════════════════════════════
   * getUserMedia must be called from a user-gesture handler (click).
   * So the initiator acquires the stream in startCall(), not in the socket handler.
   * ═════════════════════════════════════════════════════════════════════════ */

  const startCall = async () => {
    try {
      // Acquire media HERE (user-gesture context) before emitting
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);          // triggers effect → assigns to localVideoRef
      startVoiceActivity(stream);
      setCallStateSync("calling");
      socketRef.current?.emit("webrtc-call-request", { interviewId: id });
    } catch (err) {
      console.error("[webrtc] getUserMedia denied:", err);
      toast.error("Could not access camera/microphone. Please allow permissions and try again.");
    }
  };

  const cancelCall = () => {
    // Stop pre-acquired stream
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setCallStateSync("idle");
  };

  const rejectCall = () => {
    setCallStateSync("idle");
    socketRef.current?.emit("webrtc-call-reject", { interviewId: id });
  };

  const acceptCall = async () => {
    // Accept button = user gesture → safe to call getUserMedia.
    // CRITICAL: acquire media + build PC BEFORE emitting webrtc-call-accept.
    // If we signal first, the initiator sends an offer immediately and it
    // arrives before peerRef.current is set → offer handler returns early → no connection.
    let stream = localStreamRef.current;
    let usedFallback = false;

    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        if (err?.name === "NotReadableError") {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            usedFallback = true;
          } catch (audioErr) {
            stream = null;
            console.warn("[webrtc] audio fallback failed:", audioErr);
          }
        } else {
          stream = null;
        }
      }
    }

    try {
      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);          // triggers effect → assigns to localVideoRef
        startVoiceActivity(stream);
      }
      buildPC();                       // peerRef.current is now set before offer arrives
      setCallStateSync("in-call");
      socketRef.current?.emit("webrtc-call-accept", { interviewId: id }); // signal last

      if (usedFallback) {
        toast.warning("Camera was unavailable; joined with audio only for testing.");
      }
    } catch (err) {
      console.error("[webrtc] accept failed:", err);
      if (err?.name === "NotReadableError") {
        toast.error("Camera or microphone is currently in use by another application. Close any other app or tab using the device, then try again.");
      } else {
        toast.error("Could not access camera/microphone. Please allow permissions and try again.");
      }
      endCallLocalRef.current?.();
    }
  };

  const endCall = () => {
    socketRef.current?.emit("webrtc-call-end", { interviewId: id });
    endCallLocalRef.current?.();
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setLocalMuted((m) => !m);
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setLocalVideoOff((v) => !v);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharingRef.current) {
      // Switch back to camera
      try {
        const cs  = await navigator.mediaDevices.getUserMedia({ video: true });
        const ct  = cs.getVideoTracks()[0];
        const sndr = peerRef.current?.getSenders().find((s) => s.track?.kind === "video");
        if (sndr) await sndr.replaceTrack(ct);
        localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
        const at  = localStreamRef.current?.getAudioTracks() ?? [];
        const ns  = new MediaStream([ct, ...at]);
        localStreamRef.current = ns;
        setLocalStream(ns);
        isScreenSharingRef.current = false;
        setIsScreenSharing(false);
      } catch (err) { console.error("[webrtc] switch to camera:", err); }
    } else {
      try {
        const ss  = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const st  = ss.getVideoTracks()[0];
        const sndr = peerRef.current?.getSenders().find((s) => s.track?.kind === "video");
        if (sndr) await sndr.replaceTrack(st);
        const at  = localStreamRef.current?.getAudioTracks() ?? [];
        const ns  = new MediaStream([st, ...at]);
        localStreamRef.current = ns;
        setLocalStream(ns);
        // User stops via browser chrome (stop-sharing button)
        st.onended = async () => {
          if (!isScreenSharingRef.current) return;
          try {
            const cs2 = await navigator.mediaDevices.getUserMedia({ video: true });
            const ct2 = cs2.getVideoTracks()[0];
            const sn2 = peerRef.current?.getSenders().find((s) => s.track?.kind === "video");
            if (sn2) await sn2.replaceTrack(ct2);
            const at2 = localStreamRef.current?.getAudioTracks() ?? [];
            const ns2 = new MediaStream([ct2, ...at2]);
            localStreamRef.current = ns2;
            setLocalStream(ns2);
          } catch { /* Best effort: the peer or camera may no longer be available. */ }
          isScreenSharingRef.current = false;
          setIsScreenSharing(false);
        };
        isScreenSharingRef.current = true;
        setIsScreenSharing(true);
      } catch (err) { console.error("[webrtc] screen share:", err); }
    }
  };

  /* ── chat ────────────────────────────────────────────────────────────────── */
  const sendMessage = () => {
    const text = inputText.trim();
    if (!text || !socketRef.current?.connected) return;
    socketRef.current.emit("send-message", { interviewId: id, text });
    setInputText("");
    textareaRef.current?.focus();
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  /* ── loading / error ─────────────────────────────────────────────────────── */
  if (loadingInterview)
    return (
      <div style={{ ...S.page, alignItems:"center", justifyContent:"center" }}>
        <div style={{ color:"var(--muted-foreground)", fontSize:"0.9rem" }}>Loading interview…</div>
      </div>
    );

  if (fetchError)
    return (
      <div style={{ ...S.page, alignItems:"center", justifyContent:"center", gap:"1rem" }}>
        <div style={{ color:"var(--destructive)", fontWeight:600 }}>{fetchError}</div>
        <button style={S.backBtn} onClick={() => navigate("/dashboard")}>
          <ArrowLeftIcon size={14} /> Back to dashboard
        </button>
      </div>
    );

  /* ── render ──────────────────────────────────────────────────────────────── */
  return (
    <div style={S.page}>

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header style={S.topbar}>
        <button style={S.backBtn} onClick={() => navigate("/dashboard")}>
          <ArrowLeftIcon size={14} /> Dashboard
        </button>
        <img src={LOGO_URL} alt="logo" style={S.logo} />
        <span style={S.topbarTitle}>{interview?.title || "Interview Room"}</span>
        <div style={S.topbarRight}>
          <span style={{
            display:"flex", alignItems:"center", gap:"0.4rem",
            padding:"0.3rem 0.65rem", borderRadius:"9999px",
            border:`1px solid ${connected?"#16a34a40":"#ef444440"}`,
            background: connected?"#f0fdf4":"#fef2f2", transition:"all 300ms",
          }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background: connected?"#16a34a":"#ef4444", flexShrink:0, animation: connected?"pulse-green 2s infinite":"none" }} />
            <span style={{ fontSize:"0.75rem", fontWeight:600, color: connected?"#16a34a":"#ef4444" }}>
              {connected ? "Connected" : "Disconnected"}
            </span>
          </span>
          <Badge variant={statusVariant(interview?.status)}>
            <ClockIcon size={10} /> {statusLabel(interview?.status)}
          </Badge>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ ...S.body, position: "relative" }}>

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div style={S.mainPanel(chatOpen)}>

          {/* Interview info */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <CalendarIcon size={15} style={{ color:"var(--brand)" }} />
              <span style={S.cardHeaderTitle}>Interview Details</span>
            </div>
            <div style={S.cardBody}>
              <div style={S.detailGrid}>
                <div>
                  <div style={S.detailLabel}>Title</div>
                  <div style={S.detailValue}>{interview?.title || "—"}</div>
                </div>
                <div>
                  <div style={S.detailLabel}>Scheduled At</div>
                  <div style={S.detailValue}>{formatDate(interview?.scheduledAt)}</div>
                </div>
                <div>
                  <div style={S.detailLabel}>Status</div>
                  <Badge variant={statusVariant(interview?.status)}>{statusLabel(interview?.status)}</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Quiz card */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <FileTextIcon size={15} style={{ color:"var(--brand)" }} />
              <span style={S.cardHeaderTitle}>Quiz</span>
            </div>
            <div style={S.cardBody}>
              {quizLoading && (
                <div style={S.futurePlaceholder}>
                  <div style={S.futureTitle}>Loading quiz…</div>
                  <div style={S.futureSubtitle}>Please wait while quiz state is retrieved.</div>
                </div>
              )}

              {!quizLoading && quizError && (
                <div style={{ color:"#dc2626", marginBottom:"1rem", fontSize:"0.95rem" }}>
                  {quizError}
                </div>
              )}

              {!quizLoading && quizActionMessage && (
                <div style={{ color:"#114592", marginBottom:"1rem", fontSize:"0.95rem" }}>
                  {quizActionMessage}
                </div>
              )}

              {!quizLoading && tabAlert && isRecruiter && (
                <div style={{ padding:"0.9rem 1rem", borderRadius:"calc(var(--radius) - 2px)", border:"1px solid #fde68a", background:"#fef9c3", color:"#92400e", marginBottom:"1rem" }}>
                  {tabAlert}
                </div>
              )}

              {shouldShowGenerateButton && (
                <div style={{ display:"grid", gap:"1rem" }}>
                  <div style={S.futurePlaceholder}>
                    <div style={S.futureIcon}><FileTextIcon size={22} /></div>
                    <div style={S.futureTitle}>Create a quiz for the candidate</div>
                    <div style={S.futureSubtitle}>Generate a focused technical quiz tailored to the job and start it when you're ready.</div>
                  </div>
                  <button style={S.callBtn("blue")} onClick={handleGenerateQuiz} disabled={quizLoading}>
                    Generate Quiz
                  </button>
                </div>
              )}

              {/* ── Interview Prep Panel (candidate only, before quiz starts) ── */}
              {isCandidate && !isQuizInProgress && !isQuizCompleted && interview?.job && (
                <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
                  <div style={{ padding:"0.875rem 1.125rem", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                    <FileTextIcon size={14} style={{ color:"var(--brand)" }} />
                    <span style={{ fontWeight:600, fontSize:"0.9rem" }}>Interview Preparation</span>
                  </div>
                  <div style={{ padding:"1.125rem", display:"grid", gap:"1rem" }}>
                    <div>
                      <div style={{ fontSize:"0.72rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--muted-foreground)", marginBottom:"0.4rem" }}>Position</div>
                      <div style={{ fontWeight:600, fontSize:"1rem" }}>{interview.job.title}</div>
                      {interview.job.position && interview.job.position !== interview.job.title && (
                        <div style={{ fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.15rem" }}>{interview.job.position}</div>
                      )}
                    </div>

                    {interview.job.description && (
                      <div>
                        <div style={{ fontSize:"0.72rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--muted-foreground)", marginBottom:"0.4rem" }}>About the role</div>
                        <div style={{ fontSize:"0.875rem", lineHeight:1.6, color:"var(--foreground)" }}>{interview.job.description}</div>
                      </div>
                    )}

                    {Array.isArray(interview.job.requiredSkills) && interview.job.requiredSkills.length > 0 && (
                      <div>
                        <div style={{ fontSize:"0.72rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--muted-foreground)", marginBottom:"0.5rem" }}>Required skills</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:"0.4rem" }}>
                          {interview.job.requiredSkills.map((skill) => (
                            <span key={skill} style={{ padding:"0.25rem 0.6rem", borderRadius:999, background:"var(--brand-muted)", color:"var(--brand-muted-foreground)", fontSize:"0.78rem", fontWeight:500 }}>
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
                      {interview.job.experienceLevel && (
                        <div style={{ padding:"0.6rem 0.75rem", borderRadius:"calc(var(--radius) - 2px)", background:"var(--muted)", border:"1px solid var(--border)" }}>
                          <div style={{ fontSize:"0.68rem", textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--muted-foreground)", marginBottom:"0.2rem" }}>Level</div>
                          <div style={{ fontWeight:600, fontSize:"0.85rem", textTransform:"capitalize" }}>{interview.job.experienceLevel}</div>
                        </div>
                      )}
                      {interview.job.minExperienceYears > 0 && (
                        <div style={{ padding:"0.6rem 0.75rem", borderRadius:"calc(var(--radius) - 2px)", background:"var(--muted)", border:"1px solid var(--border)" }}>
                          <div style={{ fontSize:"0.68rem", textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--muted-foreground)", marginBottom:"0.2rem" }}>Min. experience</div>
                          <div style={{ fontWeight:600, fontSize:"0.85rem" }}>{interview.job.minExperienceYears}+ years</div>
                        </div>
                      )}
                      {interview.job.location && (
                        <div style={{ padding:"0.6rem 0.75rem", borderRadius:"calc(var(--radius) - 2px)", background:"var(--muted)", border:"1px solid var(--border)" }}>
                          <div style={{ fontSize:"0.68rem", textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--muted-foreground)", marginBottom:"0.2rem" }}>Location</div>
                          <div style={{ fontWeight:600, fontSize:"0.85rem" }}>{interview.job.location}</div>
                        </div>
                      )}
                    </div>

                    <div style={{ padding:"0.75rem", borderRadius:"calc(var(--radius) - 2px)", background:"rgba(17,69,146,0.06)", border:"1px solid rgba(0,129,198,0.2)", fontSize:"0.82rem", color:"var(--muted-foreground)", lineHeight:1.6 }}>
                      💡 The quiz will test your knowledge of the skills listed above. Take a moment to review them before it starts.
                    </div>
                  </div>
                </div>
              )}

              {shouldShowCandidateWaiting && (
                <div style={S.futurePlaceholder}>
                  <div style={S.futureIcon}><FileTextIcon size={22} /></div>
                  <div style={S.futureTitle}>Waiting for the recruiter</div>
                  <div style={S.futureSubtitle}>The recruiter will generate and start the quiz during the interview.</div>
                </div>
              )}

              {!quizLoading && quiz && (
                <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", flexWrap:"wrap" }}>
                    <Badge variant={isQuizCompleted ? "success" : isQuizInProgress ? "info" : "warning"}>
                      {isQuizInProgress ? "In progress" : isQuizReadyToStart ? "Ready" : isQuizCompleted ? "Completed" : "Not generated"}
                    </Badge>
                    <span style={{ fontSize:"0.85rem", color:"var(--muted-foreground)" }}>
                      {quizTotalQuestions} questions · {quizAnsweredCount} answered · score {quiz.score ?? 0}
                    </span>
                  </div>

                  {isRecruiter && quiz.status === "ready" && (
                    <div style={{ display:"grid", gap:"0.75rem" }}>
                      <div style={{ fontWeight:600, fontSize:"0.95rem" }}>Quiz is ready to begin.</div>
                      <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
                        <button style={{ ...S.callBtn("blue"), flex:1 }} onClick={handleStartQuiz} disabled={quizLoading}>
                          Start Quiz
                        </button>
                        <button style={{ ...S.callBtn("blue"), flex:"0 0 auto", background:"var(--muted)", color:"var(--foreground)", border:"1px solid var(--border)" }} onClick={handleGenerateQuiz} disabled={quizLoading}>
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}

                  {isRecruiter && quiz.status === "in_progress" && (
                    <div style={{ display:"grid", gap:"0.85rem" }}>
                      <div style={{ fontWeight:600 }}>Quiz in progress</div>
                      <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap", color:"var(--muted-foreground)", fontSize:"0.9rem" }}>
                        <span>{quizTotalQuestions} questions</span>
                        <span>{quizAnsweredCount} answered</span>
                        <span>Score {quiz.score ?? 0}</span>
                      </div>
                      <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
                        <button style={{ ...S.callBtn("green"), flex:1 }} onClick={handleCompleteQuiz} disabled={quizLoading}>
                          Complete Quiz
                        </button>
                        <button style={{ ...S.callBtn("red"), flex:"0 0 auto" }} onClick={handleStopQuiz} disabled={quizLoading}>
                          Stop Quiz
                        </button>
                        <button style={{ ...S.callBtn("blue"), flex:"0 0 auto", background:"var(--muted)", color:"var(--foreground)", border:"1px solid var(--border)" }} onClick={handleGenerateQuiz} disabled={quizLoading}>
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}

                  {isRecruiter && quiz.status === "completed" && (
                    <div style={{ display:"grid", gap:"1rem" }}>
                      <div style={{ display:"grid", gap:"0.75rem" }}>
                        <div style={{ fontWeight:600 }}>Quiz completed</div>
                        <div style={{ fontSize:"0.9rem", color:"var(--muted-foreground)" }}>
                          Candidate answered {quizAnsweredCount} of {quizTotalQuestions} questions and scored {quiz.score ?? 0}.
                        </div>
                        <button style={{ ...S.callBtn("blue"), background:"var(--muted)", color:"var(--foreground)", border:"1px solid var(--border)", justifySelf:"start" }} onClick={handleGenerateQuiz} disabled={quizLoading}>
                          Regenerate Quiz
                        </button>
                      </div>

                      {renderQuizReport()}
                      {quizResultError && (
                        <div style={{ color:"#dc2626", fontSize:"0.85rem" }}>{quizResultError}</div>
                      )}
                    </div>
                  )}

                  {isCandidate && quiz.status === "ready" && (
                    <div style={S.futurePlaceholder}>
                      <div style={S.futureIcon}><ClockIcon size={22} /></div>
                      <div style={S.futureTitle}>Quiz is ready</div>
                      <div style={S.futureSubtitle}>The recruiter will start the quiz when they are ready.</div>
                    </div>
                  )}

                  {isCandidate && quiz.status === "in_progress" && (
                    <div style={{ display:"grid", gap:"1rem" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:"0.75rem", flexWrap:"wrap", alignItems:"center" }}>
                        <div style={{ fontWeight:600, fontSize:"0.95rem" }}>{quiz.currentQuestion?.prompt}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", flexShrink:0 }}>
                          <div style={{ fontSize:"0.85rem", color:"var(--muted-foreground)" }}>
                            Question {quizAnsweredCount + 1} of {quizTotalQuestions}
                          </div>
                          {/* countdown ring */}
                          <div style={{ position:"relative", width:42, height:42, flexShrink:0 }}>
                            <svg width={42} height={42} style={{ transform:"rotate(-90deg)" }}>
                              <circle cx={21} cy={21} r={17} fill="none" stroke="var(--border)" strokeWidth={3} />
                              <circle
                                cx={21} cy={21} r={17} fill="none"
                                stroke={questionTimer <= 10 ? "#ef4444" : questionTimer <= 20 ? "#f97316" : "#22c55e"}
                                strokeWidth={3}
                                strokeDasharray={`${(questionTimer / 30) * 106.8} 106.8`}
                                strokeLinecap="round"
                                style={{ transition:"stroke-dasharray 0.9s linear, stroke 0.3s" }}
                              />
                            </svg>
                            <span style={{
                              position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:"0.72rem", fontWeight:700,
                              color: questionTimer <= 10 ? "#ef4444" : questionTimer <= 20 ? "#f97316" : "var(--foreground)",
                            }}>
                              {questionTimer}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display:"grid", gap:"0.5rem" }}>
                        {(quiz.currentQuestion?.options || []).map((option) => {
                          const selected = selectedOption === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setSelectedOption(option)}
                              style={{
                                width:"100%",
                                textAlign:"left",
                                padding:"0.85rem 1rem",
                                borderRadius:"calc(var(--radius) - 2px)",
                                border:`1px solid ${selected ? "#114592" : "var(--border)"}`,
                                background: selected ? "rgba(17,69,146,0.1)" : "var(--background)",
                                color:"var(--foreground)",
                                cursor:"pointer",
                              }}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                      <button style={S.callBtn("blue")} onClick={handleSubmitAnswer} disabled={quizLoading || !selectedOption}>
                        Submit Answer
                      </button>
                    </div>
                  )}

                  {isCandidate && quiz.status === "completed" && (
                    <div style={{ display:"grid", gap:"1rem" }}>
                      <div style={{ display:"grid", gap:"0.75rem" }}>
                        <div style={{ fontWeight:600 }}>Quiz completed</div>
                        <div style={{ fontSize:"0.9rem", color:"var(--muted-foreground)" }}>
                          Your final score is {quiz.score ?? 0}. Thanks for completing the test.
                        </div>
                      </div>

                      {renderQuizReport()}
                      {quizResultError && (
                        <div style={{ color:"#dc2626", fontSize:"0.85rem" }}>{quizResultError}</div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>

          {/* ══════════════ VIDEO CALL CARD ══════════════ */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <VideoIcon size={15} style={{ color:"var(--brand)" }} />
              <span style={S.cardHeaderTitle}>Video Call</span>
              {callState === "in-call" && (
                <span style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:"0.3rem", fontSize:"0.72rem", fontWeight:700, color:"#16a34a" }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:"#16a34a", animation:"pulse-green 2s infinite" }} />
                  LIVE
                </span>
              )}
              {callState === "calling" && (
                <span style={{ marginLeft:"auto", fontSize:"0.72rem", color:"var(--muted-foreground)", fontStyle:"italic" }}>
                  Ringing…
                </span>
              )}
            </div>

            {/* idle */}
            {callState === "idle" && (
              <div style={{ padding:"1.5rem", display:"flex", flexDirection:"column", alignItems:"center", gap:"0.75rem" }}>
                <div style={S.futureIcon}><VideoIcon size={22} /></div>
                <div style={{ fontSize:"0.875rem", color:"var(--muted-foreground)", textAlign:"center", maxWidth:260 }}>
                  Start a live video call with the other participant. Camera and microphone required.
                </div>
                <button style={S.callBtn("blue")} onClick={startCall} disabled={!connected}>
                  <PhoneIcon size={15} /> Start Video Call
                </button>
              </div>
            )}

            {/* calling — show local preview while ringing */}
            {callState === "calling" && (
              <div style={{ padding:"1.25rem", display:"flex", flexDirection:"column", alignItems:"center", gap:"1rem" }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.5rem" }}>
                  <div style={{ width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg,#114592,#0081C6)", display:"flex", alignItems:"center", justifyContent:"center", animation:"pulse-blue 1.5s infinite" }}>
                    <PhoneIcon size={22} style={{ color:"#fff" }} />
                  </div>
                  <div style={{ fontWeight:600, color:"var(--foreground)" }}>Calling…</div>
                  <div style={{ fontSize:"0.8125rem", color:"var(--muted-foreground)" }}>Waiting for the other participant to answer</div>
                </div>
                {/* small local preview while ringing */}
                {localStream && (
                  <div style={{ position:"relative", width:160, height:100, borderRadius:8, overflow:"hidden", border:"2px solid var(--border)", background:"#111" }}>
                    <video ref={localVideoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  </div>
                )}
                <button style={S.callBtn("red")} onClick={cancelCall}>
                  <PhoneOffIcon size={15} /> Cancel
                </button>
              </div>
            )}

            {/* incoming */}
            {callState === "incoming" && (
              <div style={{ padding:"1.25rem", display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap" }}>
                <div style={{ width:48, height:48, borderRadius:"50%", flexShrink:0, background:"linear-gradient(135deg,#16a34a,#22c55e)", display:"flex", alignItems:"center", justifyContent:"center", animation:"pulse-green 1s infinite" }}>
                  <PhoneIcon size={20} style={{ color:"#fff" }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, color:"var(--foreground)" }}>Incoming Video Call</div>
                  <div style={{ fontSize:"0.8125rem", color:"var(--muted-foreground)" }}>The other participant wants to start a video call</div>
                </div>
                <div style={{ display:"flex", gap:"0.5rem" }}>
                  <button style={S.callBtn("green")} onClick={acceptCall}>
                    <PhoneIcon size={14} /> Accept
                  </button>
                  <button style={S.callBtn("red")} onClick={rejectCall}>
                    <PhoneOffIcon size={14} /> Decline
                  </button>
                </div>
              </div>
            )}

            {/* in-call */}
            {callState === "in-call" && (
              <>
                <div style={S.videoArea}>
                  {/* ── Remote video — ALWAYS in DOM, ref is always valid ── */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={S.remoteVideo}
                  />
                  {/* Connecting overlay — shown until first track arrives */}
                  {!remoteStream && (
                    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"0.5rem", background:"#111", pointerEvents:"none" }}>
                      <div style={{ width:64, height:64, borderRadius:"50%", background:"#2a2a2a", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <UserIcon size={28} style={{ color:"#888" }} />
                      </div>
                      <span style={{ color:"#888", fontSize:"0.8rem" }}>Connecting…</span>
                    </div>
                  )}

                  {/* ── Local video PiP — ALWAYS in DOM, ref is always valid ── */}
                  <div style={{
  position: "absolute", bottom: 64, right: 10,
  width: 130, height: 88, borderRadius: 8,
  border: isSpeaking ? "2px solid #22c55e" : "2px solid rgba(255,255,255,0.35)",
  boxShadow: isSpeaking ? "0 0 0 3px rgba(34,197,94,0.4), 0 0 12px rgba(34,197,94,0.3)" : "none",
  transition: "border-color 80ms, box-shadow 80ms",
  overflow: "hidden", background: "#1a1a1a",
}}>
  <video
    ref={localVideoRef}
    autoPlay playsInline muted
    style={{ width:"100%", height:"100%", objectFit:"cover", visibility: localVideoOff ? "hidden" : "visible" }}
  />
</div>
{localVideoOff && (
  <div style={{
    position: "absolute", bottom: 64, right: 10,
    width: 130, height: 88, borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#1a1a1a", pointerEvents: "none",
  }}>
    <UserIcon size={22} style={{ color: "#666" }} />
  </div>
)}

                  {/* Screen sharing badge */}
                  {isScreenSharing && (
                    <div style={{ position:"absolute", top:10, left:10, background:"rgba(17,69,146,0.85)", color:"#fff", borderRadius:6, padding:"0.25rem 0.6rem", fontSize:"0.72rem", fontWeight:600, display:"flex", alignItems:"center", gap:"0.35rem" }}>
                      <MonitorIcon size={12} /> Screen sharing
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div style={S.videoControls}>
                  <button style={S.ctrlBtn(localMuted, false)} onClick={toggleMute} title={localMuted ? "Unmute" : "Mute"}>
                    {localMuted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
                  </button>
                  <button style={S.ctrlBtn(localVideoOff, false)} onClick={toggleCamera} title={localVideoOff ? "Camera on" : "Camera off"}>
                    {localVideoOff ? <VideoOffIcon size={18} /> : <VideoIcon size={18} />}
                  </button>
                  <button style={S.ctrlBtn(isScreenSharing, false)} onClick={toggleScreenShare} title={isScreenSharing ? "Stop sharing" : "Share screen"}>
                    <MonitorIcon size={18} />
                  </button>
                  <button style={{ ...S.ctrlBtn(false, true), width:52, height:52 }} onClick={endCall} title="End call">
                    <PhoneOffIcon size={20} />
                  </button>
                </div>
              </>
            )}
          </div>
          {/* ══════════════ END VIDEO CARD ══════════════ */}

          {/* Candidate info (recruiter only) */}
          {isRecruiter && candidate && (
            <div style={S.card}>
              <div style={S.cardHeader}>
                <UserIcon size={15} style={{ color:"var(--brand)" }} />
                <span style={S.cardHeaderTitle}>Candidate Information</span>
                {cvInfoLoading && (
                  <span style={{ marginLeft:"auto", fontSize:"0.72rem", color:"var(--muted-foreground)" }}>Parsing CV…</span>
                )}
              </div>
              <div style={S.cardBody}>
                <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"1.25rem" }}>
                  <Avatar name={candidate.name} profileImage={candidate.profileImage} size={56} />
                  <div>
                    <div style={{ fontWeight:600 }}>{candidate.name}</div>
                    <div className="muted" style={{ fontSize:"0.85rem" }}>{candidate.email}</div>
                  </div>
                </div>
                <div style={S.detailGrid}>
                  <div><div style={S.detailLabel}>Full Name</div><div style={S.detailValue}>{cvInfo?.fullName || candidate.name || "—"}</div></div>
                  <div><div style={S.detailLabel}>Email</div><div style={S.detailValue}>{cvInfo?.email || candidate.email || "—"}</div></div>
                  <div><div style={S.detailLabel}>Phone</div><div style={S.detailValue}>{cvInfo?.phone || "—"}</div></div>
                  <div>
                    <div style={S.detailLabel}>CV</div>
                    {candidate.cv
                      ? <a href={`http://localhost:5000${candidate.cv}`} target="_blank" rel="noreferrer" style={{ color:"var(--brand)", fontWeight:600, textDecoration:"none" }}>View / Download CV</a>
                      : <div style={S.detailValue}>No CV uploaded</div>}
                  </div>
                  {cvInfo?.linkedIn && (
                    <div>
                      <div style={S.detailLabel}>LinkedIn</div>
                      <a href={cvInfo.linkedIn.startsWith("http") ? cvInfo.linkedIn : `https://${cvInfo.linkedIn}`} target="_blank" rel="noreferrer" style={{ color:"var(--brand)", fontSize:"0.85rem", textDecoration:"none" }}>
                        {cvInfo.linkedIn.replace(/https?:\/\/(www\.)?/, "")}
                      </a>
                    </div>
                  )}
                  {cvInfo?.github && (
                    <div>
                      <div style={S.detailLabel}>GitHub</div>
                      <a href={cvInfo.github.startsWith("http") ? cvInfo.github : `https://${cvInfo.github}`} target="_blank" rel="noreferrer" style={{ color:"var(--brand)", fontSize:"0.85rem", textDecoration:"none" }}>
                        {cvInfo.github.replace(/https?:\/\/(www\.)?/, "")}
                      </a>
                    </div>
                  )}
                </div>
                {cvInfo?.summary && (
                  <div style={{ marginTop:"1.25rem" }}>
                    <div style={S.detailLabel}>Summary</div>
                    <div style={{ fontSize:"0.875rem", color:"var(--foreground)", lineHeight:1.55, marginTop:"0.25rem" }}>{cvInfo.summary}</div>
                  </div>
                )}
                {cvInfo?.skills?.length > 0 && (
                  <div style={{ marginTop:"1.25rem" }}>
                    <div style={S.detailLabel}>Skills</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"0.375rem", marginTop:"0.375rem" }}>
                      {cvInfo.skills.map((s, i) => (
                        <span key={i} style={{ padding:"0.2rem 0.6rem", borderRadius:"9999px", fontSize:"0.75rem", fontWeight:500, background:"linear-gradient(135deg,#114592,#0081C6)", color:"#fff" }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {cvInfo?.education?.length > 0 && (
                  <div style={{ marginTop:"1.25rem" }}>
                    <div style={S.detailLabel}>Education</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"0.625rem", marginTop:"0.375rem" }}>
                      {cvInfo.education.map((e, i) => (
                        <div key={i} style={{ fontSize:"0.85rem", lineHeight:1.5 }}>
                          {e.degree && <span style={{ fontWeight:600 }}>{e.degree}</span>}
                          {e.field && <span style={{ color:"var(--muted-foreground)" }}> — {e.field}</span>}
                          {e.institution && <div style={{ color:"var(--muted-foreground)" }}>{e.institution}</div>}
                          {(e.startYear || e.endYear) && <div style={{ fontSize:"0.75rem", color:"var(--muted-foreground)" }}>{e.startYear}{e.startYear && e.endYear ? " – " : ""}{e.endYear}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {cvInfo?.experience?.length > 0 && (
                  <div style={{ marginTop:"1.25rem" }}>
                    <div style={S.detailLabel}>Experience</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem", marginTop:"0.375rem" }}>
                      {cvInfo.experience.map((e, i) => (
                        <div key={i} style={{ fontSize:"0.85rem", lineHeight:1.5 }}>
                          {e.title && <span style={{ fontWeight:600 }}>{e.title}</span>}
                          {e.company && <span style={{ color:"var(--muted-foreground)" }}> @ {e.company}</span>}
                          {(e.startDate || e.endDate) && <div style={{ fontSize:"0.75rem", color:"var(--muted-foreground)" }}>{e.startDate}{e.startDate && e.endDate ? " – " : ""}{e.endDate}</div>}
                          {e.description && <div style={{ color:"var(--muted-foreground)", fontSize:"0.8rem", marginTop:"0.2rem" }}>{e.description.length > 200 ? e.description.slice(0,200)+"…" : e.description}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {cvInfo?.languages?.length > 0 && (
                  <div style={{ marginTop:"1.25rem" }}>
                    <div style={S.detailLabel}>Languages</div>
                    <div style={{ fontSize:"0.875rem", color:"var(--foreground)", marginTop:"0.25rem" }}>{cvInfo.languages.join(" · ")}</div>
                  </div>
                )}
                {cvInfo?.certifications?.length > 0 && (
                  <div style={{ marginTop:"1.25rem" }}>
                    <div style={S.detailLabel}>Certifications</div>
                    <ul style={{ margin:"0.25rem 0 0 1rem", padding:0, fontSize:"0.875rem", color:"var(--foreground)" }}>
                      {cvInfo.certifications.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {!cvInfoLoading && !cvInfo && (
                  <div style={{ marginTop:"1rem", fontSize:"0.82rem", color:"var(--muted-foreground)", fontStyle:"italic" }}>
                    No parsed CV data — candidate hasn't uploaded a CV yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Participants */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <UserIcon size={15} style={{ color:"var(--brand)" }} />
              <span style={S.cardHeaderTitle}>Participants</span>
            </div>
            <div style={{ ...S.cardBody, display:"flex", flexDirection:"column", gap:0 }}>
              {[recruiter, candidate].filter(Boolean).map((p, idx) => {
                const isOnline = onlineUserIds.has(String(p._id));
                return (
                  <div key={p._id} style={{ ...S.participantRow, borderBottom: idx===0?"1px solid var(--border)":"none" }}>
                    <div style={{ position:"relative", flexShrink:0 }}>
                      <Avatar name={p.name} profileImage={p.profileImage} size={40} />
                      <span style={{ position:"absolute", bottom:1, right:1, width:10, height:10, borderRadius:"50%", background: isOnline?"#16a34a":"#d1d5db", border:"2px solid var(--background)", animation: isOnline?"pulse-green 2s infinite":"none" }} />
                    </div>
                    <div style={S.participantInfo}>
                      <span style={S.participantName}>{p.name}</span>
                      <span style={S.participantRole}>{p.role}</span>
                    </div>
                    <div style={{ marginLeft:"auto" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:"0.3rem", padding:"0.2rem 0.55rem", borderRadius:"9999px", fontSize:"0.7rem", fontWeight:600, background: isOnline?"#f0fdf4":"#f9fafb", color: isOnline?"#16a34a":"#6b7280", border:`1px solid ${isOnline?"#16a34a40":"#e5e7eb"}`, whiteSpace:"nowrap" }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background: isOnline?"#16a34a":"#d1d5db" }} />
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          

        </div>

        {/* ── Chat toggle button ──────────────────────────────────────────── */}
        <button
          style={S.chatToggleBtn(chatOpen)}
          onClick={() => setChatOpen(o => !o)}
          title={chatOpen ? "Hide chat" : "Show chat"}
          aria-label={chatOpen ? "Hide chat" : "Show chat"}
        >
          {chatOpen ? "›" : "‹"}
        </button>

        {/* ── Right: live chat ────────────────────────────────────────────── */}
        <div style={S.chatPanel(chatOpen)}>
          <div style={S.chatHeader}>
            <SendIcon size={15} style={{ color:"var(--brand)" }} />
            <span style={S.chatHeaderTitle}>Live Chat</span>
            <span style={{ display:"flex", alignItems:"center", gap:"0.3rem", marginLeft:"auto" }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background: connected?"#16a34a":"#ef4444", flexShrink:0 }} />
              <span style={{ fontSize:"0.72rem", fontWeight:600, color: connected?"#16a34a":"#ef4444" }}>
                {connected ? "Connected" : "Disconnected"}
              </span>
            </span>
          </div>

          <div style={S.chatMessages}>
            {messages.length === 0 && (
              <div style={{ ...S.sysMsg, marginTop:"auto", marginBottom:"auto" }}>No messages yet. Say hi! 👋</div>
            )}
            {messages.map((msg) => {
              if (msg._type === "sys")
                return (
                  <div key={msg.id} style={S.sysMsg}>
                    {msg.text}
                    {msg.timestamp && <span style={{ marginLeft:"0.375rem", opacity:0.7 }}>· {formatTime(msg.timestamp)}</span>}
                  </div>
                );
              const isMine = msg.sender?.id === user?.id;
              return (
                <div key={msg.id} style={S.msgRow(isMine)}>
                  <div style={{ maxWidth:"78%" }}>
                    {!isMine && (
                      <div style={S.msgSenderName(false)}>
                        {msg.sender?.name}
                        {msg.sender?.role && <span style={{ fontWeight:400, marginLeft:"0.25rem" }}>({msg.sender.role})</span>}
                      </div>
                    )}
                    <div style={S.msgBubble(isMine)}>{msg.text}</div>
                    <div style={S.msgMeta(isMine)}>{formatTime(msg.timestamp)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div style={S.chatInputBar}>
            <textarea
              ref={textareaRef}
              rows={1}
              style={S.chatTextarea}
              placeholder={connected ? "Type a message… (Enter to send)" : "Connecting…"}
              value={inputText}
              disabled={!connected}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
            />
            <button
              style={S.sendBtn(!connected || !inputText.trim())}
              disabled={!connected || !inputText.trim()}
              onClick={sendMessage}
              aria-label="Send message"
            >
              <SendIcon size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
