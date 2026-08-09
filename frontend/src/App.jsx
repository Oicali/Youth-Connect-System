// frontend/src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Connect from "@/pages/Connect";
import Users from "@/pages/Users";
import Profile from "@/pages/Profile";
import DashboardLayout from "@/layouts/DashboardLayout";

import { ThemeProvider } from "@/context/ThemeContext";
import { ErrorModalProvider } from "@/context/ErrorModalContext";

function App() {
  return (
    <ThemeProvider>
      <ErrorModalProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/connect" element={<Connect />} />
              <Route path="/users" element={<Users />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorModalProvider>
    </ThemeProvider>
  );
}

export default App;