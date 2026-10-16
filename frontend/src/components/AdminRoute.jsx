import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

// Layout route: requires an authenticated admin. Non-admins are sent to the
// public home page; unauthenticated users are sent to login. Admin functions
// cannot be reached by URL manipulation because the route itself enforces the
// role check before any admin screen renders.
export default function AdminRoute() {
  const { user } = useAuth();
  return (
    <ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />}>
      {user && user.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />}
    </ProtectedRoute>
  );
}