import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { TiltCard } from "../components/TiltCard";
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

const LOGO_URL = "http://localhost:5000/uploads/logo.png";

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
      {/* Left: brand panel with logo centered */}
      <aside className="auth-aside">
        {/* Top: brand name */}
        <div className="auth-brand">
          <img
            src={LOGO_URL}
            alt="Logo"
            style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 6 }}
          />
          <span>STB Recruitment</span>
        </div>

        {/* Center: big logo */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
          }}
        >
          <TiltCard maxTilt={8} style={{ transformStyle: "preserve-3d" }}>
            <img
              src={LOGO_URL}
              alt="Recruit Studio"
              style={{
                width: 180,
                height: 180,
                objectFit: "contain",
                filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.25))",
              }}
            />
          </TiltCard>
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
             STB Recruitment
            </div>
            <div style={{ fontSize: "0.9rem", opacity: 0.8, marginTop: "0.375rem" }}>
              Smart hiring, made simple.
            </div>
          </div>
        </div>

        {/* Bottom: quote */}
        <div className="auth-quote">
          <blockquote>
            "STB Recruitement cut our time-to-hire in half. Scheduling interviews
            finally feels effortless."
          </blockquote>
          <cite>— Nourhen M., Head of Talent</cite>
        </div>
      </aside>

      {/* Right: form */}
      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-heading">
            <h1>Welcome back</h1>
            <p>Sign in to your account to continue.</p>
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

          <p className="text-sm muted" style={{ textAlign: "center" }}>
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
