import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";

import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { Success } from "./pages/Success";
import { Feedback } from "./pages/Feedback";
import { Dashboard } from "./pages/Dashboard";
import { Footfall } from "./pages/Footfall";
import { FeedbackQR } from "./pages/FeedbackQR";
import { FeedbackList } from "./pages/FeedbackList";
import { Divert } from "./pages/Divert";
import { PMView } from "./pages/PMView";
import { Reports } from "./pages/Reports";
import { CashSettlement } from "./pages/CashSettlement";
import { VmChecklist } from "./pages/VmChecklist";
import { Attendance } from "./pages/Attendance";
import { Admin } from "./pages/Admin";
import { TVDisplay } from "./pages/TVDisplay";
import { Greeter } from "./pages/Greeter";

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <Routes>
        {/* Public Routes */}
        <Route path="/onboard" element={<Onboarding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/feedback-public" element={<Feedback />} />
        <Route path="/success" element={<Success />} />

        {/* Fullscreen Protected / PIN Routes */}
        <Route
          path="/app/tv"
          element={
            <ProtectedRoute page="tv">
              <TVDisplay />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/greeter"
          element={
            <ProtectedRoute page="greeter">
              <Greeter />
            </ProtectedRoute>
          }
        />

        {/* Protected App Layout & Routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="footfall" element={<ProtectedRoute page="footfall"><Footfall /></ProtectedRoute>} />
          <Route path="feedback-qr" element={<ProtectedRoute page="feedbackQr"><FeedbackQR /></ProtectedRoute>} />
          <Route path="feedback-list" element={<ProtectedRoute page="feedbackList"><FeedbackList /></ProtectedRoute>} />
          <Route path="divert" element={<ProtectedRoute page="divert"><Divert /></ProtectedRoute>} />
          <Route path="pm-view" element={<ProtectedRoute page="pmView"><PMView /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute page="reports"><Reports /></ProtectedRoute>} />
          <Route path="cash-settlement" element={<ProtectedRoute page="cash"><CashSettlement /></ProtectedRoute>} />
          <Route path="vm-checklist" element={<ProtectedRoute page="vmChecklist"><VmChecklist /></ProtectedRoute>} />
          <Route path="attendance" element={<ProtectedRoute page="attendance"><Attendance /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute page="admin"><Admin /></ProtectedRoute>} />
        </Route>

        {/* Root Fallback */}
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AuthProvider>
  );
}
