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
import GroupBuyTemplates from './pages/GroupBuyTemplates';
import OrderHistoryByDate from './pages/OrderHistoryByDate';
import OrderHistoryByMember from './pages/OrderHistoryByMember';
import PublicGroupBuy from './pages/PublicGroupBuy';


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
    "GroupBuyTemplates": GroupBuyTemplates,
    "OrderHistoryByDate": OrderHistoryByDate,
    "OrderHistoryByMember": OrderHistoryByMember,
    "PublicGroupBuy": PublicGroupBuy,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};