import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { TiltCard } from "../components/TiltCard";
import { AppShell, Avatar } from "../components/AppShell";
import { candidateNav, recruiterNav } from "../components/nav";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Select } from "../components/ui/Select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CalendarIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  SaveIcon,
  XIcon,
  ClockIcon,
  UsersIcon,
  UserIcon,
  UploadIcon,
  FileTextIcon,
  CameraIcon,
  ArrowLeftIcon,
  DownloadIcon,
  VideoIcon,
  SearchIcon,
} from "../components/icons";

const BASE_URL = "http://localhost:5000";

function statusVariant(status) {
  if (status === "finished") return "success";
  if (status === "ongoing") return "info";
  return "warning";
}
function statusLabel(status) {
  if (!status) return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Candidate Profile Tab ────────────────────────────────────────────────────
/* ── Google Calendar connection (recruiters/admins only) ───────────────────
 * Tokens live only on the backend; this component only ever sees a boolean
 * status and the connected account's email.                                 */
function GoogleCalendarCard() {
  const toast = useToast();
  const [state, setState] = useState({ loading: true, configured: false, connected: false, email: null });
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await api.get("/google/status");
      setState({ loading: false, ...res.data });
    } catch {
      setState({ loading: false, configured: false, connected: false, email: null });
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      // The backend returns the consent URL (the JWT lives in localStorage, so a
      // raw browser redirect to the API would not carry the auth header).
      const res = await api.get("/google/auth");
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start Google authorization.");
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await api.delete("/google/disconnect");
      toast.success("Google Calendar disconnected.");
      await loadStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not disconnect Google Calendar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Google Calendar</CardTitle>
            <CardDescription>
              Sync scheduled interviews to your Google Calendar and invite candidates automatically.
            </CardDescription>
          </div>
          {!state.loading && (
            <Badge variant={state.connected ? "success" : "outline"}>
              {state.connected ? "Connected" : "Not connected"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {state.loading ? (
          <div className="empty-state">Loading Google Calendar status…</div>
        ) : !state.configured ? (
          <Alert variant="destructive">
            <AlertTriangleIcon size={16} />
            <div>
              Google Calendar is not configured on the server. Add the <code>GOOGLE_*</code> variables
              to <code>backend/.env</code> (see <code>.env.example</code>) and restart the backend.
            </div>
          </Alert>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
              {state.connected
                ? <>Connected as <strong style={{ color: "var(--foreground)" }}>{state.email || "your Google account"}</strong>.</>
                : "Not connected. Interviews are still created normally — they just won't appear in Google Calendar."}
            </div>

            <div className="row-actions">
              <Button variant="brand" onClick={handleConnect} disabled={busy}>
                {state.connected ? "Reconnect" : "Connect Google Calendar"}
              </Button>
              {state.connected && (
                <Button variant="ghost" onClick={handleDisconnect} disabled={busy}>
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileTab({ userProfile, onProfileUpdated }) {
  const [form, setForm] = useState({
    name: userProfile?.name || "",
    email: userProfile?.email || "",
    password: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [cvUploading, setCvUploading] = useState(false);
  const [cvMsg, setCvMsg] = useState("");
  const [cvErr, setCvErr] = useState("");

  const [imgUploading, setImgUploading] = useState(false);
  const [imgMsg, setImgMsg] = useState("");
  const [imgErr, setImgErr] = useState("");





  const cvInputRef = useRef(null);
  const imgInputRef = useRef(null);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: userProfile?.name || "",
      email: userProfile?.email || "",
    }));
  }, [userProfile]);




  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (form.password && form.password !== form.confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name, email: form.email };
      if (form.password) payload.password = form.password;
      const res = await api.put("/users/me", payload);
      onProfileUpdated(res.data.user);
      setMsg("Profile updated successfully.");
      setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
    } catch (error) {
      setErr(error.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvMsg("");
    setCvErr("");
    setCvUploading(true);
    try {
      const fd = new FormData();
      fd.append("cv", file);
      const res = await api.post("/users/upload-cv", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onProfileUpdated(res.data.user);
      setCvMsg("CV uploaded successfully.");
    } catch (error) {
      setCvErr(error.response?.data?.message || "Failed to upload CV.");
    } finally {
      setCvUploading(false);
      if (cvInputRef.current) cvInputRef.current.value = "";
    }
  };

  const handleImgUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgMsg("");
    setImgErr("");
    setImgUploading(true);
    try {
      const fd = new FormData();
      fd.append("profileImage", file);
      const res = await api.post("/users/upload-profile-image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onProfileUpdated(res.data.user);
      setImgMsg("Profile picture updated.");
    } catch (error) {
      setImgErr(error.response?.data?.message || "Failed to upload image.");
    } finally {
      setImgUploading(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  };

  const cvUrl = userProfile?.cv ? `${BASE_URL}${userProfile.cv}` : null;

  const canUseGoogleCalendar =
    userProfile?.role === "recruiter" || userProfile?.role === "admin";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {canUseGoogleCalendar && <GoogleCalendarCard />}

      {/* Profile Picture */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload a photo that will appear on your profile.</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
            <Avatar
              name={userProfile?.name}
              profileImage={userProfile?.profileImage}
              size={80}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input
                ref={imgInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                style={{ display: "none" }}
                onChange={handleImgUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => imgInputRef.current?.click()}
                disabled={imgUploading}
              >
                <CameraIcon size={14} />
                {imgUploading ? "Uploading…" : "Change picture"}
              </Button>
              <span className="muted" style={{ fontSize: "0.75rem" }}>
                JPG or PNG — shown as your avatar everywhere.
              </span>
            </div>
          </div>
          {imgMsg && (
            <Alert variant="success" style={{ marginTop: "0.75rem" }}>
              <CheckCircleIcon size={14} /> <div>{imgMsg}</div>
            </Alert>
          )}
          {imgErr && (
            <Alert variant="destructive" style={{ marginTop: "0.75rem" }}>
              <AlertTriangleIcon size={14} /> <div>{imgErr}</div>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your name, email, and password.</CardDescription>
        </CardHeader>
        <CardContent>
          {msg && (
            <Alert variant="success" style={{ marginBottom: "1rem" }}>
              <CheckCircleIcon size={14} /> <div>{msg}</div>
            </Alert>
          )}
          {err && (
            <Alert variant="destructive" style={{ marginBottom: "1rem" }}>
              <AlertTriangleIcon size={14} /> <div>{err}</div>
            </Alert>
          )}
          <form onSubmit={handleSaveInfo} className="form-stack">
            <div className="form-row">
              <div className="form-group">
                <Label htmlFor="prof-name">Full Name</Label>
                <Input
                  id="prof-name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <Label htmlFor="prof-email">Email</Label>
                <Input
                  id="prof-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <p className="muted" style={{ fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
                Leave password fields blank to keep your current password.
              </p>
              <div className="form-row">
                <div className="form-group">
                  <Label htmlFor="prof-pwd">New Password</Label>
                  <Input
                    id="prof-pwd"
                    name="password"
                    type="password"
                    placeholder="New password"
                    value={form.password}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <Label htmlFor="prof-pwd2">Confirm Password</Label>
                  <Input
                    id="prof-pwd2"
                    name="confirmPassword"
                    type="password"
                    placeholder="Repeat new password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
            <div>
              <Button type="submit" variant="brand" disabled={saving}>
                <SaveIcon size={14} /> {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* CV */}
      {userProfile?.role === "candidate" && (
      <Card>
        <CardHeader>
          <CardTitle>Curriculum Vitae</CardTitle>
          <CardDescription>Upload your CV so recruiters can review it.</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {cvUrl ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: "var(--brand-muted)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                }}
              >
                <FileTextIcon size={20} style={{ color: "var(--brand)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--foreground)" }}>
                    CV on file
                  </div>
                  <div
                    className="muted"
                    style={{
                      fontSize: "0.75rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {userProfile.cv.split("/").pop()}
                  </div>
                </div>
                <a href={cvUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <DownloadIcon size={13} /> View / Download
                  </Button>
                </a>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "1.25rem" }}>
                <span className="empty-state-icon">
                  <FileTextIcon size={16} />
                </span>
                <div>No CV uploaded yet.</div>
              </div>
            )}

            <input
              ref={cvInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              style={{ display: "none" }}
              onChange={handleCvUpload}
            />
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cvInputRef.current?.click()}
                disabled={cvUploading}
              >
                <UploadIcon size={14} />
                {cvUploading ? "Uploading…" : cvUrl ? "Replace CV" : "Upload CV"}
              </Button>
              <span className="muted" style={{ fontSize: "0.75rem", marginLeft: "0.75rem" }}>
                PDF, DOC or DOCX accepted.
              </span>
            </div>
            {cvMsg && (
              <Alert variant="success">
                <CheckCircleIcon size={14} /> <div>{cvMsg}</div>
              </Alert>
            )}
            {cvErr && (
              <Alert variant="destructive">
                <AlertTriangleIcon size={14} /> <div>{cvErr}</div>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card> )}
    </div>
  );
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color =
    score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
      <svg width={104} height={104} viewBox="0 0 104 104">
        <circle cx={52} cy={52} r={radius} fill="none" stroke="var(--border)" strokeWidth={10} />
        <circle
          cx={52}
          cy={52}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 52 52)"
          style={{ transition: "stroke-dashoffset 0.7s ease" }}
        />
        <text x={52} y={56} textAnchor="middle" fontSize={22} fontWeight={700} fill={color}>
          {score}
        </text>
      </svg>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {score >= 75 ? "Strong Match" : score >= 50 ? "Partial Match" : "Weak Match"}
      </span>
    </div>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, score, max }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{score} / {max}</span>
      </div>
      <div style={{ height: 6, borderRadius: 9999, background: "var(--border)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 9999,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─── Candidate Details Modal ──────────────────────────────────────────────────
function CandidateDetailsModal({ applicationId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .get(`/applications/${applicationId}/candidate-details`)
      .then((res) => setData(res.data))
      .catch((e) => setErr(e.response?.data?.message || "Failed to load candidate details."))
      .finally(() => setLoading(false));
  }, [applicationId]);

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const cvUrl = data?.candidate?.cv ? `${BASE_URL}${data.candidate.cv}` : null;
  const imgUrl = data?.candidate?.profileImage
    ? `${BASE_URL}${data.candidate.profileImage}`
    : null;

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "calc(var(--radius) * 1.5)",
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            background: "var(--card)",
            zIndex: 1,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--foreground)" }}>
              Candidate Details
            </div>
            {data?.job && (
              <div className="muted" style={{ fontSize: "0.8125rem" }}>
                Applied for: <strong>{data.job.title}</strong>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted-foreground)",
              padding: "0.25rem",
              display: "flex",
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {loading && (
            <div className="empty-state">
              <div className="font-medium">Loading…</div>
            </div>
          )}
          {err && (
            <Alert variant="destructive">
              <AlertTriangleIcon size={14} /> <div>{err}</div>
            </Alert>
          )}

          {data && (
            <>
              {/* ── Candidate identity ── */}
              <div
                style={{
                  display: "flex",
                  gap: "1.25rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {/* Profile image */}
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={data.candidate.name}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid var(--border)",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <Avatar name={data.candidate.name} size={72} />
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.125rem", color: "var(--foreground)" }}>
                    {data.candidate.name}
                  </div>
                  <div className="muted" style={{ fontSize: "0.875rem" }}>{data.candidate.email}</div>
                  {data.cvInfo?.phone && (
                    <div className="muted" style={{ fontSize: "0.8125rem" }}>📞 {data.cvInfo.phone}</div>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    {data.cvInfo?.linkedIn && (
                      <a href={data.cvInfo.linkedIn} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: "0.75rem", color: "var(--brand)", textDecoration: "none" }}>
                        LinkedIn ↗
                      </a>
                    )}
                    {data.cvInfo?.github && (
                      <a href={data.cvInfo.github} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: "0.75rem", color: "var(--brand)", textDecoration: "none" }}>
                        GitHub ↗
                      </a>
                    )}
                    {cvUrl && (
                      <a href={cvUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <DownloadIcon size={12} /> View CV
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Intelligence Score ── */}
              <div
                style={{
                  background: "#F2F2F2",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "1.25rem",
                  display: "flex",
                  gap: "2rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <ScoreRing score={data.score.total} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)", marginBottom: "0.25rem" }}>
                    Match Breakdown
                  </div>
                  {data.score.breakdown.skills && (
                    <ScoreBar
                      label={`Skills ${data.score.breakdown.skills.matched !== undefined
                        ? `(${data.score.breakdown.skills.matched}/${data.score.breakdown.skills.total} matched)`
                        : ""}`}
                      score={data.score.breakdown.skills.score}
                      max={data.score.breakdown.skills.max}
                    />
                  )}
                  {data.score.breakdown.experience && (
                    <ScoreBar
                      label={`Experience (${data.score.breakdown.experience.calculatedYears}y computed, ${data.score.breakdown.experience.requiredYears}y required)`}
                      score={data.score.breakdown.experience.score}
                      max={data.score.breakdown.experience.max}
                    />
                  )}
                  {data.score.breakdown.education && (
                    <ScoreBar
                      label="Education"
                      score={data.score.breakdown.education.score}
                      max={data.score.breakdown.education.max}
                    />
                  )}
                </div>
              </div>

              {/* ── Summary ── */}
              {data.cvInfo?.summary && (
                <div>
                  <SectionLabel>Summary</SectionLabel>
                  <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--foreground)", margin: 0 }}>
                    {data.cvInfo.summary}
                  </p>
                </div>
              )}

              {/* ── Skills ── */}
              {data.cvInfo?.skills?.length > 0 && (
                <div>
                  <SectionLabel>Skills</SectionLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                    {data.cvInfo.skills.map((sk, i) => {
                      const jobSkills = (data.job?.requiredSkills || []).map((s) => s.toLowerCase());
                      const isMatch = jobSkills.some(
                        (js) => sk.toLowerCase().includes(js) || js.includes(sk.toLowerCase())
                      );
                      return (
                        <Badge key={i} variant={isMatch ? "success" : "secondary"}
                          style={isMatch ? { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" } : {}}>
                          {isMatch && <CheckCircleIcon size={10} />} {sk}
                        </Badge>
                      );
                    })}
                  </div>
                  {data.score.breakdown.skills?.matchedList?.length > 0 && (
                    <p className="muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
                      ✅ Green = required skills matched
                    </p>
                  )}
                </div>
              )}

              {/* ── Experience ── */}
              {data.cvInfo?.experience?.length > 0 && (
                <div>
                  <SectionLabel>Work Experience</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    {data.cvInfo.experience.map((exp, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "0.875rem 1rem",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                          background: "var(--muted, #f9fafb)",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--foreground)" }}>
                          {exp.title || "—"}
                        </div>
                        <div className="muted" style={{ fontSize: "0.8125rem" }}>
                          {exp.company || "—"} · {exp.startDate || "?"} → {exp.endDate || "Present"}
                        </div>
                        {exp.description && (
                          <p style={{ fontSize: "0.8125rem", marginTop: "0.375rem", color: "var(--foreground)", opacity: 0.8 }}>
                            {exp.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Education ── */}
              {data.cvInfo?.education?.length > 0 && (
                <div>
                  <SectionLabel>Education</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {data.cvInfo.education.map((edu, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "0.75rem 1rem",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                          background: "var(--muted, #f9fafb)",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                          {edu.degree} {edu.field ? `· ${edu.field}` : ""}
                        </div>
                        <div className="muted" style={{ fontSize: "0.8125rem" }}>
                          {edu.institution || "—"} · {edu.startYear || "?"} – {edu.endYear || "?"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Languages & Certifications ── */}
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                {data.cvInfo?.languages?.length > 0 && (
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <SectionLabel>Languages</SectionLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                      {data.cvInfo.languages.map((l, i) => (
                        <Badge key={i} variant="outline">{l}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {data.cvInfo?.certifications?.length > 0 && (
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <SectionLabel>Certifications</SectionLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                      {data.cvInfo.certifications.map((c, i) => (
                        <Badge key={i} variant="secondary">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── No CV Info fallback ── */}
              {!data.cvInfo && (
                <div className="empty-state" style={{ padding: "1.5rem" }}>
                  <span className="empty-state-icon"><FileTextIcon size={16} /></span>
                  <div className="font-medium">No CV info extracted yet</div>
                  <div>The candidate hasn't uploaded or parsed a CV yet.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// tiny helper for modal section labels
function SectionLabel({ children }) {
  return (
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
      {children}
    </div>
  );
}

// ─── Recruiter: Candidate Profile Panel ──────────────────────────────────────
function CandidateProfilePanel({ candidateId, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/users/candidates/${candidateId}/profile`);
        setProfile(res.data);
      } catch (e) {
        setErr(e.response?.data?.message || "Failed to load candidate profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [candidateId]);

  if (loading) {
    return (
      <div className="empty-state">
        <div className="font-medium">Loading profile…</div>
      </div>
    );
  }

  if (err) {
    return (
      <Alert variant="destructive">
        <AlertTriangleIcon size={14} /> <div>{err}</div>
      </Alert>
    );
  }

  const cvUrl = profile?.cv ? `${BASE_URL}${profile.cv}` : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon size={14} /> Back to candidates
        </Button>
      </div>

      <Card>
        <CardContent style={{ paddingTop: "1.5rem" }}>
          {/* Header with avatar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
              marginBottom: "1.5rem",
              paddingBottom: "1.25rem",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <Avatar
              name={profile?.name}
              profileImage={profile?.profileImage}
              size={72}
            />
            <div>
              <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--foreground)" }}>
                {profile?.name}
              </div>
              <div className="muted" style={{ fontSize: "0.875rem" }}>{profile?.email}</div>
              <div style={{ marginTop: "0.375rem" }}>
                <Badge variant="secondary">
                  <UserIcon size={10} /> Candidate
                </Badge>
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <div>
              <div
                className="muted"
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "0.25rem",
                }}
              >
                Full Name
              </div>
              <div style={{ fontSize: "0.9rem" }}>{profile?.name || "—"}</div>
            </div>
            <div>
              <div
                className="muted"
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "0.25rem",
                }}
              >
                Email
              </div>
              <div style={{ fontSize: "0.9rem" }}>{profile?.email || "—"}</div>
            </div>
            <div>
              <div
                className="muted"
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "0.25rem",
                }}
              >
                Member Since
              </div>
              <div style={{ fontSize: "0.9rem" }}>
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </div>
            </div>
            <div>
              <div
                className="muted"
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "0.25rem",
                }}
              >
                Curriculum Vitae
              </div>
              {cvUrl ? (
                <a href={cvUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <DownloadIcon size={13} /> View / Download CV
                  </Button>
                </a>
              ) : (
                <span className="muted" style={{ fontSize: "0.875rem" }}>No CV uploaded</span>
              )}
            </div>
          </div>

          {/* Profile image preview if present */}
          {profile?.profileImage && (
            <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}>
              <div
                className="muted"
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "0.75rem",
                }}
              >
                Profile Picture
              </div>
              <img
                src={`${BASE_URL}${profile.profileImage}`}
                alt={profile.name}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "var(--radius)",
                  objectFit: "cover",
                  border: "1px solid var(--border)",
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Interview Calendar ───────────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* Google Calendar sync state for one interview. Renders nothing when the
 * recruiter never connected Google, to avoid noise for users not using it. */
function GoogleSyncBadge({ interview }) {
  const status = interview?.googleCalendarSyncStatus;
  if (!status || status === "not_connected") return null;

  if (status === "synced") {
    const badge = <Badge variant="success">Synced</Badge>;
    return interview.googleCalendarHtmlLink ? (
      <a
        href={interview.googleCalendarHtmlLink}
        target="_blank"
        rel="noopener noreferrer"
        title="View in Google Calendar"
        onClick={(e) => e.stopPropagation()}
      >
        {badge}
      </a>
    ) : badge;
  }

  return <Badge variant="destructive" title="Could not sync to Google Calendar">Sync failed</Badge>;
}

function InterviewCalendar({ interviews, onJoin }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(null);

  const firstDay = new Date(cursor.year, cursor.month, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

  // Group interviews by date string YYYY-MM-DD
  const byDate = useMemo(() => {
    const map = {};
    (interviews || []).forEach((i) => {
      if (!i.scheduledAt) return;
      const d = new Date(i.scheduledAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return map;
  }, [interviews, cursor]);

  const prev = () => setCursor(c => c.month === 0 ? {year:c.year-1,month:11} : {year:c.year,month:c.month-1});
  const next = () => setCursor(c => c.month === 11 ? {year:c.year+1,month:0} : {year:c.year,month:c.month+1});

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedKey = selected ? `${cursor.year}-${String(cursor.month+1).padStart(2,"0")}-${String(selected).padStart(2,"0")}` : null;
  const selectedEvents = selectedKey ? (byDate[selectedKey] || []) : [];

  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  return (
    <div style={{ display:"grid", gap:"1rem" }}>
      <Card>
        <CardHeader>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <button onClick={prev} style={{ background:"none", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"0.3rem 0.7rem", cursor:"pointer", color:"var(--foreground)" }}>‹</button>
            <span style={{ fontWeight:700, fontSize:"1rem" }}>{MONTH_NAMES[cursor.month]} {cursor.year}</span>
            <button onClick={next} style={{ background:"none", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"0.3rem 0.7rem", cursor:"pointer", color:"var(--foreground)" }}>›</button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"0.25rem", marginBottom:"0.5rem" }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign:"center", fontSize:"0.72rem", fontWeight:600, color:"var(--muted-foreground)", padding:"0.25rem 0" }}>{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"0.25rem" }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              const key = `${cursor.year}-${String(cursor.month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const events = byDate[key] || [];
              const isToday = key === todayKey;
              const isSelected = day === selected;
              return (
                <div
                  key={day}
                  onClick={() => setSelected(day === selected ? null : day)}
                  style={{
                    minHeight:52, padding:"0.3rem", borderRadius:"calc(var(--radius) - 2px)",
                    border:`1px solid ${isSelected ? "var(--brand)" : isToday ? "var(--brand)" : "var(--border)"}`,
                    background: isSelected ? "rgba(0,129,198,0.1)" : isToday ? "rgba(0,129,198,0.05)" : "var(--card)",
                    cursor:"pointer", position:"relative",
                  }}
                >
                  <div style={{ fontSize:"0.78rem", fontWeight: isToday ? 700 : 400, color: isToday ? "var(--brand)" : "var(--foreground)", marginBottom:"0.2rem" }}>{day}</div>
                  {events.slice(0,2).map((e) => (
                    <div key={e._id} style={{ fontSize:"0.65rem", padding:"0.1rem 0.3rem", borderRadius:3, marginBottom:"0.15rem", background: e.status==="ongoing" ? "rgba(37,99,235,0.2)" : e.status==="finished" ? "rgba(22,163,74,0.15)" : "rgba(245,158,11,0.15)", color: e.status==="ongoing" ? "#2563eb" : e.status==="finished" ? "#16a34a" : "#d97706", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {e.title}
                    </div>
                  ))}
                  {events.length > 2 && <div style={{ fontSize:"0.6rem", color:"var(--muted-foreground)" }}>+{events.length-2} more</div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day detail */}
      {selected && selectedEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle style={{ fontSize:"0.95rem" }}>{MONTH_NAMES[cursor.month]} {selected} — {selectedEvents.length} interview{selectedEvents.length > 1 ? "s" : ""}</CardTitle>
          </CardHeader>
          <CardContent style={{ paddingTop:0, display:"grid", gap:"0.75rem" }}>
            {selectedEvents.map((i) => (
              <div key={i._id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"1rem", padding:"0.75rem", borderRadius:"calc(var(--radius) - 2px)", border:"1px solid var(--border)", background:"var(--muted)", flexWrap:"wrap" }}>
                <div style={{ display:"grid", gap:"0.2rem", flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:"0.9rem" }}>{i.title}</div>
                  <div style={{ fontSize:"0.8rem", color:"var(--muted-foreground)" }}>
                    {i.job?.title && <span>{i.job.title} · </span>}
                    {new Date(i.scheduledAt).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}
                  </div>
                  <div style={{ fontSize:"0.78rem", color:"var(--muted-foreground)" }}>
                    {i.recruiter?.name && <span>Recruiter: {i.recruiter.name}</span>}
                    {i.candidate?.name && <span> · Candidate: {i.candidate.name}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
                  <Badge variant={i.status==="finished"?"success":i.status==="ongoing"?"info":"warning"}>{i.status}</Badge>
                  <GoogleSyncBadge interview={i} />
                  <Button variant="brand" size="sm" onClick={() => onJoin(i._id)}>Join</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {selected && selectedEvents.length === 0 && (
        <Card>
          <CardContent style={{ paddingTop:"1.25rem" }}>
            <div className="empty-state" style={{ padding:"1rem 0" }}>No interviews on {MONTH_NAMES[cursor.month]} {selected}.</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [userProfile, setUserProfile] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );
  const isRecruiter = userProfile?.role === "recruiter";
  // /users/me returns `_id` while the login payload stored in localStorage uses
  // `id`. userProfile can come from either, so accept both — comparing against
  // only one of them silently hides the owner-only actions.
  const myId = userProfile?._id || userProfile?.id;

  const [activeTab, setActiveTab] = useState("dashboard");

  const [jobs, setJobs] = useState([]);

  
  
  const [interviews, setInterviews] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [quizResultsLoading, setQuizResultsLoading] = useState(false);
  const [quizResultsError, setQuizResultsError] = useState("");

  const interviewFormRef = useRef(null);

const [openJobs, setOpenJobs] = useState([]);
const [jobApplications, setJobApplications] = useState([]);
const [jobSearch, setJobSearch] = useState("");
const [debouncedJobSearch, setDebouncedJobSearch] = useState("");

const [selectedApplication, setSelectedApplication] = useState(null);
const [applicationInterviewDate, setApplicationInterviewDate] = useState("");
const [applicationsLoaded, setApplicationsLoaded] = useState(false);
const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    job: "",
    candidate: "",
    scheduledAt: "",
  });

  const [jobFormData, setJobFormData] = useState({
  title: "",
  position: "",
  description: "",
  requiredSkills: "",
  experienceLevel: "junior",
  minExperienceYears: 0,
  location: "",
});

  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({
    title: "",
    scheduledAt: "",
    status: "pending",
  });
const [liveRooms, setLiveRooms] = useState({});

  // Recruiter: which candidate profile to show (id or null)
  const [viewingCandidateId, setViewingCandidateId] = useState(null);

  // Recruiter: application id whose candidate details modal is open (null = closed)
  const [detailsApplicationId, setDetailsApplicationId] = useState(null);

  // Fetch full profile for current user (gets cv / profileImage)
  useEffect(() => {
    api
      .get("/users/me")
      .then((res) => setUserProfile(res.data))
      .catch(() => {});
  }, []);

  const handleProfileUpdated = (updatedUser) => {
    setUserProfile(updatedUser);
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    localStorage.setItem(
      "user",
      JSON.stringify({ ...stored, name: updatedUser.name, email: updatedUser.email })
    );
  };

  const fetchInterviews = async () => {
    try {
      const res = await api.get("/interviews");
      setInterviews(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load interviews");
    }
  };

  const fetchCandidates = async () => {
    try {
      const res = await api.get("/users/candidates");
      setCandidates(res.data);
    } catch (err) {
      console.error(err);
    }
  };
  const fetchJobs = async () => {
  try {
    const res = await api.get("/jobs/my");
    setJobs(res.data);
  } catch (err) {
    console.error(err);
  }
};

const fetchOpenJobs = async () => {
  try {
    const res = await api.get("/applications/jobs/open");
    setOpenJobs(res.data);
  } catch (err) {
    console.error(err);
  }
};

useEffect(() => {
  const t = setTimeout(() => setDebouncedJobSearch(jobSearch), 180);
  return () => clearTimeout(t);
}, [jobSearch]);

const filteredJobs = useMemo(() => {
  const term = debouncedJobSearch.trim().toLowerCase();
  if (!term) return openJobs;
  return openJobs.filter((job) => {
    const haystack = [
      job.title,
      job.position,
      job.description,
      ...(Array.isArray(job.requiredSkills) ? job.requiredSkills : []),
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(term);
  });
}, [openJobs, debouncedJobSearch]);


const fetchApplications = async () => {
  try {
    const res = await api.get("/applications/recruiter");
    setJobApplications(res.data);
  } catch (err) {
    console.error(err);
  } finally {
    setApplicationsLoaded(true);
  }
};

const fetchQuizResults = async () => {
  try {
    setQuizResultsError("");
    setQuizResultsLoading(true);
    const res = await api.get("/interviews/quiz-results");
    setQuizResults(res.data);
  } catch (err) {
    console.error(err);
    setQuizResultsError(err.response?.data?.message || "Failed to load quiz reports");
  } finally {
    setQuizResultsLoading(false);
  }
};

const handleViewQuizReport = (result) => {
  if (!result?._id) return;
  navigate(`/quiz-report/${result._id}`, { state: { report: result } });
};

useEffect(() => {
    (async () => {
      await fetchInterviews();
     if (isRecruiter) {
  await fetchCandidates();
  await fetchJobs();
  await fetchApplications();
} else {
  await fetchOpenJobs();
}
      await fetchQuizResults();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Result of the Google OAuth redirect ─────────────────────────────────── */
  useEffect(() => {
    const google = searchParams.get("google");
    if (!google) return;

    if (google === "connected") toast.success("Google Calendar connected.");
    else if (google === "denied") toast.warning("Google authorization was cancelled.");
    else toast.error("Could not connect Google Calendar. Please try again.");

    const next = new URLSearchParams(searchParams);
    next.delete("google");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /* ── Deep link from a notification action ──────────────────────────────────
   * /dashboard?tab=applications&application=<id> opens the existing prefilled
   * scheduling card. Nothing is created here — the recruiter still confirms.  */
  useEffect(() => {
    const tab = searchParams.get("tab");
    const applicationId = searchParams.get("application");
    if (!tab && !applicationId) return;

    if (tab) setActiveTab(tab);
    if (!applicationId) return;

    // Wait for the recruiter's pending list before deciding it's gone.
    if (isRecruiter && !applicationsLoaded) return;

    if (isRecruiter) {
      const application = jobApplications.find((a) => a._id === applicationId);
      if (application) setSelectedApplication(application);
      else toast.info("This application is no longer pending.");
    }

    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    next.delete("application");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, jobApplications, applicationsLoaded, isRecruiter]);

  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const onLiveStatus = (status) => setLiveRooms(status);
    const onApplicationNew = () => fetchApplications();
    const onInterviewChanged = () => fetchInterviews();
    const onJobNew = () => fetchOpenJobs();

    socket.on("rooms-live-status", onLiveStatus);
    socket.on("application:new", onApplicationNew);
    socket.on("application:updated", onApplicationNew);
    socket.on("interview:new", onInterviewChanged);
    socket.on("interview:updated", onInterviewChanged);
    socket.on("job:new", onJobNew);

    return () => {
      socket.off("rooms-live-status", onLiveStatus);
      socket.off("application:new", onApplicationNew);
      socket.off("application:updated", onApplicationNew);
      socket.off("interview:new", onInterviewChanged);
      socket.off("interview:updated", onInterviewChanged);
      socket.off("job:new", onJobNew);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleCreateInterview = async (e) => {
    e.preventDefault();
    try {
      await api.post("/interviews", formData);
      toast.success("Interview created successfully.");
      setFormData({ title: "", job: "", candidate: "", scheduledAt: "" });
      await fetchInterviews();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to create interview");
    }
  };



const handleCreateInterviewFromApplication = async () => {
  if (!selectedApplication || !applicationInterviewDate) {
    toast.warning("Please select interview date.");
    return;
  }

  try {
    await api.post("/interviews", {
      title: `${selectedApplication.job?.title || "Job"} Interview`,
      job: selectedApplication.job?._id,
      candidate: selectedApplication.candidate?._id,
      scheduledAt: applicationInterviewDate,
    });

    await api.put(`/applications/${selectedApplication._id}/accept`);

    toast.success("Interview created and application accepted.");
    setSelectedApplication(null);
    setApplicationInterviewDate("");

    await fetchInterviews();
    await fetchApplications();
  } catch (err) {
    toast.error(err.response?.data?.message || "Failed to create interview");
  }
};

// Removes the candidate from this recruiter's pipeline: deletes the candidature
// for this job and cancels its interview. The candidate's account is untouched.
const handleRemoveApplication = async (applicationId) => {
  try {
    const res = await api.delete(`/applications/${applicationId}`);
    toast.success(
      res.data?.interviewCancelled
        ? "Candidate removed and interview cancelled."
        : "Candidate removed from your pipeline."
    );
    setConfirmRemoveId(null);
    await fetchApplications();
    await fetchInterviews();
  } catch (err) {
    toast.error(err.response?.data?.message || "Failed to remove candidate.");
  }
};

const handleRejectApplication = async (applicationId) => {
  try {
    await api.put(`/applications/${applicationId}/reject`);
    toast.success("Application rejected.");
    await fetchApplications();
  } catch (err) {
    toast.error(err.response?.data?.message || "Failed to reject application");
  }
};


  const handleApplyJob = async (jobId) => {
  try {
    await api.post(`/applications/apply/${jobId}`);
    toast.success("Application sent successfully.");
    await fetchOpenJobs();
  } catch (err) {
    toast.error(err.response?.data?.message || "Failed to apply.");
  }
};




  const handleDeleteInterview = async (id) => {
    try {
      await api.delete(`/interviews/${id}`);
      toast.success("Interview deleted.");
      await fetchInterviews();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete interview");
    }
  };


const handleJobChange = (e) =>
  setJobFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

const handleCreateJob = async (e) => {
  e.preventDefault();

  try {
    await api.post("/jobs", jobFormData);

    toast.success("Job created successfully.");

    setJobFormData({
      title: "",
      position: "",
      description: "",
      requiredSkills: "",
      experienceLevel: "junior",
      minExperienceYears: 0,
      location: "",
    });

    await fetchJobs();
  } catch (err) {
    console.error("CREATE JOB ERROR:", err);
    toast.error(err.response?.data?.message || "Failed to create job");
  }
};



  const startEdit = (interview) => {
    setEditId(interview._id);
    setEditData({
      title: interview.title,
      scheduledAt: interview.scheduledAt
        ? new Date(interview.scheduledAt).toISOString().slice(0, 16)
        : "",
      status: interview.status || "pending",
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditData({ title: "", scheduledAt: "", status: "pending" });
  };

  const handleEditChange = (e) =>
    setEditData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleUpdateInterview = async (id) => {
    try {
      await api.put(`/interviews/${id}`, editData);
      toast.success("Interview updated.");
      setEditId(null);
      await fetchInterviews();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update interview");
    }
  };

  const stats = useMemo(() => {
    const total = interviews.length;
    const pending = interviews.filter((i) => i.status === "pending").length;
    const ongoing = interviews.filter((i) => i.status === "ongoing").length;
    const finished = interviews.filter((i) => i.status === "finished").length;
    return { total, pending, ongoing, finished };
  }, [interviews]);

  // ── Interviews table ──────────────────────────────────────────────────────
  const interviewsTable = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>
              {isRecruiter ? "Interviews you've scheduled" : "My interviews"}
            </CardTitle>
            <CardDescription>
              {isRecruiter
                ? "Manage, reschedule and track every interview you've set up."
                : "Every interview scheduled with you."}
            </CardDescription>
          </div>
          <Badge variant="outline">{interviews.length} total</Badge>
        </div>
      </CardHeader>
      <CardContent style={{ paddingTop: 0 }}>
        {interviews.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">
              <CalendarIcon size={16} />
            </span>
            <div className="font-medium" style={{ color: "var(--foreground)" }}>
              No interviews yet
            </div>
            <div>
              {isRecruiter
                ? "Schedule one from the Dashboard tab."
                : "Interviews will show up here once a recruiter schedules one."}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                  <th>Recruiter</th>
                  <th>Candidate</th>
                  <th style={{ width: 130 }}>Meeting</th>
                  <th style={{ width: 130 }}></th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((i) => {
                  const isEditing = editId === i._id;
                  return (
                    <tr key={i._id}>
                      <td>
                        {isEditing ? (
                          <Input
                            name="title"
                            value={editData.title}
                            onChange={handleEditChange}
                          />
                        ) : (
                          <span className="font-medium">{i.title}</span>
                        )}
                      </td>

<td className="muted">
  {i.job?.title || "—"}
</td>

                      <td>
                        {isEditing ? (
                          <Select
                            name="status"
                            value={editData.status}
                            onChange={handleEditChange}
                          >
                            <option value="pending">Pending</option>
                            <option value="ongoing">Ongoing</option>
                            <option value="finished">Finished</option>
                          </Select>
                        ) : (
                          <Badge variant={statusVariant(i.status)}>
                            <ClockIcon size={10} />
                            {statusLabel(i.status)}
                          </Badge>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <Input
                            type="datetime-local"
                            name="scheduledAt"
                            value={editData.scheduledAt}
                            onChange={handleEditChange}
                          />
                        ) : (
                          <span className="muted">{formatDate(i.scheduledAt)}</span>
                        )}
                      </td>
                      <td className="muted">{i.recruiter?.name || "—"}</td>
                      <td className="muted">{i.candidate?.name || "—"}</td>
                      {/* Join Meeting — always visible, not inside edit mode */}
                      <td>
  {!isEditing && (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      
      {/* LIVE STATUS */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: liveRooms[i._id] ? "#dc2626" : "#6b7280",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: liveRooms[i._id] ? "#dc2626" : "#9ca3af",
          }}
        />
        {liveRooms[i._id] ? "Live" : "Offline"}
      </span>

      {/* JOIN BUTTON */}
      <Button
        variant="brand"
        size="sm"
        onClick={() => navigate(`/interview/${i._id}`)}
      >
        <VideoIcon size={12} /> Join
      </Button>

    </div>
  )}
</td>
                      <td>
                        {isEditing ? (
                          <div className="row-actions">
                            <Button
                              variant="brand"
                              size="sm"
                              onClick={() => handleUpdateInterview(i._id)}
                            >
                              <SaveIcon size={12} /> Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={cancelEdit}
                              aria-label="Cancel"
                            >
                              <XIcon size={14} />
                            </Button>
                          </div>
                        ) : (
                          isRecruiter &&
                          i.recruiter?._id === myId && (
                            <div className="row-actions">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(i)}
                              >
                                <PencilIcon size={12} /> Edit
                              </Button>
                              {i.googleCalendarHtmlLink && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="Open this interview in Google Calendar"
                                  onClick={() =>
                                    window.open(i.googleCalendarHtmlLink, "_blank", "noopener,noreferrer")
                                  }
                                >
                                  <CalendarIcon size={12} /> Google
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteInterview(i._id)}
                                title="Cancel this interview"
                                aria-label="Cancel interview"
                              >
                                <TrashIcon size={14} />
                              </Button>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ── Candidates table (recruiter) — with Profile button per row ────────────
  const candidatesTable = viewingCandidateId ? (
    <CandidateProfilePanel
      candidateId={viewingCandidateId}
      onBack={() => setViewingCandidateId(null)}
    />
  ) : (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Candidates</CardTitle>
            <CardDescription>
              All registered candidates available for scheduling.
            </CardDescription>
          </div>
          <Badge variant="outline">{candidates.length} total</Badge>
        </div>
      </CardHeader>
      <CardContent style={{ paddingTop: 0 }}>
        {candidates.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">
              <UsersIcon size={16} />
            </span>
            <div className="font-medium" style={{ color: "var(--foreground)" }}>
              No candidates yet
            </div>
            <div>When candidates register, they'll appear here.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th style={{ width: 110 }}></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={c.name}
                          profileImage={c.profileImage}
                          size={28}
                          style={{ fontSize: 11 }}
                        />
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="muted">{c.email}</td>
                    <td>
                      <Badge variant="secondary">
                        <UserIcon size={10} /> Candidate
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingCandidateId(c._id)}
                      >
                        <UserIcon size={12} /> Profile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const navItems = isRecruiter ? recruiterNav : candidateNav;

const tabs = isRecruiter
  ? [
      { key: "dashboard", label: "Dashboard" },
      { key: "interviews", label: "Interviews" },
      { key: "calendar", label: "Calendar" },
      { key: "applications", label: "Applications" },
      { key: "candidates", label: "Candidates" },
      { key: "quizReports", label: "Quiz Reports" },
      { key: "profile", label: "My Profile" },
    ]
  : [
      { key: "dashboard", label: "Dashboard" },
      { key: "jobs", label: "Jobs" },
      { key: "interviews", label: "Interviews" },
      { key: "calendar", label: "Calendar" },
      { key: "quizReports", label: "Quiz Reports" },
      { key: "profile", label: "My Profile" },
    ];

  const titleMap = {
    dashboard: isRecruiter ? "Recruiter Dashboard" : "Candidate Dashboard",
    interviews: "Interviews",
    calendar: "Calendar",
    candidates: viewingCandidateId ? "Candidate Profile" : "Candidates",
    quizReports: "Quiz Reports",
    profile: "My Profile",
  };
  const subtitleMap = {
    dashboard: `Welcome back, ${userProfile?.name || "there"}.`,
    interviews: isRecruiter ? "All interviews you've scheduled." : "All interviews assigned to you.",
    calendar: "Your interviews at a glance.",
    candidates: viewingCandidateId
      ? "Viewing detailed candidate information."
      : "Browse every candidate registered on the platform.",
    quizReports: isRecruiter
      ? "Review completed quiz results for your interviews."
      : "Review your completed quiz performance and feedback.",
    profile: "Manage your personal information, picture and CV.",
  };

  return (
    <AppShell
      user={userProfile}
      title={titleMap[activeTab] || titleMap.dashboard}
      subtitle={subtitleMap[activeTab]}
      nav={navItems}
      activeKey={activeTab}
      onNav={(key) => {
        setActiveTab(key);
        if (key === "candidates") setViewingCandidateId(null);
      }}
    >
      {/* Tab row */}
      <div className="tab-row">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab-btn${activeTab === t.key ? " active" : ""}`}
            onClick={() => {
              setActiveTab(t.key);
              if (t.key === "candidates") setViewingCandidateId(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard overview ── */}
      {activeTab === "dashboard" && (
        <>
          <div className="grid grid-4 gap-4">
            {[
              { label: "Total interviews", value: stats.total, trend: isRecruiter ? "All you've scheduled" : "All assigned to you" },
              { label: "Pending", value: stats.pending, trend: "Awaiting start time", borderLeftColor: "var(--fg-subtle)" },
              { label: "Ongoing", value: stats.ongoing, trend: "Currently in progress", borderLeftColor: "var(--info)" },
              { label: "Finished", value: stats.finished, trend: "Completed sessions", borderLeftColor: "var(--success)" },
            ].map((s, i) => (
              <Motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
              >
                <TiltCard maxTilt={4}>
                  <Card className="stat-card" style={s.borderLeftColor ? { borderLeftColor: s.borderLeftColor } : undefined}>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value">{s.value}</div>
                    <div className="stat-trend">{s.trend}</div>
                  </Card>
                </TiltCard>
              </Motion.div>
            ))}
          </div>


{isRecruiter && (
  <Card>
    <CardHeader>
      <CardTitle>Create a new job</CardTitle>
      <CardDescription>
        Add a job offer so you can link it to interviews.
      </CardDescription>
    </CardHeader>

    <CardContent>
      <form onSubmit={handleCreateJob} className="form-stack">
        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="job-title">Job Title</Label>
            <Input
              id="job-title"
              name="title"
              placeholder="e.g. Full Stack Developer"
              value={jobFormData.title}
              onChange={handleJobChange}
              required
            />
          </div>

          <div className="form-group">
            <Label htmlFor="job-position">Position</Label>
            <Input
              id="job-position"
              name="position"
              placeholder="e.g. React / Node.js Developer"
              value={jobFormData.position}
              onChange={handleJobChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <Label htmlFor="job-description">Description</Label>
          <Input
            id="job-description"
            name="description"
            placeholder="Short job description"
            value={jobFormData.description}
            onChange={handleJobChange}
          />
        </div>

        <div className="form-group">
          <Label htmlFor="requiredSkills">Required Skills</Label>
          <Input
            id="requiredSkills"
            name="requiredSkills"
            placeholder="React, Node.js, MongoDB, Docker"
            value={jobFormData.requiredSkills}
            onChange={handleJobChange}
          />
          <span className="text-xs muted">
            Separate skills with commas.
          </span>
        </div>

        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="experienceLevel">Experience Level</Label>
            <Select
              id="experienceLevel"
              name="experienceLevel"
              value={jobFormData.experienceLevel}
              onChange={handleJobChange}
            >
              <option value="intern">Intern</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </Select>
          </div>

          <div className="form-group">
            <Label htmlFor="minExperienceYears">Minimum Experience</Label>
            <Input
              id="minExperienceYears"
              name="minExperienceYears"
              type="number"
              min="0"
              value={jobFormData.minExperienceYears}
              onChange={handleJobChange}
            />
          </div>

          <div className="form-group">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              placeholder="e.g. Remote / Tunis"
              value={jobFormData.location}
              onChange={handleJobChange}
            />
          </div>
        </div>

        <div>
          <Button type="submit" variant="brand">
            <PlusIcon size={14} /> Create job
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>
)}


          {isRecruiter && (

            



           <Card ref={interviewFormRef}>
              <CardHeader>
                <CardTitle>Schedule a new interview</CardTitle>
                <CardDescription>
                  Pick a candidate, set a title and date, and we'll notify them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateInterview} className="form-stack">
                  <div className="form-row">
                    <div className="form-group">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        name="title"
                        placeholder="e.g. Frontend technical round"
                        value={formData.title}
                        onChange={handleChange}
                        required
                      />
                    </div>

 <div className="form-group">
    <Label htmlFor="job">Job</Label>
    <Select
      id="job"
      name="job"
      value={formData.job}
      onChange={handleChange}
      required
      disabled={jobs.length === 0}
    >
      <option value="">
        {jobs.length === 0
          ? "No jobs created yet"
          : `Select job (${jobs.length})`}
      </option>

      {jobs.map((job) => (
        <option key={job._id} value={job._id}>
          {job.title} — {job.position}
        </option>
      ))}
    </Select>
  </div>


                    <div className="form-group">
                      <Label htmlFor="candidate">Candidate</Label>
                      <Select
                        id="candidate"
                        name="candidate"
                        value={formData.candidate}
                        onChange={handleChange}
                        required
                        disabled={candidates.length === 0}
                      >
                        <option value="">
                          {candidates.length === 0
                            ? "No candidates available yet"
                            : `Select candidate (${candidates.length})`}
                        </option>
                        {candidates.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} — {c.email}
                          </option>
                        ))}
                      </Select>
                      {candidates.length === 0 && (
                        <span className="text-xs muted">
                          Candidates will appear here once they register on the platform.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="form-group" style={{ maxWidth: 340 }}>
                    <Label htmlFor="scheduledAt">Scheduled at</Label>
                    <Input
                      id="scheduledAt"
                      name="scheduledAt"
                      type="datetime-local"
                      value={formData.scheduledAt}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                   <Button type="submit" variant="brand">
  <PlusIcon size={14} /> Create interview
</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {interviewsTable}
        </>
      )}

      {/* ── Interviews tab ── */}
      {activeTab === "interviews" && interviewsTable}

      {/* ── Candidates tab (recruiter) ── */}
      {activeTab === "candidates" && isRecruiter && candidatesTable}

      {/* ── Calendar tab ── */}
      {activeTab === "calendar" && <InterviewCalendar interviews={interviews} onJoin={(id) => navigate(`/interview/${id}`)} />}

      {/* ── Quiz Reports tab ── */}
      {activeTab === "quizReports" && (
        <div style={{ display:"grid", gap:"1rem" }}>
          {/* Score trend summary */}
          {quizResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize:"0.95rem" }}>Score overview</CardTitle>
                <CardDescription>Your quiz performance across all interviews.</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:"0.75rem", marginBottom:"1.25rem" }}>
                  {[
                    { label:"Total quizzes", value: quizResults.length, color:"var(--foreground)" },
                    { label:"Passed", value: quizResults.filter(r=>r.passed).length, color:"var(--success)" },
                    { label:"Needs review", value: quizResults.filter(r=>!r.passed).length, color:"var(--destructive)" },
                    { label:"Avg score", value: `${Math.round(quizResults.reduce((s,r)=>s+(r.score||0),0)/quizResults.length)}%`, color:"var(--brand)" },
                  ].map(s => (
                    <div key={s.label} style={{ padding:"0.85rem", borderRadius:"var(--radius)", border:"1px solid var(--border)", background:"var(--muted)" }}>
                      <div style={{ fontSize:"0.7rem", textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--muted-foreground)", marginBottom:"0.3rem" }}>{s.label}</div>
                      <div style={{ fontSize:"1.3rem", fontWeight:800, color:s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {/* Score bar chart — one bar per result */}
                <div style={{ fontSize:"0.72rem", color:"var(--muted-foreground)", marginBottom:"0.5rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Score history</div>
                <div style={{ display:"flex", gap:"0.4rem", alignItems:"flex-end", height:80, overflowX:"auto", paddingBottom:"0.25rem" }}>
                  {[...quizResults].sort((a,b)=>new Date(a.completedAt)-new Date(b.completedAt)).map((r,i) => (
                    <div key={r._id} title={`${r.interview?.title||"Interview"}: ${r.score}%`}
                      onClick={() => handleViewQuizReport(r)}
                      style={{ flex:"0 0 28px", display:"flex", flexDirection:"column", alignItems:"center", gap:"0.2rem", cursor:"pointer" }}>
                      <div style={{ fontSize:"0.6rem", color:"var(--muted-foreground)" }}>{r.score}%</div>
                      <div style={{
                        width:20, borderRadius:"3px 3px 0 0",
                        height:`${Math.max(8,(r.score/100)*56)}px`,
                        background: r.passed ? "var(--success)" : "var(--destructive)",
                        opacity:0.85,
                        transition:"height 0.3s"
                      }} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Quiz history</CardTitle>
                  <CardDescription>Click any row to view the full detailed report.</CardDescription>
                </div>
                <Badge variant="outline">{quizResults.length} reports</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {quizResultsLoading ? (
                <div className="empty-state">Loading quiz reports…</div>
              ) : quizResultsError ? (
                <div className="empty-state"><div className="font-medium">{quizResultsError}</div></div>
              ) : quizResults.length === 0 ? (
                <div className="empty-state">
                  <div className="font-medium">No quiz results yet.</div>
                  <div>Complete an interview quiz to see results here.</div>
                </div>
              ) : (
                <div style={{ display:"grid", gap:"0.75rem" }}>
                  {[...quizResults].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt)).map((result, i) => (
                    <Motion.div
                      key={result._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i, 10) * 0.03 }}
                    >
                    <TiltCard
                      maxTilt={3}
                      onClick={() => handleViewQuizReport(result)}
                      style={{ display:"flex", alignItems:"center", gap:"1rem", padding:"0.875rem 1rem", borderRadius:"var(--radius)", border:"1px solid var(--border)", background:"var(--card)", flexWrap:"wrap" }}
                    >
                      {/* Score ring */}
                      <div style={{ flexShrink:0, position:"relative", width:48, height:48 }}>
                        <svg width={48} height={48} style={{ transform:"rotate(-90deg)" }}>
                          <circle cx={24} cy={24} r={19} fill="none" stroke="var(--border)" strokeWidth={4} />
                          <circle cx={24} cy={24} r={19} fill="none"
                            stroke={result.passed ? "var(--success)" : "var(--destructive)"}
                            strokeWidth={4}
                            strokeDasharray={`${(result.score/100)*119.4} 119.4`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.65rem", fontWeight:700, color:"var(--foreground)" }}>
                          {result.score}%
                        </span>
                      </div>
                      {/* Info */}
                      <div style={{ flex:1, minWidth:0, display:"grid", gap:"0.2rem" }}>
                        <div style={{ fontWeight:600, fontSize:"0.9rem", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {result.interview?.title || "Interview"}
                        </div>
                        <div style={{ fontSize:"0.8rem", color:"var(--muted-foreground)" }}>
                          {result.jobTitle || result.job?.title || "—"}
                          {result.candidate?.name && ` · ${result.candidate.name}`}
                        </div>
                        <div style={{ fontSize:"0.75rem", color:"var(--muted-foreground)" }}>
                          {result.answeredCount}/{result.totalQuestions} answered
                          {result.completedAt && ` · ${new Date(result.completedAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      {/* Score bar */}
                      <div style={{ flex:"0 0 120px", display:"grid", gap:"0.25rem" }}>
                        <div style={{ height:6, borderRadius:999, background:"var(--border)", overflow:"hidden" }}>
                          <div style={{ width:`${result.score}%`, height:"100%", borderRadius:999, background: result.passed ? "var(--success)" : "var(--destructive)", transition:"width 0.4s" }} />
                        </div>
                        <Badge variant={result.passed ? "success" : "destructive"} style={{ justifySelf:"end" }}>
                          {result.passed ? "Passed" : "Needs review"}
                        </Badge>
                      </div>
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleViewQuizReport(result); }}>
                        View report
                      </Button>
                    </TiltCard>
                    </Motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── My Profile tab (candidate) ── */}
      {activeTab === "profile" && (
        <ProfileTab
          userProfile={userProfile}
          onProfileUpdated={handleProfileUpdated}
        />
      )}

{activeTab === "jobs" && !isRecruiter && (
  <Card>
    <CardHeader>
      <CardTitle>Available Jobs</CardTitle>
      <CardDescription>Apply to open jobs posted by recruiters.</CardDescription>
    </CardHeader>
    <CardContent>
      <div style={{ position: "relative", marginBottom: "1.25rem" }}>
        <SearchIcon size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--fg-subtle)" }} />
        <input
          type="text"
          value={jobSearch}
          onChange={(e) => setJobSearch(e.target.value)}
          placeholder="Search jobs by title, skills, description…"
          style={{
            width: "100%", padding: "0.6rem 0.75rem 0.6rem 2.25rem",
            borderRadius: "var(--radius)", border: "1px solid var(--border-hi)",
            background: "var(--bg-input)", color: "var(--fg)", fontSize: "0.875rem", outline: "none",
          }}
        />
      </div>

      {filteredJobs.length === 0 ? (
        <div className="empty-state">
          {openJobs.length === 0 ? "No open jobs available." : "No jobs match your search."}
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence initial={false}>
            {filteredJobs.map((job, i) => (
              <TiltCard key={job._id} maxTilt={4}>
                <Motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03 }}
                >
                  <Card>
                    <CardContent style={{ paddingTop: "1rem" }}>
                      <h3>{job.title}</h3>
                      <p className="muted">{job.position}</p>
                      <p>{job.description}</p>

                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {job.requiredSkills?.map((skill) => (
                          <Badge key={skill} variant="secondary">{skill}</Badge>
                        ))}
                      </div>

                      <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                        <Button
                          variant={job.alreadyApplied ? "outline" : "brand"}
                          onClick={() => handleApplyJob(job._id)}
                          disabled={job.alreadyApplied}
                        >
                          {job.alreadyApplied ? "Applied" : "Apply"}
                        </Button>
                        <Badge variant="outline">
          {job.applicationsCount || 0} applications
        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Motion.div>
              </TiltCard>
            ))}
          </AnimatePresence>
        </div>
      )}
    </CardContent>
  </Card>
)}

{activeTab === "applications" && isRecruiter && (
  <>
    {/* Candidate Details Modal */}
    {detailsApplicationId && (
      <CandidateDetailsModal
        applicationId={detailsApplicationId}
        onClose={() => setDetailsApplicationId(null)}
      />
    )}

    <Card>
      <CardHeader>
        <CardTitle>Applications</CardTitle>
        <CardDescription>Review candidate applications and create interviews.</CardDescription>
      </CardHeader>

      <CardContent>
        {jobApplications.length === 0 ? (
          <div className="empty-state">No applications yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Candidate</th>
                  <th>Email</th>
                  <th>CV</th>
                  <th>Status</th>
                  <th style={{ width: 260 }}></th>
                </tr>
              </thead>

              <tbody>
                {jobApplications.map((app) => {
                  const cvUrl = app.candidate?.cv
                    ? `${BASE_URL}${app.candidate.cv}`
                    : null;

                  return (
                    <tr key={app._id}>
                      <td>{app.job?.title || "—"}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={app.candidate?.name}
                            profileImage={app.candidate?.profileImage}
                            size={26}
                            style={{ fontSize: 10 }}
                          />
                          {app.candidate?.name || "—"}
                        </div>
                      </td>
                      <td className="muted">{app.candidate?.email || "—"}</td>
                      <td>
                        {cvUrl ? (
                          <a href={cvUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                              <FileTextIcon size={12} /> CV
                            </Button>
                          </a>
                        ) : (
                          <span className="muted" style={{ fontSize: "0.8rem" }}>No CV</span>
                        )}
                      </td>
                      <td>
                        <Badge variant="warning">{app.status}</Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          {/* ── Details button (new) ── */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailsApplicationId(app._id)}
                          >
                            <SearchIcon size={12} /> Details
                          </Button>

                          <Button
                            variant="brand"
                            size="sm"
                            onClick={() => {
                              setSelectedApplication(app);
                              setApplicationInterviewDate("");
                            }}
                          >
                            Create Interview
                          </Button>

                          <Button
                            size="sm"
                            style={{ backgroundColor: "#dc2626", color: "#fff", border: "none" }}
                            onClick={() => handleRejectApplication(app._id)}
                          >
                            Reject
                          </Button>

                          {/* Removes the candidature entirely (and cancels its
                              interview). Two-step: destructive and permanent. */}
                          {confirmRemoveId === app._id ? (
                            <>
                              <Button
                                size="sm"
                                style={{ backgroundColor: "#dc2626", color: "#fff", border: "none" }}
                                onClick={() => handleRemoveApplication(app._id)}
                              >
                                <TrashIcon size={12} /> Confirm remove
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveId(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Remove this candidate from your pipeline"
                              aria-label="Remove candidate"
                              onClick={() => setConfirmRemoveId(app._id)}
                            >
                              <TrashIcon size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {selectedApplication && (
              <Card style={{ marginTop: "1rem" }}>
                <CardHeader>
                  <CardTitle>Create Interview</CardTitle>
                  <CardDescription>
                    Schedule interview for {selectedApplication.candidate?.name} —{" "}
                    {selectedApplication.job?.title}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="form-stack">
                    <div className="form-group" style={{ maxWidth: 340 }}>
                      <Label htmlFor="applicationInterviewDate">Interview date</Label>
                      <Input
                        id="applicationInterviewDate"
                        type="datetime-local"
                        value={applicationInterviewDate}
                        onChange={(e) => setApplicationInterviewDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="row-actions">
                      <Button variant="brand" onClick={handleCreateInterviewFromApplication}>
                        Create Interview
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedApplication(null);
                          setApplicationInterviewDate("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  </>
)}

    </AppShell>
  );
}
