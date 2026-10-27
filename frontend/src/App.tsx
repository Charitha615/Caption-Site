import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout/AppLayout';
import { AuthLayout } from './layouts/AuthLayout/AuthLayout';
import { LoginPage } from './pages/Login/LoginPage';
import { RegisterPage } from './pages/Register/RegisterPage';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { ProjectsPage } from './pages/Projects/ProjectsPage';
import { CreateProjectPage } from './pages/CreateProject/CreateProjectPage';
import { ProjectDetailsPage } from './pages/ProjectDetails/ProjectDetailsPage';
import { StudioEditorPage } from './pages/Editor/StudioEditorPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { ProfilePage } from './pages/Profile/ProfilePage';

export const App: React.FC = () => {
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Protected app routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/create" element={<CreateProjectPage />} />
            <Route path="/projects/:uuid" element={<ProjectDetailsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          {/* Fullscreen Studio Editor */}
          <Route path="/projects/:uuid/editor" element={<StudioEditorPage />} />
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
