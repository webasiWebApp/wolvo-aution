import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

// Layout route: requires an authenticated auctioneer (or admin). Other users
// are sent to the public home page; unauthenticated users to login. Auctioneer
// controls cannot be reached by URL manipulation — the route enforces the role.
export default function AuctioneerRoute() {
  const { user } = useAuth();
  return (
    <ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />}>
      {user && (user.role === 'auctioneer' || user.role === 'admin') ? <Outlet /> : <Navigate to="/" replace />}
    </ProtectedRoute>
  );
}