export const theme = {
  bg: '#0B0F1A',
  bgSecondary: '#111827',
  bgCard: '#141B2D',
  border: '#1C2235',
  accent: '#2563EB',
  accentBright: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  textPrimary: '#C8D4EE',
  textSecondary: '#7A8CAD',
  textMuted: '#4A5568',
  attack: '#F87171',
  midfield: '#FCD34D',
  defender: '#22D3EE',
  goalkeeper: '#A78BFA',
};

export const posColor = (pos) => {
  const map = {
    Attack: theme.attack,
    Midfield: theme.midfield,
    Defender: theme.defender,
    Goalkeeper: theme.goalkeeper,
  };
  return map[pos] || theme.textSecondary;
};

export const fmtValue = (eur) => {
  if (!eur || eur === 0) return '—';
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(1)}M`;
  if (eur >= 1_000) return `€${Math.round(eur / 1_000)}K`;
  return `€${eur}`;
};
