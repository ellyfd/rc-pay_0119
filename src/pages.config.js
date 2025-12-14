import Home from './pages/Home';
import MemberDetail from './pages/MemberDetail';
import FoodOrder from './pages/FoodOrder';
import ProductManagement from './pages/ProductManagement';
import MemberManagement from './pages/MemberManagement';
import AdminOrders from './pages/AdminOrders';
import GroupBuy from './pages/GroupBuy';
import GroupBuyDetail from './pages/GroupBuyDetail';
import ProductCatalog from './pages/ProductCatalog';
import TransactionHistory from './pages/TransactionHistory';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "MemberDetail": MemberDetail,
    "FoodOrder": FoodOrder,
    "ProductManagement": ProductManagement,
    "MemberManagement": MemberManagement,
    "AdminOrders": AdminOrders,
    "GroupBuy": GroupBuy,
    "GroupBuyDetail": GroupBuyDetail,
    "ProductCatalog": ProductCatalog,
    "TransactionHistory": TransactionHistory,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};