import AdminOrders from './pages/AdminOrders';
import DrinkOrder from './pages/DrinkOrder';
import DrinkOrderDetail from './pages/DrinkOrderDetail';
import FoodOrder from './pages/FoodOrder';
import GroupBuy from './pages/GroupBuy';
import GroupBuyDetail from './pages/GroupBuyDetail';
import GroupBuyTemplates from './pages/GroupBuyTemplates';
import Home from './pages/Home';
import MemberManagement from './pages/MemberManagement';
import OrderHistoryByDate from './pages/OrderHistoryByDate';
import OrderHistoryByMember from './pages/OrderHistoryByMember';
import ProductCatalog from './pages/ProductCatalog';
import ProductManagement from './pages/ProductManagement';
import TransactionHistory from './pages/TransactionHistory';
import MemberDetail from './pages/MemberDetail';


export const PAGES = {
    "AdminOrders": AdminOrders,
    "DrinkOrder": DrinkOrder,
    "DrinkOrderDetail": DrinkOrderDetail,
    "FoodOrder": FoodOrder,
    "GroupBuy": GroupBuy,
    "GroupBuyDetail": GroupBuyDetail,
    "GroupBuyTemplates": GroupBuyTemplates,
    "Home": Home,
    "MemberManagement": MemberManagement,
    "OrderHistoryByDate": OrderHistoryByDate,
    "OrderHistoryByMember": OrderHistoryByMember,
    "ProductCatalog": ProductCatalog,
    "ProductManagement": ProductManagement,
    "TransactionHistory": TransactionHistory,
    "MemberDetail": MemberDetail,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};