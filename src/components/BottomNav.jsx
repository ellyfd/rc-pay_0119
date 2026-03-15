import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Coffee, UtensilsCrossed, ShoppingCart, User } from 'lucide-react';
import { createPageUrl } from '@/utils';

const navItems = [
  { icon: Home, label: '首頁', path: '/' },
  { icon: UtensilsCrossed, label: '訂餐', path: createPageUrl('FoodOrder') },
  { icon: Coffee, label: '飲料', path: createPageUrl('DrinkOrder') },
  { icon: ShoppingCart, label: '團購', path: createPageUrl('GroupBuy') },
  { icon: User, label: '我的', path: createPageUrl('MemberDetail') },
];

// Pages where bottom nav should be hidden (detail/sub pages)
const hiddenOnPages = [
  '/DrinkOrderDetail',
  '/GroupBuyDetail',
  '/GroupBuyTemplates',
  '/AdminOrders',
  '/PendingApproval',
  '/ProductManagement',
  '/ProductCatalog',
  '/OrderHistoryByDate',
  '/OrderHistoryByMember',
];

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Hide on detail/sub pages
  if (hiddenOnPages.some(p => currentPath.startsWith(p))) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 md:hidden">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = path === '/'
            ? currentPath === '/'
            : currentPath.startsWith(path);

          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors ${
                isActive
                  ? 'text-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-[10px] leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area padding for notched phones */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
