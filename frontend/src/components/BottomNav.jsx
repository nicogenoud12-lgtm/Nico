import { NAV_ITEMS } from '../constants/data.js';

export default function BottomNav({ screen, onNav }) {
  return (
    <div className="nav">
      {NAV_ITEMS.map(n => (
        <div
          key={n.id}
          className={`nav-item ${screen === n.id ? 'active' : ''}`}
          onClick={() => onNav(n.id)}
        >
          <span className="nav-icon">{n.icon}</span>
          <span>{n.label}</span>
        </div>
      ))}
    </div>
  );
}
