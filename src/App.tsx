import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import FlaggedMessageAlert from './components/FlaggedMessageAlert';
import CriticalCaseAlertToast from './components/CriticalCaseAlertToast';

// Auth pages
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ResetPassword from './pages/ResetPassword';

// App pages
import Dashboard from './pages/Dashboard';
import CriticalCases from './pages/CriticalCases';
import UserMonitoring from './pages/UserMonitoring';
import ChatReview from './pages/ChatReview';
import JournalReview from './pages/JournalReview';
import AIInsights from './pages/AIInsights';
import Reports from './pages/Reports';
import AdvisorChat from './pages/AdvisorChat';
import Settings from './pages/Settings';
import Resources from './pages/Resources';
import AdvisorProfile from './pages/AdvisorProfile';
import CallsOverview from './pages/CallsOverview';
import AdvisorRoom from './pages/AdvisorRoom';

function ProtectedLayout() {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/critical-cases" element={<CriticalCases />} />
              <Route path="/monitoring" element={<UserMonitoring />} />
              <Route path="/chat-review" element={<ChatReview />} />
              <Route path="/journal-review" element={<JournalReview />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/insights" element={<AIInsights />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/calls" element={<CallsOverview />} />
              <Route path="/chat" element={<AdvisorChat />} />
              <Route path="/advisor-room" element={<AdvisorRoom />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<AdvisorProfile />} />
            </Routes>
          </div>
        </main>
      </div>
      {/* Global flagged-message toast alerts — monitors group chat, AI chat & journals */}
      <FlaggedMessageAlert />
      {/* Global critical-case alert toasts — driven by advisors/{id}/alerts sub-collection */}
      <CriticalCaseAlertToast />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
