import './App.css'
import { Toaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import BottomNav from '@/components/BottomNav';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageTransition from '@/components/PageTransition';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}><PageTransition>{children}</PageTransition></Layout>
  : <PageTransition>{children}</PageTransition>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <LoadingSpinner message="" size="lg" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <>
      <div className="pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={<Navigate to="/Home" replace />} />
          <Route path="/Home" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/TransactionHistory" element={<PageTransition><TransactionHistory /></PageTransition>} />
          <Route path="/MemberDetail" element={<PageTransition><MemberDetail /></PageTransition>} />
          <Route path="/MemberManagement" element={<PageTransition><MemberManagement /></PageTransition>} />
          <Route path="/FoodOrder" element={<PageTransition><FoodOrder /></PageTransition>} />
          <Route path="/DrinkOrder" element={<PageTransition><DrinkOrder /></PageTransition>} />
          <Route path="/DrinkOrderDetail" element={<PageTransition><DrinkOrderDetail /></PageTransition>} />
          <Route path="/GroupBuy" element={<PageTransition><GroupBuy /></PageTransition>} />
          <Route path="/GroupBuyDetail" element={<PageTransition><GroupBuyDetail /></PageTransition>} />
          <Route path="/GroupBuyTemplates" element={<PageTransition><GroupBuyTemplates /></PageTransition>} />
          <Route path="/PendingApproval" element={<PageTransition><PendingApproval /></PageTransition>} />
          <Route path="/AdminOrders" element={<PageTransition><AdminOrders /></PageTransition>} />
          <Route path="/OrderHistoryByDate" element={<PageTransition><OrderHistoryByDate /></PageTransition>} />
          <Route path="/OrderHistoryByMember" element={<PageTransition><OrderHistoryByMember /></PageTransition>} />
          <Route path="/ProductManagement" element={<PageTransition><ProductManagement /></PageTransition>} />
          <Route path="/ProductCatalog" element={<PageTransition><ProductCatalog /></PageTransition>} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </div>
      <BottomNav />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App