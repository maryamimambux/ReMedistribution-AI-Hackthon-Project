import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, QrCode } from 'lucide-react';

const tabs = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/my-requests', label: 'My Requests', icon: ClipboardList },
  { to: '/my-pickup-codes', label: 'Pickup Codes', icon: QrCode },
];

export default function PatientTabs() {
  return (
    <div className="border-b border-gray-200 mb-8">
      <nav className="flex gap-6" aria-label="Patient tabs">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-emerald-600'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
