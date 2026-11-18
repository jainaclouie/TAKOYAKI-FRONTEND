import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BUSINESS_NAME } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  ownerOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', ownerOnly: true },
  { to: '/pos', label: 'New order' },
  { to: '/orders', label: 'Orders' },
  { to: '/products', label: 'Products', ownerOnly: true },
  { to: '/inventory', label: 'Inventory' },
  { to: '/expenses', label: 'Expenses', ownerOnly: true },
];

export default function Layout() {
  const { user, isOwner, logout } = useAuth();
  const items = NAV.filter((item) => !item.ownerOnly || isOwner);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">{BUSINESS_NAME}</div>
        <nav className="nav" aria-label="Main">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <strong>{user?.name}</strong>
            <span>{isOwner ? 'Owner' : 'Staff'}</span>
          </div>
          <button type="button" className="btn btn-ghost-dark btn-sm" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
