import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { motion as Motion } from "framer-motion";
import { useToast } from "../context/useToast";
import { TiltCard } from "../components/TiltCard";
import { AppShell } from "../components/AppShell";
import { adminNav } from "../components/nav";
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
  ShieldIcon,
  UsersIcon,
  UserIcon,
  ClockIcon,
} from "../components/icons";

function roleVariant(role) {
  if (role === "admin") return "brand";
  if (role === "recruiter") return "info";
  return "secondary";
}
function statusVariant(s) {
  if (s === "finished" || s === "closed") return "success";
  if (s === "ongoing" || s === "open") return "info";
  return "warning";
}
function cap(s = "") {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
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

function UserAvatar({ user, size = 28 }) {
  const imageUrl = user?.profileImage || null;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={user?.name || "User"}
        className="avatar"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />
    );
  }

  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: 11 }}>
      {(user?.name || "?").slice(0, 2).toUpperCase()}
    </span>
  );
}

// ─── Empty job form defaults ────────────────────────────────────────────────
const emptyJobForm = {
  title: "",
  position: "",
  description: "",
  requiredSkills: "",
  experienceLevel: "junior",
  minExperienceYears: 0,
  location: "",
  status: "open",
  recruiter: "",
};

export default function AdminDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("overview");

  const [users, setUsers] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [quizResultsLoading, setQuizResultsLoading] = useState(false);
  const [quizResultsError, setQuizResultsError] = useState("");
  const [recruiters, setRecruiters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [roleFilter, setRoleFilter] = useState("");

  // ── forms ──────────────────────────────────────────────────────────────────
  const [recruiterForm, setRecruiterForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [interviewForm, setInterviewForm] = useState({
    title: "",
    recruiter: "",
    candidate: "",
    scheduledAt: "",
    status: "pending",
  });
  const [jobForm, setJobForm] = useState(emptyJobForm);

  // ── edit states ────────────────────────────────────────────────────────────
  const [editUserId, setEditUserId] = useState(null);
  const [editUserData, setEditUserData] = useState({
    name: "",
    email: "",
    password: "",
    role: "candidate",
  });

  const [editInterviewId, setEditInterviewId] = useState(null);
  const [editInterviewData, setEditInterviewData] = useState({
    title: "",
    recruiter: "",
    candidate: "",
    scheduledAt: "",
    status: "pending",
  });

  const [editJobId, setEditJobId] = useState(null);
  const [editJobData, setEditJobData] = useState(emptyJobForm);

  // ── data fetchers ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (role = "") => {
    try {
      const url = role ? `/users?role=${role}` : "/users";
      const res = await api.get(url);
      setUsers(res.data);

      const all = await api.get("/users");
      setRecruiters(all.data.filter((u) => u.role === "recruiter"));
      setCandidates(all.data.filter((u) => u.role === "candidate"));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load users");
    }
  }, [toast]);

  const fetchInterviews = useCallback(async () => {
    try {
      const res = await api.get("/interviews/admin/all");
      setInterviews(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load interviews");
    }
  }, [toast]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api.get("/jobs/admin/all");
      setJobs(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load jobs");
    }
  }, [toast]);

  const fetchQuizResults = useCallback(async () => {
    setQuizResultsLoading(true);
    setQuizResultsError("");
    try {
      const res = await api.get("/interviews/admin/quiz-results");
      setQuizResults(res.data);
    } catch (err) {
      console.error(err);
      setQuizResultsError(err.response?.data?.message || "Failed to load quiz reports");
      setQuizResults([]);
    } finally {
      setQuizResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchUsers();
      await fetchInterviews();
      await fetchJobs();
      await fetchQuizResults();
    })();
  }, [fetchUsers, fetchInterviews, fetchJobs, fetchQuizResults]);

  // ── handlers: recruiters ──────────────────────────────────────────────────
  const handleRecruiterChange = (e) =>
    setRecruiterForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleCreateRecruiter = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/users/recruiters", recruiterForm);
      toast.success(res.data.message || "Recruiter created.");
      setRecruiterForm({ name: "", email: "", password: "" });
      fetchUsers(roleFilter);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create recruiter");
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      toast.success("User deleted.");
      fetchUsers(roleFilter);
      fetchInterviews();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete user");
    }
  };

  // ── handlers: interviews ──────────────────────────────────────────────────
  const handleInterviewChange = (e) =>
    setInterviewForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleCreateInterview = async (e) => {
    e.preventDefault();
    try {
      await api.post("/interviews/admin/create", interviewForm);
      toast.success("Interview created.");
      setInterviewForm({
        title: "",
        recruiter: "",
        candidate: "",
        scheduledAt: "",
        status: "pending",
      });
      fetchInterviews();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create interview");
    }
  };

  const handleDeleteInterview = async (id) => {
    try {
      await api.delete(`/interviews/admin/${id}`);
      toast.success("Interview deleted.");
      fetchInterviews();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete interview");
    }
  };

  // ── handlers: jobs ────────────────────────────────────────────────────────
  const handleJobFormChange = (e) =>
    setJobForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleCreateJob = async (e) => {
    e.preventDefault();
    try {
      await api.post("/jobs/admin/create", jobForm);
      toast.success("Job created.");
      setJobForm(emptyJobForm);
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create job");
    }
  };

  const handleDeleteJob = async (id) => {
    try {
      await api.delete(`/jobs/admin/${id}`);
      toast.success("Job deleted.");
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete job");
    }
  };

  // ── handlers: filters ────────────────────────────────────────────────────
  const handleFilterChange = (e) => {
    const role = e.target.value;
    setRoleFilter(role);
    fetchUsers(role);
  };

  // ── user edit ─────────────────────────────────────────────────────────────
  const startEditUser = (u) => {
    setEditUserId(u._id);
    setEditUserData({
      name: u.name || "",
      email: u.email || "",
      password: "",
      role: u.role || "candidate",
    });
  };
  const cancelEditUser = () => {
    setEditUserId(null);
    setEditUserData({ name: "", email: "", password: "", role: "candidate" });
  };
  const handleEditUserChange = (e) =>
    setEditUserData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleUpdateUser = async (id) => {
    try {
      const payload = { ...editUserData };
      if (!payload.password) delete payload.password;
      await api.put(`/users/${id}`, payload);
      toast.success("User updated.");
      setEditUserId(null);
      fetchUsers(roleFilter);
      fetchInterviews();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update user");
    }
  };

  // ── interview edit ────────────────────────────────────────────────────────
  const startEditInterview = (i) => {
    setEditInterviewId(i._id);
    setEditInterviewData({
      title: i.title || "",
      recruiter: i.recruiter?._id || "",
      candidate: i.candidate?._id || "",
      scheduledAt: i.scheduledAt
        ? new Date(i.scheduledAt).toISOString().slice(0, 16)
        : "",
      status: i.status || "pending",
    });
  };
  const cancelEditInterview = () => {
    setEditInterviewId(null);
    setEditInterviewData({
      title: "",
      recruiter: "",
      candidate: "",
      scheduledAt: "",
      status: "pending",
    });
  };
  const handleEditInterviewChange = (e) =>
    setEditInterviewData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleUpdateInterview = async (id) => {
    try {
      await api.put(`/interviews/admin/${id}`, editInterviewData);
      toast.success("Interview updated.");
      setEditInterviewId(null);
      fetchInterviews();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update interview");
    }
  };

  // ── job edit ──────────────────────────────────────────────────────────────
  const startEditJob = (j) => {
    setEditJobId(j._id);
    setEditJobData({
      title: j.title || "",
      position: j.position || "",
      description: j.description || "",
      requiredSkills: Array.isArray(j.requiredSkills)
        ? j.requiredSkills.join(", ")
        : j.requiredSkills || "",
      experienceLevel: j.experienceLevel || "junior",
      minExperienceYears: j.minExperienceYears ?? 0,
      location: j.location || "",
      status: j.status || "open",
      recruiter: j.recruiter?._id || "",
    });
  };
  const cancelEditJob = () => {
    setEditJobId(null);
    setEditJobData(emptyJobForm);
  };
  const handleEditJobChange = (e) =>
    setEditJobData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleUpdateJob = async (id) => {
    try {
      await api.put(`/jobs/admin/${id}`, editJobData);
      toast.success("Job updated.");
      setEditJobId(null);
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update job");
    }
  };

  // ── stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const allUsers = [...recruiters, ...candidates, ...users.filter((u) => u.role === "admin")];
    const dedup = Array.from(new Map(allUsers.map((u) => [u._id, u])).values());
    return {
      users: dedup.length,
      recruiters: recruiters.length,
      candidates: candidates.length,
      interviews: interviews.length,
      jobs: jobs.length,
    };
  }, [users, recruiters, candidates, interviews, jobs]);

  return (
    <AppShell
      user={user}
      title="Admin Console"
      subtitle="Manage users, jobs, and interviews."
      nav={adminNav}
      activeKey={activeTab === "overview" ? "overview" : activeTab}
      onNav={(key) => {
        if (key === "overview") setActiveTab("overview");
        if (key === "users") setActiveTab("users");
        if (key === "jobs") setActiveTab("jobs");
        if (key === "interviews") setActiveTab("interviews");
        if (key === "admin") setActiveTab("overview");
      }}
    >

      {/* Tab row */}
      <div className="tab-row">
        <button
          className={`tab-btn${activeTab === "overview" ? " active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`tab-btn${activeTab === "users" ? " active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Users
        </button>
        <button
          className={`tab-btn${activeTab === "jobs" ? " active" : ""}`}
          onClick={() => setActiveTab("jobs")}
        >
          Jobs
        </button>
        <button
          className={`tab-btn${activeTab === "interviews" ? " active" : ""}`}
          onClick={() => setActiveTab("interviews")}
        >
          Interviews
        </button>
        <button
          className={`tab-btn${activeTab === "quizReports" ? " active" : ""}`}
          onClick={() => setActiveTab("quizReports")}
        >
          Quiz reports
        </button>
      </div>

      {/* ══════════════════ OVERVIEW ══════════════════ */}
      {activeTab === "overview" && (
        <>
          {/* Stats */}
          <div className="grid grid-4 gap-4">
            {[
              { label: "Total users", value: stats.users, trend: "All roles combined" },
              { label: "Recruiters", value: stats.recruiters, trend: "Active hiring managers" },
              { label: "Candidates", value: stats.candidates, trend: "Signed up to platform" },
              { label: "Jobs", value: stats.jobs, trend: "Across all recruiters" },
              { label: "Interviews", value: stats.interviews, trend: "Across all recruiters" },
            ].map((s, i) => (
              <Motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
              >
                <TiltCard maxTilt={4}>
                  <Card className="stat-card">
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value">{s.value}</div>
                    <div className="stat-trend">{s.trend}</div>
                  </Card>
                </TiltCard>
              </Motion.div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid grid-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Add a recruiter</CardTitle>
                <CardDescription>
                  Create a recruiter account with access to schedule interviews.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateRecruiter} className="form-stack">
                  <div className="form-group">
                    <Label htmlFor="r-name">Full name</Label>
                    <Input
                      id="r-name"
                      name="name"
                      placeholder="Jane Doe"
                      value={recruiterForm.name}
                      onChange={handleRecruiterChange}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <Label htmlFor="r-email">Email</Label>
                      <Input
                        id="r-email"
                        type="email"
                        name="email"
                        placeholder="jane@company.com"
                        value={recruiterForm.email}
                        onChange={handleRecruiterChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <Label htmlFor="r-password">Temporary password</Label>
                      <Input
                        id="r-password"
                        type="password"
                        name="password"
                        placeholder="At least 8 characters"
                        value={recruiterForm.password}
                        onChange={handleRecruiterChange}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Button type="submit" variant="brand">
                      <PlusIcon size={14} /> Create recruiter
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schedule an interview</CardTitle>
                <CardDescription>
                  Assign an interview directly between a recruiter and a candidate.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateInterview} className="form-stack">
                  <div className="form-group">
                    <Label htmlFor="i-title">Title</Label>
                    <Input
                      id="i-title"
                      name="title"
                      placeholder="e.g. System design round"
                      value={interviewForm.title}
                      onChange={handleInterviewChange}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <Label htmlFor="i-recruiter">Recruiter</Label>
                      <Select
                        id="i-recruiter"
                        name="recruiter"
                        value={interviewForm.recruiter}
                        onChange={handleInterviewChange}
                        required
                      >
                        <option value="">Select recruiter</option>
                        {recruiters.map((r) => (
                          <option key={r._id} value={r._id}>
                            {r.name} — {r.email}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="form-group">
                      <Label htmlFor="i-candidate">Candidate</Label>
                      <Select
                        id="i-candidate"
                        name="candidate"
                        value={interviewForm.candidate}
                        onChange={handleInterviewChange}
                        required
                      >
                        <option value="">Select candidate</option>
                        {candidates.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} — {c.email}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <Label htmlFor="i-date">Scheduled at</Label>
                      <Input
                        id="i-date"
                        type="datetime-local"
                        name="scheduledAt"
                        value={interviewForm.scheduledAt}
                        onChange={handleInterviewChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <Label htmlFor="i-status">Status</Label>
                      <Select
                        id="i-status"
                        name="status"
                        value={interviewForm.status}
                        onChange={handleInterviewChange}
                      >
                        <option value="pending">Pending</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="finished">Finished</option>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Button type="submit" variant="brand">
                      <PlusIcon size={14} /> Create interview
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
{/* Add Job form */}
          <Card>
            <CardHeader>
              <CardTitle>Add a job</CardTitle>
              <CardDescription>
                Create a new job posting and assign it to a recruiter.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateJob} className="form-stack">
                <div className="form-row">
                  <div className="form-group">
                    <Label htmlFor="j-title">Job title</Label>
                    <Input
                      id="j-title"
                      name="title"
                      placeholder="e.g. Software Engineer"
                      value={jobForm.title}
                      onChange={handleJobFormChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <Label htmlFor="j-position">Position</Label>
                    <Input
                      id="j-position"
                      name="position"
                      placeholder="e.g. Backend Developer"
                      value={jobForm.position}
                      onChange={handleJobFormChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <Label htmlFor="j-description">Description</Label>
                  <Input
                    id="j-description"
                    name="description"
                    placeholder="Brief job description"
                    value={jobForm.description}
                    onChange={handleJobFormChange}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <Label htmlFor="j-skills">Required skills (comma-separated)</Label>
                    <Input
                      id="j-skills"
                      name="requiredSkills"
                      placeholder="e.g. React, Node.js, MongoDB"
                      value={jobForm.requiredSkills}
                      onChange={handleJobFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <Label htmlFor="j-location">Location</Label>
                    <Input
                      id="j-location"
                      name="location"
                      placeholder="e.g. Remote / Paris"
                      value={jobForm.location}
                      onChange={handleJobFormChange}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <Label htmlFor="j-level">Experience level</Label>
                    <Select
                      id="j-level"
                      name="experienceLevel"
                      value={jobForm.experienceLevel}
                      onChange={handleJobFormChange}
                    >
                      <option value="intern">Intern</option>
                      <option value="junior">Junior</option>
                      <option value="mid">Mid</option>
                      <option value="senior">Senior</option>
                    </Select>
                  </div>
                  <div className="form-group">
                    <Label htmlFor="j-years">Min. years of experience</Label>
                    <Input
                      id="j-years"
                      type="number"
                      name="minExperienceYears"
                      min={0}
                      value={jobForm.minExperienceYears}
                      onChange={handleJobFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <Label htmlFor="j-status">Status</Label>
                    <Select
                      id="j-status"
                      name="status"
                      value={jobForm.status}
                      onChange={handleJobFormChange}
                    >
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                    </Select>
                  </div>
                  <div className="form-group">
                    <Label htmlFor="j-recruiter">Recruiter</Label>
                    <Select
                      id="j-recruiter"
                      name="recruiter"
                      value={jobForm.recruiter}
                      onChange={handleJobFormChange}
                      required
                    >
                      <option value="">Select recruiter</option>
                      {recruiters.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name} — {r.email}
                        </option>
                      ))}
                    </Select>
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


          </div>
        </>
      )}

      {/* ══════════════════ USERS ══════════════════ */}
      {activeTab === "users" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>
                  View, filter and manage every account on the platform.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={roleFilter}
                  onChange={handleFilterChange}
                  style={{ width: 180 }}
                >
                  <option value="">All roles</option>
                  <option value="candidate">Candidates</option>
                  <option value="recruiter">Recruiters</option>
                  <option value="admin">Admins</option>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent style={{ paddingTop: 0 }}>
            {users.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <UsersIcon size={16} />
                </span>
                <div className="font-medium" style={{ color: "var(--foreground)" }}>
                  No users found
                </div>
                <div>Try changing the role filter.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th style={{ width: 160 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isEditing = editUserId === u._id;
                      return (
                        <tr key={u._id}>
                          <td>
                            {isEditing ? (
                              <Input
                                name="name"
                                value={editUserData.name}
                                onChange={handleEditUserChange}
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <UserAvatar user={u} size={28} />
                                <span className="font-medium">{u.name}</span>
                              </div>
                            )}
                          </td>
                          <td className="muted">
                            {isEditing ? (
                              <Input
                                type="email"
                                name="email"
                                value={editUserData.email}
                                onChange={handleEditUserChange}
                              />
                            ) : (
                              u.email
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <Select
                                name="role"
                                value={editUserData.role}
                                onChange={handleEditUserChange}
                              >
                                <option value="candidate">Candidate</option>
                                <option value="recruiter">Recruiter</option>
                                <option value="admin">Admin</option>
                              </Select>
                            ) : (
                              <Badge variant={roleVariant(u.role)}>
                                {u.role === "admin" ? <ShieldIcon size={10} /> : <UserIcon size={10} />}
                                {cap(u.role)}
                              </Badge>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <>
                                <div className="form-group mb-2">
                                  <Input
                                    type="password"
                                    name="password"
                                    placeholder="New password (optional)"
                                    value={editUserData.password}
                                    onChange={handleEditUserChange}
                                  />
                                </div>
                                <div className="row-actions">
                                  <Button
                                    variant="brand"
                                    size="sm"
                                    onClick={() => handleUpdateUser(u._id)}
                                  >
                                    <SaveIcon size={12} /> Save
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={cancelEditUser}
                                    aria-label="Cancel"
                                  >
                                    <XIcon size={14} />
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div className="row-actions">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEditUser(u)}
                                >
                                  <PencilIcon size={12} /> Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteUser(u._id)}
                                  aria-label="Delete user"
                                >
                                  <TrashIcon size={14} />
                                </Button>
                              </div>
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
      )}

      {/* ══════════════════ JOBS ══════════════════ */}
      {activeTab === "jobs" && (
        <>
          

          {/* Jobs table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>All jobs</CardTitle>
                  <CardDescription>
                    Every job posting across the platform.
                  </CardDescription>
                </div>
                <Badge variant="outline">{jobs.length} total</Badge>
              </div>
            </CardHeader>
            <CardContent style={{ paddingTop: 0 }}>
              {jobs.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon">
                    <CalendarIcon size={16} />
                  </span>
                  <div className="font-medium" style={{ color: "var(--foreground)" }}>
                    No jobs yet
                  </div>
                  <div>Create one using the form above.</div>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Position</th>
                        <th>Recruiter</th>
                        <th>Location</th>
                        <th>Level</th>
                        <th>Status</th>
                        <th style={{ width: 140 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => {
                        const isEditing = editJobId === j._id;
                        return (
                          <>
                          <tr key={j._id}>
                            {/* Title */}
                            <td>
                              {isEditing ? (
                                <Input
                                  name="title"
                                  value={editJobData.title}
                                  onChange={handleEditJobChange}
                                />
                              ) : (
                                <span className="font-medium">{j.title}</span>
                              )}
                            </td>
                            {/* Position */}
                            <td className="muted">
                              {isEditing ? (
                                <Input
                                  name="position"
                                  value={editJobData.position}
                                  onChange={handleEditJobChange}
                                />
                              ) : (
                                j.position || "—"
                              )}
                            </td>
                            {/* Recruiter */}
                            <td className="muted">
                              {isEditing ? (
                                <Select
                                  name="recruiter"
                                  value={editJobData.recruiter}
                                  onChange={handleEditJobChange}
                                >
                                  <option value="">Select recruiter</option>
                                  {recruiters.map((r) => (
                                    <option key={r._id} value={r._id}>
                                      {r.name}
                                    </option>
                                  ))}
                                </Select>
                              ) : (
                                j.recruiter?.name || "—"
                              )}
                            </td>
                            {/* Location */}
                            <td className="muted">
                              {isEditing ? (
                                <Input
                                  name="location"
                                  value={editJobData.location}
                                  onChange={handleEditJobChange}
                                />
                              ) : (
                                j.location || "—"
                              )}
                            </td>
                            {/* Level */}
                            <td className="muted">
                              {isEditing ? (
                                <Select
                                  name="experienceLevel"
                                  value={editJobData.experienceLevel}
                                  onChange={handleEditJobChange}
                                >
                                  <option value="intern">Intern</option>
                                  <option value="junior">Junior</option>
                                  <option value="mid">Mid</option>
                                  <option value="senior">Senior</option>
                                </Select>
                              ) : (
                                cap(j.experienceLevel)
                              )}
                            </td>
                            {/* Status */}
                            <td>
                              {isEditing ? (
                                <Select
                                  name="status"
                                  value={editJobData.status}
                                  onChange={handleEditJobChange}
                                >
                                  <option value="open">Open</option>
                                  <option value="closed">Closed</option>
                                </Select>
                              ) : (
                                <Badge variant={statusVariant(j.status)}>
                                  {cap(j.status)}
                                </Badge>
                              )}
                            </td>
                            {/* Actions */}
                            <td>
                              {isEditing ? (
                                <div className="row-actions">
                                  <Button
                                    variant="brand"
                                    size="sm"
                                    onClick={() => handleUpdateJob(j._id)}
                                  >
                                    <SaveIcon size={12} /> Save
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={cancelEditJob}
                                    aria-label="Cancel"
                                  >
                                    <XIcon size={14} />
                                  </Button>
                                </div>
                              ) : (
                                <div className="row-actions">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => startEditJob(j)}
                                  >
                                    <PencilIcon size={12} /> Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteJob(j._id)}
                                    aria-label="Delete job"
                                  >
                                    <TrashIcon size={14} />
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {/* Expanded edit row for extra fields */}
                          {isEditing && (
                            <tr key={`${j._id}-extra`} style={{ background: "var(--muted, #f9f9f9)" }}>
                              <td colSpan={7} style={{ padding: "10px 16px 14px" }}>
                                <div className="form-row" style={{ gap: 12 }}>
                                  <div className="form-group" style={{ flex: 2 }}>
                                    <Label>Required skills (comma-separated)</Label>
                                    <Input
                                      name="requiredSkills"
                                      placeholder="e.g. React, Node.js, MongoDB"
                                      value={editJobData.requiredSkills}
                                      onChange={handleEditJobChange}
                                    />
                                  </div>
                                  <div className="form-group" style={{ flex: 1 }}>
                                    <Label>Min. years of experience</Label>
                                    <Input
                                      type="number"
                                      name="minExperienceYears"
                                      min={0}
                                      value={editJobData.minExperienceYears}
                                      onChange={handleEditJobChange}
                                    />
                                  </div>
                                  <div className="form-group" style={{ flex: 3 }}>
                                    <Label>Description</Label>
                                    <Input
                                      name="description"
                                      placeholder="Brief job description"
                                      value={editJobData.description}
                                      onChange={handleEditJobChange}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ══════════════════ INTERVIEWS ══════════════════ */}
      {activeTab === "interviews" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>All interviews</CardTitle>
                <CardDescription>
                  Every interview scheduled across the platform.
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
                <div>Schedule one from the Overview tab.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Recruiter</th>
                      <th>Candidate</th>
                      <th>Scheduled</th>
                      <th>Status</th>
                      <th style={{ width: 140 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {interviews.map((i) => {
                      const isEditing = editInterviewId === i._id;
                      return (
                        <tr key={i._id}>
                          <td>
                            {isEditing ? (
                              <Input
                                name="title"
                                value={editInterviewData.title}
                                onChange={handleEditInterviewChange}
                              />
                            ) : (
                              <span className="font-medium">{i.title}</span>
                            )}
                          </td>
                          <td className="muted">
                            {isEditing ? (
                              <Select
                                name="recruiter"
                                value={editInterviewData.recruiter}
                                onChange={handleEditInterviewChange}
                              >
                                <option value="">Select recruiter</option>
                                {recruiters.map((r) => (
                                  <option key={r._id} value={r._id}>
                                    {r.name}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              i.recruiter?.name || "—"
                            )}
                          </td>
                          <td className="muted">
                            {isEditing ? (
                              <Select
                                name="candidate"
                                value={editInterviewData.candidate}
                                onChange={handleEditInterviewChange}
                              >
                                <option value="">Select candidate</option>
                                {candidates.map((c) => (
                                  <option key={c._id} value={c._id}>
                                    {c.name}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              i.candidate?.name || "—"
                            )}
                          </td>
                          <td className="muted">
                            {isEditing ? (
                              <Input
                                type="datetime-local"
                                name="scheduledAt"
                                value={editInterviewData.scheduledAt}
                                onChange={handleEditInterviewChange}
                              />
                            ) : (
                              formatDate(i.scheduledAt)
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <Select
                                name="status"
                                value={editInterviewData.status}
                                onChange={handleEditInterviewChange}
                              >
                                <option value="pending">Pending</option>
                                <option value="ongoing">Ongoing</option>
                                <option value="finished">Finished</option>
                              </Select>
                            ) : (
                              <Badge variant={statusVariant(i.status)}>
                                <ClockIcon size={10} />
                                {cap(i.status)}
                              </Badge>
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
                                  onClick={cancelEditInterview}
                                  aria-label="Cancel"
                                >
                                  <XIcon size={14} />
                                </Button>
                              </div>
                            ) : (
                              <div className="row-actions">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEditInterview(i)}
                                >
                                  <PencilIcon size={12} /> Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteInterview(i._id)}
                                  aria-label="Delete interview"
                                >
                                  <TrashIcon size={14} />
                                </Button>
                              </div>
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
      )}

      {activeTab === "quizReports" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Completed quiz reports</CardTitle>
                <CardDescription>
                  Review saved quiz results and candidate performance across all interviews.
                </CardDescription>
              </div>
              <Badge variant="outline">{quizResults.length} reports</Badge>
            </div>
          </CardHeader>
          <CardContent style={{ paddingTop: 0 }}>
            {quizResultsLoading ? (
              <div className="empty-state">
                <div className="font-medium">Loading quiz reports…</div>
              </div>
            ) : quizResultsError ? (
              <Alert variant="destructive">
                <AlertTriangleIcon size={16} /> {quizResultsError}
              </Alert>
            ) : quizResults.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <CheckCircleIcon size={16} />
                </span>
                <div className="font-medium">No completed quiz reports yet</div>
                <div>Once a quiz is finished, the results will appear here.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Recruiter</th>
                      <th>Job</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Answered</th>
                      <th>Completed</th>
                      <th style={{ width: 160 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizResults.map((report) => (
                      <tr
                        key={report._id}
                        style={{ cursor: "pointer" }}
                        onClick={() => navigate(`/quiz-report/${report._id}`, { state: { report } })}
                      >
                        <td>{report.candidate?.name || "—"}</td>
                        <td>{report.recruiter?.name || "—"}</td>
                        <td>{report.jobTitle || report.jobPosition || report.job?.title || "—"}</td>
                        <td>
                          <strong style={{ color: report.score >= 50 ? "var(--success)" : "var(--destructive)" }}>
                            {report.score}%
                          </strong>
                        </td>
                        <td>
                          <Badge variant={report.passed ? "success" : "destructive"}>
                            {report.passed ? "Passed" : "Needs review"}
                          </Badge>
                        </td>
                        <td>
                          {report.answeredCount}/{report.totalQuestions}
                        </td>
                        <td>{report.completedAt ? formatDate(report.completedAt) : "—"}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="row-actions">
                            <button
                              className="btn btn-brand btn-sm"
                              onClick={() => navigate(`/quiz-report/${report._id}`, { state: { report } })}
                            >
                              View report
                            </button>
                            <a
                              className="btn btn-outline btn-sm"
                              href={`/interview/${report.interview?._id || report.interview}`}
                            >
                              Interview
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
