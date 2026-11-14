import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuthStore } from '../../stores/authStore';

export const NotFoundPage: React.FC = () => {
  useDocumentTitle('Page not found');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--bg-main)' }}>
      <EmptyState
        icon={<Compass size={28} />}
        title="Page not found"
        description="The page you are looking for doesn't exist or has moved."
        action={
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="btn btn-primary btn-md">
            {isAuthenticated ? 'Go to dashboard' : 'Go to home page'}
          </Link>
        }
      />
    </main>
  );
};
