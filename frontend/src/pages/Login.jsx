import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { BrandMark } from "../components/BrandMark";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Alert } from "../components/ui/Alert";
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  AlertTriangleIcon,
} from "../components/icons";

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/users/login", formData);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      if (res.data.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-brand">
          <BrandMark size={38} />
          <span className="auth-brand-copy">
            <strong>Recruitment App</strong>
            <small>Modern hiring workspace</small>
          </span>
        </div>

        <div className="auth-showcase">
          <span className="auth-kicker">Talent operations, simplified</span>
          <h2>Build better teams with a clearer hiring process.</h2>
          <p>
            Keep interviews, candidate evaluation, and collaboration in one focused workspace.
          </p>
          <div className="auth-feature-list">
            <div><span>01</span><strong>Structured interviews</strong></div>
            <div><span>02</span><strong>Shared candidate insights</strong></div>
            <div><span>03</span><strong>Real-time collaboration</strong></div>
          </div>
        </div>

        <div className="auth-trust-line">
          <span className="auth-status-dot" />
          Secure, focused, and built for modern recruitment teams
        </div>
      </aside>

      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <BrandMark size={36} />
            <strong>Recruitment App</strong>
          </div>
          <div className="auth-heading">
            <span className="auth-eyebrow">Secure workspace</span>
            <h1>Welcome back</h1>
            <p>Sign in to manage interviews, candidates, and hiring activity.</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangleIcon size={16} />
              <div>{error}</div>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="form-stack">
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
                <span
                  className="input-suffix"
                  style={{ pointerEvents: "none" }}
                  aria-hidden
                >
                  <MailIcon size={14} />
                </span>
              </div>
            </div>

            <div className="form-group">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="#" className="text-xs muted" style={{ fontWeight: 500 }}>
                  Forgot password?
                </Link>
              </div>
              <div className="input-wrap">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
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
            </div>

            <Button
              type="submit"
              variant="brand"
              block
              disabled={loading}
            >
              <LockIcon size={14} />
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="auth-form-footer">
            Don't have an account?{" "}
            <Link to="/register" style={{ fontWeight: 500 }}>
              Create one
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
