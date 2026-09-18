import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { TiltCard } from "../components/TiltCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Alert } from "../components/ui/Alert";
import {
  BriefcaseIcon,
  MailIcon,
  LockIcon,
  UserIcon,
  EyeIcon,
  EyeOffIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from "../components/icons";

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api.post("/users/register", formData);
      setSuccess("Account created successfully! Redirecting to sign in…");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-brand">
          <TiltCard maxTilt={12} style={{ borderRadius: 8 }}>
            <span className="auth-brand-mark">
              <BriefcaseIcon size={16} />
            </span>
          </TiltCard>
          <span>STB Recruitment</span>
        </div>

        <div className="auth-quote">
          <blockquote>
            "Join thousands of candidates landing their dream roles through
            structured, fair interviews."
          </blockquote>
          <cite>— The STB Recruit team</cite>
        </div>
      </aside>

      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-heading">
            <h1>Create your account</h1>
            <p>Sign up as a candidate — it takes less than a minute.</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangleIcon size={16} />
              <div>{error}</div>
            </Alert>
          )}
          {success && (
            <Alert variant="success">
              <CheckCircleIcon size={16} />
              <div>{success}</div>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="form-stack">
            <div className="form-group">
              <Label htmlFor="name">Full name</Label>
              <div className="input-wrap">
                <Input
                  id="name"
                  name="name"
                  placeholder="Jane Doe"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                />
                <span className="input-suffix" style={{ pointerEvents: "none" }} aria-hidden>
                  <UserIcon size={14} />
                </span>
              </div>
            </div>

            <div className="form-group">
              <Label htmlFor="email">Email</Label>
              <div className="input-wrap">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
                <span className="input-suffix" style={{ pointerEvents: "none" }} aria-hidden>
                  <MailIcon size={14} />
                </span>
              </div>
            </div>

            <div className="form-group">
              <Label htmlFor="password">Password</Label>
              <div className="input-wrap">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="input-suffix"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                </button>
              </div>
              <span className="text-xs muted">Use at least 8 characters with a mix of letters and numbers.</span>
            </div>

            <Button type="submit" variant="brand" block disabled={loading}>
              <LockIcon size={14} />
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="text-sm muted" style={{ textAlign: "center" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
