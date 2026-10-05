// frontend/src/App.jsx

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingModalProvider } from "@/context/LoadingModalContext";

// shared layout route for the public auth pages
import { AuthLayout } from "@/layouts/AuthLayout";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import CareGroup from "@/pages/CareGroup";
import Connect from "@/pages/Connect";
import Users from "@/pages/Users";
import Profile from "@/pages/Profile";
import DashboardLayout from "@/layouts/DashboardLayout";

import { ThemeProvider } from "@/context/ThemeContext";
import { ErrorModalProvider } from "@/context/ErrorModalContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppToaster } from "@/components/AppToaster";

function App() {
  return (
    <ThemeProvider>
      <LoadingModalProvider>
        <ErrorModalProvider>
          <TooltipProvider>
            <AppToaster />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                {/* public auth pages share one AuthLayout, outside AuthProvider */}
                <Route element={<AuthLayout />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                </Route>

                <Route
                  element={
                    <AuthProvider>
                      <Outlet />
                    </AuthProvider>
                  }
                >
                  <Route element={<ProtectedRoute />}>
                    <Route element={<DashboardLayout />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/connect" element={<Connect />} />
                      <Route path="/caregroup" element={<CareGroup />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/profile" element={<Profile />} />
                    </Route>
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ErrorModalProvider>
      </LoadingModalProvider>
    </ThemeProvider>
  );
}

export default App;
