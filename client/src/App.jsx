import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useSocket } from './hooks/useSocket';

// Layout
import Navbar from './components/Navbar';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import MyQueries from './pages/MyQueries';
import CollectionCenters from './pages/CollectionCenters';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Donor
import DonorDashboard from './pages/donor/DonorDashboard';
import DonateMedicine from './pages/donor/DonateMedicine';
import MyDonations from './pages/donor/MyDonations';

// Pharmacist
import PharmacistDashboard from './pages/pharmacist/PharmacistDashboard';
import VerifyDonation from './pages/pharmacist/VerifyDonation';
import Inventory from './pages/pharmacist/Inventory';
import PickupVerification from './pages/pharmacist/PickupVerification';
import PatientRequests from './pages/pharmacist/PatientRequests';

// Patient
import PatientDashboard from './pages/patient/PatientDashboard';
import RequestMedicine from './pages/patient/RequestMedicine';
import MyRequests from './pages/patient/MyRequests';
import MyPickupCodes from './pages/patient/MyPickupCodes';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';

function App() {
  const { user } = useAuth();
  // Initialize socket connection when user is logged in
  useSocket(user);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
        <Route path="/centers" element={<CollectionCenters />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected — route by role */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            {user?.role === 'DONOR' && <DonorDashboard />}
            {user?.role === 'PHARMACIST' && <PharmacistDashboard />}
            {user?.role === 'PATIENT' && <PatientDashboard />}
            {user?.role === 'ADMIN' && <AdminDashboard />}
          </ProtectedRoute>
        } />

        {/* Shared protected routes */}
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/my-queries" element={<ProtectedRoute roles={['DONOR', 'PATIENT', 'PHARMACIST']}><MyQueries /></ProtectedRoute>} />
        <Route path="/verify-email" element={<ProtectedRoute><VerifyEmail /></ProtectedRoute>} />

        {/* Donor routes */}
        <Route path="/donate" element={<ProtectedRoute roles={['DONOR']}><DonateMedicine /></ProtectedRoute>} />
        <Route path="/my-donations" element={<ProtectedRoute roles={['DONOR']}><MyDonations /></ProtectedRoute>} />

        {/* Pharmacist routes */}
        <Route path="/verify/:id" element={<ProtectedRoute roles={['PHARMACIST', 'ADMIN']}><VerifyDonation /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute roles={['PHARMACIST', 'ADMIN']}><Inventory /></ProtectedRoute>} />
        <Route path="/pickup" element={<ProtectedRoute roles={['PHARMACIST', 'ADMIN']}><PickupVerification /></ProtectedRoute>} />
        <Route path="/patient-requests" element={<ProtectedRoute roles={['PHARMACIST', 'ADMIN']}><PatientRequests /></ProtectedRoute>} />

        {/* Patient routes */}
        <Route path="/request-medicine" element={<ProtectedRoute roles={['PATIENT']}><RequestMedicine /></ProtectedRoute>} />
        <Route path="/my-requests" element={<ProtectedRoute roles={['PATIENT']}><MyRequests /></ProtectedRoute>} />
        <Route path="/my-pickup-codes" element={<ProtectedRoute roles={['PATIENT']}><MyPickupCodes /></ProtectedRoute>} />

        {/* 404 */}
        <Route path="*" element={
          <div className="page-container text-center py-20">
            <h1 className="text-6xl font-bold text-gray-300">404</h1>
            <p className="text-xl text-gray-500 mt-4">Page not found</p>
          </div>
        } />
      </Routes>
    </div>
  );
}

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  // Unverified users can only access the verification page and profile (where they can resend the code).
  const allowedWhileUnverified = ['/verify-email', '/profile'];
  const currentPath = window.location.pathname;
  if (!user.emailVerified && !allowedWhileUnverified.some((p) => currentPath.startsWith(p))) {
    return <Navigate to="/verify-email" replace />;
  }

  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;

  return children;
}

export default App;
