import AdminOrders from './pages/AdminOrders';
import DrinkOrder from './pages/DrinkOrder';
import DrinkOrderDetail from './pages/DrinkOrderDetail';
import FoodOrder from './pages/FoodOrder';
import GroupBuy from './pages/GroupBuy';
import GroupBuyTemplates from './pages/GroupBuyTemplates';
import Home from './pages/Home';
import MemberDetail from './pages/MemberDetail';
import MemberManagement from './pages/MemberManagement';
import OrderHistoryByDate from './pages/OrderHistoryByDate';
import OrderHistoryByMember from './pages/OrderHistoryByMember';
import ProductCatalog from './pages/ProductCatalog';
import ProductManagement from './pages/ProductManagement';
import TransactionHistory from './pages/TransactionHistory';
import GroupBuyDetail from './pages/GroupBuyDetail';


export const PAGES = {
    "AdminOrders": AdminOrders,
    "DrinkOrder": DrinkOrder,
    "DrinkOrderDetail": DrinkOrderDetail,
    "FoodOrder": FoodOrder,
    "GroupBuy": GroupBuy,
    "GroupBuyTemplates": GroupBuyTemplates,
    "Home": Home,
    "MemberDetail": MemberDetail,
    "MemberManagement": MemberManagement,
    "OrderHistoryByDate": OrderHistoryByDate,
    "OrderHistoryByMember": OrderHistoryByMember,
    "ProductCatalog": ProductCatalog,
    "ProductManagement": ProductManagement,
    "TransactionHistory": TransactionHistory,
    "GroupBuyDetail": GroupBuyDetail,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};