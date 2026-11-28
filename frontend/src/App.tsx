import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from './components/Toast/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { LoadingState } from './components/LoadingState/LoadingState';
import { AppLayout } from './layouts/AppLayout/AppLayout';
import { AuthLayout } from './layouts/AuthLayout/AuthLayout';
import { SeoManager } from './seo/SeoManager';
import { safeNextPath } from './utils/navigation';
import { CONTENT_PAGES } from './pages/Marketing/content';

const CONTENT_PATHS = CONTENT_PAGES.map((p) => p.path);

/* Every screen is its own chunk, so the first load ships only what it needs. */
type Preloadable<P extends object = object> = React.FC<P> & { preload: () => Promise<void> };

/**
 * A lazily loaded screen. `preload()` loads it ahead of time; once loaded it renders straight away
 * (no loading fallback), which keeps prerendered pages from flashing a spinner on start-up.
 */
const named = <K extends string, P extends object = object>(loader: () => Promise<{ [N in K]: React.ComponentType<P> }>, key: K): Preloadable<P> => {
  let loaded: React.ComponentType<P> | null = null;
  const load = () => loader().then((m): React.ComponentType<P> => {
    loaded = m[key];
    return loaded;
  });
  const Lazy = lazy(() => load().then((c) => ({ default: c })));
  const Screen = ((props: P) => (loaded ? React.createElement(loaded, props) : React.createElement(Lazy, props))) as Preloadable<P>;
  Screen.preload = () => load().then(() => undefined);
  return Screen;
};

const LandingPage = named(() => import('./pages/Landing/LandingPage'), 'LandingPage');
const LoginPage = named(() => import('./pages/Login/LoginPage'), 'LoginPage');
const RegisterPage = named(() => import('./pages/Register/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = named(() => import('./pages/PasswordReset/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = named(() => import('./pages/PasswordReset/ResetPasswordPage'), 'ResetPasswordPage');
const DashboardPage = named(() => import('./pages/Dashboard/DashboardPage'), 'DashboardPage');
const ProjectsPage = named(() => import('./pages/Projects/ProjectsPage'), 'ProjectsPage');
const CreateProjectPage = named(() => import('./pages/CreateProject/CreateProjectPage'), 'CreateProjectPage');
const ProjectDetailsPage = named(() => import('./pages/ProjectDetails/ProjectDetailsPage'), 'ProjectDetailsPage');
const SettingsPage = named(() => import('./pages/Settings/SettingsPage'), 'SettingsPage');
const ProfilePage = named(() => import('./pages/Profile/ProfilePage'), 'ProfilePage');
const AdminReviewsPage = named(() => import('./pages/Admin/AdminReviewsPage'), 'AdminReviewsPage');
const AdminPaymentsPage = named(() => import('./pages/Admin/AdminPaymentsPage'), 'AdminPaymentsPage');
const AdminSignupsPage = named(() => import('./pages/Admin/AdminSignupsPage'), 'AdminSignupsPage');
const AdminUsersPage = named(() => import('./pages/Admin/AdminUsersPage'), 'AdminUsersPage');
const BillingPage = named(() => import('./pages/Billing/BillingPage'), 'BillingPage');
const NotFoundPage = named(() => import('./pages/NotFound/NotFoundPage'), 'NotFoundPage');
const VideoEditorPage = named(() => import('./pages/VideoEditor/VideoEditorPage'), 'VideoEditorPage');
const StudioEditorPage = named(() => import('./pages/Editor/StudioEditorPage'), 'StudioEditorPage');
const ContentPage = named<'ContentPage', { path: string }>(() => import('./pages/Marketing/ContentPage'), 'ContentPage');
const GuidesPage = named<'GuidesPage', { lang?: 'en' | 'si' }>(() => import('./pages/Marketing/ContentPage'), 'GuidesPage');
const PrivacyPage = named<'PrivacyPage'>(() => import('./pages/Marketing/PrivacyPage'), 'PrivacyPage');

/** Loads the screen of a public page before the first render (see main.tsx). */
export function preloadPublicPage(pathname: string): Promise<void> {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return LandingPage.preload();
  if (path === '/guides' || path === '/si/guides') return GuidesPage.preload();
  if (path === '/privacy') return PrivacyPage.preload();
  if (CONTENT_PATHS.includes(path)) return ContentPage.preload();
  return Promise.resolve();
}

const PageFallback = () => <LoadingState label="Loading…" />;

/** Signed-in users skip the marketing and auth pages (to `?next=` when given, e.g. "Get Pro" → /billing). */
const GuestRoute: React.FC = () => {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const [params] = useSearchParams();
  // The page shows while sign-in is checked (no spinner over a prerendered page); signed-in users move on after.
  return isInitialized && isAuthenticated ? <Navigate to={safeNextPath(params.get('next'))} replace /> : <Outlet />;
};

const RoutedApp: React.FC = () => {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname} fullScreen>
      <SeoManager />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/" element={<LandingPage />} />
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>
          </Route>
          {/* Opened from the reset email: works whether or not this browser is signed in. */}
          <Route element={<AuthLayout />}>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/create" element={<CreateProjectPage />} />
              <Route path="/projects/:uuid" element={<ProjectDetailsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin/reviews" element={<AdminReviewsPage />} />
              <Route path="/admin/payments" element={<AdminPaymentsPage />} />
              <Route path="/admin/signups" element={<AdminSignupsPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/billing" element={<BillingPage />} />
            </Route>
            {/* Full-screen multi-track video editor */}
            <Route
              path="/video-editor"
              element={
                <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: 'var(--editor-bg)' }} />}>
                  <VideoEditorPage />
                </Suspense>
              }
            />
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

          {/* Public content pages: open to everyone, signed in or not. */}
          {CONTENT_PATHS.map((path) => <Route key={path} path={path} element={<ContentPage path={path} />} />)}
          <Route path="/guides" element={<GuidesPage />} />
          <Route path="/si/guides" element={<GuidesPage lang="si" />} />
          <Route path="/privacy" element={<PrivacyPage />} />
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
