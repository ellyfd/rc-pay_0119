import Home from './pages/Home';
import MemberDetail from './pages/MemberDetail';
import FoodOrder from './pages/FoodOrder';
import ProductManagement from './pages/ProductManagement';
import MemberManagement from './pages/MemberManagement';
import AdminOrders from './pages/AdminOrders';
import GroupBuy from './pages/GroupBuy';
import GroupBuyDetail from './pages/GroupBuyDetail';


export const PAGES = {
    "Home": Home,
    "MemberDetail": MemberDetail,
    "FoodOrder": FoodOrder,
    "ProductManagement": ProductManagement,
    "MemberManagement": MemberManagement,
    "AdminOrders": AdminOrders,
    "GroupBuy": GroupBuy,
    "GroupBuyDetail": GroupBuyDetail,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};