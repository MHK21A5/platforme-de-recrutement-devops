import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { AppShell } from "../components/AppShell";
import { candidateNav } from "../components/nav";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import {
  CalendarIcon,
  ClockIcon,
  VideoIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from "../components/icons";

const BASE_URL = "http://localhost:5000";

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(status) {
  if (status === "finished") return "success";
  if (status === "ongoing") return "info";
  return "warning";
}

function statusLabel(status) {
  if (!status) return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function SkillPill({ skill, highlighted }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.3rem 0.75rem",
        borderRadius: 9999,
        fontSize: "0.8125rem",
        fontWeight: 500,
        background: highlighted
          ? "rgba(0,129,198,0.12)"
          : "var(--muted)",
        color: highlighted ? "var(--brand)" : "var(--foreground)",
        border: `1px solid ${highlighted ? "rgba(0,129,198,0.35)" : "var(--border)"}`,
        transition: "background 120ms",
      }}
    >
      {highlighted && (
        <CheckCircleIcon size={12} style={{ color: "var(--brand)" }} />
      )}
      {skill}
    </span>
  );
}

function PrepCard({ interview, onJoin }) {
  const job = interview.job;
  const isUpcoming = interview.status !== "finished";

  const [tips, setTips] = useState(null);       // null = not loaded yet
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState("");

  const fetchTips = useCallback(async () => {
    setTipsLoading(true);
    setTipsError("");
    setTips(null);
    try {
      const res = await api.post(`/interviews/${interview._id}/prep-tips`);
      setTips(res.data.tips);
    } catch (e) {
      setTipsError(e.response?.data?.message || "Failed to generate tips.");
    } finally {
      setTipsLoading(false);
    }
  }, [interview._id]);

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* ── Colored top strip */}
      <div
        style={{
          height: 4,
          background:
            interview.status === "ongoing"
              ? "linear-gradient(90deg,#2563eb,#0081C6)"
              : interview.status === "finished"
              ? "linear-gradient(90deg,#16a34a,#22c55e)"
              : "linear-gradient(90deg,#0081C6,#38bdf8)",
        }}
      />

      {/* ── Header */}
      <div
        style={{
          padding: "1.25rem 1.5rem",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <span
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--foreground)",
              letterSpacing: "-0.01em",
            }}
          >
            {interview.title}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.8125rem",
              color: "var(--muted-foreground)",
            }}
          >
            <CalendarIcon size={13} />
            {formatDate(interview.scheduledAt)}
          </span>
          {interview.recruiter?.name && (
            <span style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
              Recruiter: <strong style={{ color: "var(--foreground)" }}>{interview.recruiter.name}</strong>
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
          <Badge variant={statusVariant(interview.status)}>
            <ClockIcon size={10} />
            {statusLabel(interview.status)}
          </Badge>
          {isUpcoming && (
            <Button variant="brand" size="sm" onClick={() => onJoin(interview._id)}>
              <VideoIcon size={12} /> Join Room
            </Button>
          )}
        </div>
      </div>

      {/* ── Job details */}
      {job ? (
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Job title + meta */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--brand)",
                marginBottom: "0.1rem",
              }}
            >
              Job Position
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--foreground)" }}>
              {job.title}
              {job.position ? (
                <span style={{ fontWeight: 400, color: "var(--muted-foreground)", marginLeft: "0.4rem" }}>
                  — {job.position}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "0.15rem" }}>
              {job.experienceLevel && (
                <span>
                  Level:{" "}
                  <strong style={{ color: "var(--foreground)", textTransform: "capitalize" }}>
                    {job.experienceLevel}
                  </strong>
                </span>
              )}
              {job.minExperienceYears > 0 && (
                <span>
                  Min experience:{" "}
                  <strong style={{ color: "var(--foreground)" }}>{job.minExperienceYears}y</strong>
                </span>
              )}
              {job.location && (
                <span>
                  Location:{" "}
                  <strong style={{ color: "var(--foreground)" }}>{job.location}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {job.description && (
            <div>
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--muted-foreground)",
                  marginBottom: "0.5rem",
                }}
              >
                Description
              </div>
              <p
                style={{
                  fontSize: "0.875rem",
                  lineHeight: 1.7,
                  color: "var(--foreground)",
                  margin: 0,
                  padding: "0.875rem 1rem",
                  background: "var(--muted)",
                  borderRadius: "calc(var(--radius) - 2px)",
                  borderLeft: "3px solid var(--brand)",
                }}
              >
                {job.description}
              </p>
            </div>
          )}

          {/* Required skills */}
          {job.requiredSkills?.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--muted-foreground)",
                  marginBottom: "0.6rem",
                }}
              >
                Required Skills
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {job.requiredSkills.map((sk, i) => (
                  <SkillPill key={i} skill={sk} highlighted />
                ))}
              </div>
            </div>
          )}

          {/* AI-generated prep tips */}
          <div
            style={{
              borderRadius: "calc(var(--radius) - 2px)",
              border: "1px solid rgba(0,129,198,0.25)",
              overflow: "hidden",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                background: "rgba(0,129,198,0.07)",
                borderBottom: tips || tipsLoading ? "1px solid rgba(0,129,198,0.15)" : "none",
              }}
            >
              <strong style={{ color: "var(--brand)", fontSize: "0.875rem" }}>
                💡 AI Prep Tips
              </strong>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchTips}
                disabled={tipsLoading}
                style={{ fontSize: "0.75rem", borderColor: "rgba(0,129,198,0.35)", color: "var(--brand)" }}
              >
                {tipsLoading ? "Generating…" : tips ? "Regenerate" : "Generate with AI"}
              </Button>
            </div>

            {/* Content area */}
            {tipsLoading && (
              <div style={{ padding: "1rem", fontSize: "0.8125rem", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--brand)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
                Qwen is thinking…
              </div>
            )}

            {tipsError && !tipsLoading && (
              <div style={{ padding: "0.875rem 1rem", fontSize: "0.8125rem", color: "var(--destructive)" }}>
                {tipsError}
              </div>
            )}

            {tips && !tipsLoading && (
              <div style={{ padding: "0.875rem 1rem" }}>
                {tips.split("\n").filter(Boolean).map((line, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "0.875rem",
                      lineHeight: 1.65,
                      color: "var(--foreground)",
                      padding: "0.3rem 0",
                      borderBottom: i < tips.split("\n").filter(Boolean).length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}

            {!tips && !tipsLoading && !tipsError && (
              <div style={{ padding: "0.875rem 1rem", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
                Click "Generate with AI" to get personalized preparation tips for this interview.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: "1.5rem", color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
          No job description linked to this interview yet.
        </div>
      )}
    </div>
  );
}

export default function InterviewPrepPage() {
  const navigate = useNavigate();
  const [userProfile] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("upcoming"); // "upcoming" | "all"

  useEffect(() => {
    api
      .get("/interviews")
      .then((res) => setInterviews(res.data))
      .catch((e) => setError(e.response?.data?.message || "Failed to load interviews."))
      .finally(() => setLoading(false));
  }, []);

  const displayed =
    filter === "upcoming"
      ? interviews.filter((i) => i.status !== "finished")
      : interviews;

  return (
    <AppShell
      user={userProfile}
      title="Interview Prep"
      subtitle="Everything you need to prepare for your upcoming interviews."
      nav={candidateNav}
      activeKey="interviewPrep"
      onNav={(key) => {
        if (key !== "interviewPrep") navigate("/dashboard");
      }}
    >
      {error && (
        <Alert variant="destructive">
          <AlertTriangleIcon size={14} /> <div>{error}</div>
        </Alert>
      )}

      {/* Filter row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div className="tab-row" style={{ marginBottom: 0, borderBottom: "none", gap: "0.25rem" }}>
          {[
            { key: "upcoming", label: "Upcoming" },
            { key: "all", label: "All interviews" },
          ].map((f) => (
            <button
              key={f.key}
              className={`tab-btn${filter === f.key ? " active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Badge variant="outline">{displayed.length} interview{displayed.length !== 1 ? "s" : ""}</Badge>
      </div>

      {loading ? (
        <div className="empty-state">Loading interviews…</div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">
            <CalendarIcon size={16} />
          </span>
          <div className="font-medium">
            {filter === "upcoming" ? "No upcoming interviews." : "No interviews found."}
          </div>
          <div>
            {filter === "upcoming"
              ? "Switch to 'All interviews' to see past ones."
              : "Interviews will appear here once a recruiter schedules one."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {displayed.map((i) => (
            <PrepCard
              key={i._id}
              interview={i}
              onJoin={(id) => navigate(`/interview/${id}`)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
