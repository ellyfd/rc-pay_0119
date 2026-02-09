/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminOrders from './pages/AdminOrders';
import DrinkOrder from './pages/DrinkOrder';
import DrinkOrderDetail from './pages/DrinkOrderDetail';
import FoodOrder from './pages/FoodOrder';
import GroupBuy from './pages/GroupBuy';
import GroupBuyDetail from './pages/GroupBuyDetail';
import GroupBuyTemplates from './pages/GroupBuyTemplates';
import Home from './pages/Home';
import MemberDetail from './pages/MemberDetail';
import MemberManagement from './pages/MemberManagement';
import OrderHistoryByDate from './pages/OrderHistoryByDate';
import OrderHistoryByMember from './pages/OrderHistoryByMember';
import ProductCatalog from './pages/ProductCatalog';
import ProductManagement from './pages/ProductManagement';
import TransactionHistory from './pages/TransactionHistory';


export const PAGES = {
    "AdminOrders": AdminOrders,
    "DrinkOrder": DrinkOrder,
    "DrinkOrderDetail": DrinkOrderDetail,
    "FoodOrder": FoodOrder,
    "GroupBuy": GroupBuy,
    "GroupBuyDetail": GroupBuyDetail,
    "GroupBuyTemplates": GroupBuyTemplates,
    "Home": Home,
    "MemberDetail": MemberDetail,
    "MemberManagement": MemberManagement,
    "OrderHistoryByDate": OrderHistoryByDate,
    "OrderHistoryByMember": OrderHistoryByMember,
    "ProductCatalog": ProductCatalog,
    "ProductManagement": ProductManagement,
    "TransactionHistory": TransactionHistory,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};