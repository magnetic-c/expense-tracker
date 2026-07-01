import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Wally<span className="dot">.</span></div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Dashboard</NavLink>
          <NavLink to="/transactions" className={({ isActive }) => (isActive ? 'active' : '')}>Transactions</NavLink>
          <NavLink to="/budgets" className={({ isActive }) => (isActive ? 'active' : '')}>Budgets</NavLink>
          <NavLink to="/insights" className={({ isActive }) => (isActive ? 'active' : '')}>Insights</NavLink>
        </nav>
        <div className="sidebar-footer">
          Signed in as<br /><strong style={{ color: '#fff' }}>{user?.name}</strong>
          <br />
          <button onClick={handleLogout}>Log out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
