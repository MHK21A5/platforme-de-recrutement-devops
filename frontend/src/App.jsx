import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import InterviewRoom from "./pages/InterviewRoom";
import QuizReportPage from "./pages/QuizReportPage";
import InterviewPrepPage from "./pages/InterviewPrepPage";
import { SocketProvider } from "./context/SocketContext";
import { ToastProvider } from "./context/ToastContext";
import { NotificationProvider } from "./context/NotificationContext";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
      <ToastProvider>
      <NotificationProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <AdminDashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/interview/:id"
          element={
            <PrivateRoute>
              <InterviewRoom />
            </PrivateRoute>
          }
        />

        <Route
          path="/quiz-report/:id"
          element={
            <PrivateRoute>
              <QuizReportPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/interview-prep"
          element={
            <PrivateRoute>
              <InterviewPrepPage />
            </PrivateRoute>
          }
        />
      </Routes>
      </NotificationProvider>
      </ToastProvider>
      </SocketProvider>
    </BrowserRouter>
  );
}