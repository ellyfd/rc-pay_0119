// P2-9: 统一颜色映射（Member/GroupBuy/FoodOrder/DrinkOrder 共用）
export const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan'];

const colorClassMap = {
  'blue': 'bg-blue-500',
  'green': 'bg-emerald-500',
  'purple': 'bg-purple-500',
  'orange': 'bg-orange-500',
  'pink': 'bg-pink-500',
  'cyan': 'bg-cyan-500',
};

export const memberColorMap = {
  'red': '#ef4444',
  'blue': '#3b82f6',
  'green': '#22c55e',
  'yellow': '#eab308',
  'purple': '#a855f7',
  'pink': '#ec4899',
  'indigo': '#6366f1',
  'cyan': '#06b6d4',
  'amber': '#f59e0b',
  'orange': '#f97316',
  'lime': '#84cc16',
  'teal': '#14b8a6',
  'rose': '#f43f5e',
  'violet': '#7c3aed',
  'fuchsia': '#d946ef',
  'sky': '#0ea5e9',
};

export const getAvatarColorStyle = (color) => {
  return colorClassMap[color] || 'bg-slate-500';
};

export const getInitials = (name) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};