import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from './components/Toast/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { LoadingState } from './components/LoadingState/LoadingState';
import { AppLayout } from './layouts/AppLayout/AppLayout';
import { AuthLayout } from './layouts/AuthLayout/AuthLayout';

/* Every screen is its own chunk, so the first load ships only what it needs. */
const named = <K extends string>(loader: () => Promise<{ [P in K]: React.ComponentType }>, key: K) =>
  lazy(() => loader().then((m) => ({ default: m[key] })));

const LandingPage = named(() => import('./pages/Landing/LandingPage'), 'LandingPage');
const LoginPage = named(() => import('./pages/Login/LoginPage'), 'LoginPage');
const RegisterPage = named(() => import('./pages/Register/RegisterPage'), 'RegisterPage');
const DashboardPage = named(() => import('./pages/Dashboard/DashboardPage'), 'DashboardPage');
const ProjectsPage = named(() => import('./pages/Projects/ProjectsPage'), 'ProjectsPage');
const CreateProjectPage = named(() => import('./pages/CreateProject/CreateProjectPage'), 'CreateProjectPage');
const ProjectDetailsPage = named(() => import('./pages/ProjectDetails/ProjectDetailsPage'), 'ProjectDetailsPage');
const SettingsPage = named(() => import('./pages/Settings/SettingsPage'), 'SettingsPage');
const ProfilePage = named(() => import('./pages/Profile/ProfilePage'), 'ProfilePage');
const NotFoundPage = named(() => import('./pages/NotFound/NotFoundPage'), 'NotFoundPage');
const StudioEditorPage = named(() => import('./pages/Editor/StudioEditorPage'), 'StudioEditorPage');

const PageFallback = () => <LoadingState label="Loading…" />;

/** Signed-in users skip the marketing and auth pages. */
const GuestRoute: React.FC = () => {
  const { isAuthenticated, isInitialized } = useAuthStore();
  if (!isInitialized) return <LoadingState fullScreen label="Loading…" />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
};

const RoutedApp: React.FC = () => {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname} fullScreen>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/" element={<LandingPage />} />
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/create" element={<CreateProjectPage />} />
              <Route path="/projects/:uuid" element={<ProjectDetailsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            {/* Full-screen studio editor */}
            <Route
              path="/projects/:uuid/editor"
              element={
                <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: 'var(--editor-bg)' }} />}>
                  <StudioEditorPage />
                </Suspense>
              }
            />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

export const App: React.FC = () => {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <RoutedApp />
      {/* One toast host for every screen, including the editor. */}
      <ToastContainer />
    </BrowserRouter>
  );
};

export default App;
