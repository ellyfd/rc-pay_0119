import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Home, ShoppingCart, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const isActive = (pageName) => {
    return currentPageName === pageName;
  };

  const isInternal = currentUser?.is_internal !== false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Navigation */}
      {currentUser && (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-1">
                {isInternal && (
                  <Link to={createPageUrl('Home')}>
                    <Button
                      variant="ghost"
                      className={isActive('Home') ? 'bg-slate-100' : ''}
                    >
                      <Home className="w-4 h-4 mr-2" />
                      首頁
                    </Button>
                  </Link>
                )}
                <Link to={createPageUrl('GroupBuy')}>
                  <Button
                    variant="ghost"
                    className={isActive('GroupBuy') ? 'bg-slate-100' : ''}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    團購專區
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">
                  {currentUser.full_name || currentUser.email}
                  {!isInternal && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">外部</span>}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-slate-600 hover:text-slate-800"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </nav>
      )}
      
      {/* Main Content */}
      <main>
        {children}
      </main>
    </div>
  );
}