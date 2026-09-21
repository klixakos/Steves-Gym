import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { ClientDashboard } from './components/ClientDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { Dumbbell, Shield, ArrowLeft } from 'lucide-react';

function AppContent() {
  const { user, userProfile, loading } = useAuth();
  const [previewAsClient, setPreviewAsClient] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center animate-pulse mb-3">
          <Dumbbell className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-stone-600">Loading CoreStudio Training...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const isAdmin = userProfile?.role === 'admin';

  // If user is Admin and toggled to client preview mode
  if (isAdmin && previewAsClient) {
    return (
      <div>
        <div className="bg-amber-500 text-stone-900 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-stone-900" />
            <span>Admin Live Client Preview — You are experiencing the app as a client would.</span>
          </div>
          <button
            id="return-to-admin-portal-btn"
            onClick={() => setPreviewAsClient(false)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Admin Dashboard</span>
          </button>
        </div>
        <ClientDashboard />
      </div>
    );
  }

  // Admin view
  if (isAdmin) {
    return <AdminDashboard onToggleClientPreview={() => setPreviewAsClient(true)} />;
  }

  // Regular Client view
  return <ClientDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
