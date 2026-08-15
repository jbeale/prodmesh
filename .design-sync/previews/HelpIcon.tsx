import { HelpIcon } from 'church-production-dashboard';

// HelpIcon is lucide's BookOpen, re-exported so callers opening the guide never
// import lucide directly — one icon, one meaning, one import.

export const Default = () => <HelpIcon />;

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <HelpIcon size={14} />
    <HelpIcon size={18} />
    <HelpIcon size={24} />
    <HelpIcon size={32} />
  </div>
);

export const InAButton = () => (
  <button className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
    <HelpIcon size={15} aria-hidden />
    Guide
  </button>
);
