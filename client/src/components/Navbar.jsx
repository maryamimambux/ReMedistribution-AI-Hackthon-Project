import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Heart, Menu, X, User, LogOut, LayoutDashboard, Pill, Settings, MessageSquare, Users, QrCode,
} from 'lucide-react';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, isVerified, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileOpen(false);
  };

  const roleLabels = {
    DONOR: 'Donor',
    PHARMACIST: 'Pharmacist',
    PATIENT: 'Patient',
    ADMIN: 'Admin',
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
              ReMedistribution
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/centers" className="text-sm font-medium text-gray-600 hover:text-emerald-700 transition-colors">
              Centers
            </Link>
            {user ? (
              <>
                {isVerified ? (
                  <>
                    <Link to="/dashboard" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-emerald-700 transition-colors">
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>

                    {user.role !== 'ADMIN' && (
                      <Link to="/my-queries" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-emerald-700 transition-colors">
                        <MessageSquare className="w-4 h-4" />
                        Support
                      </Link>
                    )}

                    {user.role === 'DONOR' && (
                      <Link to="/donate" className="text-sm font-medium text-gray-600 hover:text-emerald-700 transition-colors">
                        Donate Medicine
                      </Link>
                    )}
                    {user.role === 'PATIENT' && (
                      <>
                        <Link to="/request-medicine" className="text-sm font-medium text-gray-600 hover:text-emerald-700 transition-colors">
                          Request Medicine
                        </Link>
                        <Link to="/my-pickup-codes" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-emerald-700 transition-colors">
                          <QrCode className="w-4 h-4" />
                          Pickup Codes
                        </Link>
                      </>
                    )}
                    {user.role === 'PHARMACIST' && (
                      <Link to="/patient-requests" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-emerald-700 transition-colors">
                        <Users className="w-4 h-4" />
                        Patient Requests
                      </Link>
                    )}
                  </>
                ) : (
                  <Link to="/verify-email" className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors">
                    Verify Email
                  </Link>
                )}

                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                  {isVerified && <NotificationBell />}
                  <Link to="/profile" className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Profile">
                    <Settings className="w-4 h-4" />
                  </Link>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">{user.name}</span>
                    {isVerified ? (
                      <span className="badge-green text-[10px]">{roleLabels[user.role]}</span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Unverified</span>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-emerald-700 transition-colors">
                  Login
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white py-4 px-4 space-y-3">
          {user ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium">{user.name}</span>
                {isVerified ? (
                  <span className="badge-green text-[10px]">{roleLabels[user.role]}</span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Unverified</span>
                )}
              </div>
              {isVerified ? (
                <>
                  <Link to="/dashboard" className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                    Dashboard
                  </Link>
                  {user.role === 'PHARMACIST' && (
                    <Link to="/patient-requests" className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                      Patient Requests
                    </Link>
                  )}
                  {user.role === 'PATIENT' && (
                    <Link to="/my-pickup-codes" className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                      Pickup Codes
                    </Link>
                  )}
                  {user.role !== 'ADMIN' && (
                    <Link to="/my-queries" className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                      Support / Queries
                    </Link>
                  )}
                  <Link to="/notifications" className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                    Notifications
                  </Link>
                </>
              ) : (
                <Link to="/verify-email" className="block px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                  Verify Email
                </Link>
              )}
              <Link to="/profile" className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                Profile
              </Link>
              <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                Login
              </Link>
              <Link to="/register" className="block px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                Get Started
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
