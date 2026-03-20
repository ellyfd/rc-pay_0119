import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Coffee, UtensilsCrossed, ShoppingCart, User } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

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
  const { user: currentUser } = useCurrentUser();

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name'),
    staleTime: 30 * 1000,
  });

  const currentMember = useMemo(() =>
    members.find(m =>
      m.user_emails && currentUser && m.user_emails.includes(currentUser.email)
    ),
    [members, currentUser]
  );

  // Hide on detail/sub pages
  if (hiddenOnPages.some(p => currentPath.startsWith(p))) {
    return null;
  }

  const myPath = currentMember
    ? createPageUrl('MemberDetail') + '?id=' + currentMember.id
    : createPageUrl('MemberManagement');

  const navItems = [
    { icon: Home, label: '首頁', path: '/', matchPath: '/' },
    { icon: UtensilsCrossed, label: '訂餐', path: createPageUrl('FoodOrder'), matchPath: createPageUrl('FoodOrder') },
    { icon: Coffee, label: '飲料', path: createPageUrl('DrinkOrder'), matchPath: createPageUrl('DrinkOrder') },
    { icon: ShoppingCart, label: '團購', path: createPageUrl('GroupBuy'), matchPath: createPageUrl('GroupBuy') },
    { icon: User, label: '我的', path: myPath, matchPath: createPageUrl('MemberDetail') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 md:hidden">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ icon: Icon, label, path, matchPath }) => {
          const isActive = matchPath === '/'
            ? currentPath === '/'
            : currentPath.startsWith(matchPath);

          return (
            <Link
              key={label}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors ${
                isActive
                  ? 'text-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-xs leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>
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
