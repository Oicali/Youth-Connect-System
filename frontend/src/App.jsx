// frontend/src/App.jsx

import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingModalProvider } from "@/context/LoadingModalContext";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import CareGroup from "@/pages/CareGroup";
import Connect from "@/pages/Connect";
import Users from "@/pages/Users";
import Profile from "@/pages/Profile";
import DashboardLayout from "@/layouts/DashboardLayout";

import { ThemeProvider } from "@/context/ThemeContext";
import { ErrorModalProvider } from "@/context/ErrorModalContext";
import { AuthProvider } from "@/context/AuthContext";
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
            <Route path="/login" element={<Login />} />

            <Route
              element={
                <AuthProvider>
                  <Outlet />
                </AuthProvider>
              }
            >
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />

                <Route path="/connect" element={<Connect />} />
                <Route path="/caregroup" element={<CareGroup />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/users" element={<Users />} />
                <Route path="/profile" element={<Profile />} />
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