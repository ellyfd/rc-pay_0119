import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { useQuery } from '@tanstack/react-query';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Package, Calendar } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { formatTaiwanTime } from "@/components/utils/dateUtils";
import { Input } from "@/components/ui/input";
import { parseOrderItems } from "@/components/utils/orderItemUtils";

export default function OrderHistoryByDate() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const { data: orders = [], isLoading: ordersLoading, refetch } = useQuery({
    queryKey: ['ordersByDate', startDate, endDate],
    queryFn: async () => {
      if (!startDate || !endDate) return [];
      const allOrders = await base44.entities.Order.list('-order_date');
      return allOrders.filter(order => 
        order.order_date >= startDate && order.order_date <= endDate
      );
    },
    enabled: false
  });

  // P1-7: 稳定化 queryKey，避免 orders 引用变化导致重新查询
  const orderIds = useMemo(
    () => orders.map(o => o.id).sort().join(','),
    [orders]
  );

  const { data: orderItems = [] } = useQuery({
    queryKey: ['orderItemsByDate', orderIds],
    queryFn: async () => {
      if (orders.length === 0) return [];
      const allItems = await base44.entities.OrderItem.list();
      return allItems.filter(item => orders.some(o => o.id === item.order_id));
    },
    enabled: orders.length > 0
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const handleSearch = () => {
    if (!startDate || !endDate) {
      toast.error('請選擇開始和結束日期');
      return;
    }
    if (startDate > endDate) {
      toast.error('開始日期不能晚於結束日期');
      return;
    }
    setHasSearched(true);
    refetch();
  };

  const getOrderItems = (orderId) => {
    return orderItems.filter(item => item.order_id === orderId);
  };

  const totalAmount = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

  // Group orders by date
  const ordersByDate = orders.reduce((acc, order) => {
    if (!acc[order.order_date]) {
      acc[order.order_date] = [];
    }
    acc[order.order_date].push(order);
    return acc;
  }, {});

  const mealBoxes = products.filter(p => p.category === 'meal_box');
  const sideDishProducts = products.filter(p => p.category === 'side_dish');

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="bg-emerald-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link to={createPageUrl('AdminOrders')}>
            <Button variant="ghost" className="text-white hover:bg-emerald-500 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回訂單管理
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">按日期查詢訂單</h1>
              <p className="text-emerald-100 text-sm">選擇日期區間查詢歷史訂單</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <Card className="p-4 sm:p-6 mb-6">
          <div className="space-y-3">
            <div className="flex items-end gap-2 sm:gap-4">
              <div className="w-[140px] sm:flex-1">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-2">開始</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-3"
                />
              </div>
              <div className="w-[140px] sm:flex-1">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-2">結束</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-3"
                />
              </div>
            </div>
            <Button
              onClick={handleSearch}
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
            >
              <Calendar className="w-4 h-4 mr-2" />
              查詢
            </Button>
          </div>
        </Card>

        {hasSearched && (
          <>
            {ordersLoading ? (
              <Card className="p-8 text-center">
                <div className="w-12 h-12 border-4 border-emerald-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-500">載入中...</p>
              </Card>
            ) : orders.length === 0 ? (
               <Card className="p-8 text-center border-dashed">
                 <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                 <p className="text-slate-500">此日期區間沒有訂單</p>
               </Card>
             ) : (
               <>
                 <Card className="p-4 mb-6 bg-emerald-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-slate-600">訂單數</p>
                        <p className="text-2xl font-bold text-slate-800">{orders.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">總金額</p>
                        <p className="text-2xl font-bold text-emerald-600">${totalAmount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="space-y-6">
                  {Object.keys(ordersByDate).sort().reverse().map(date => {
                    const dateOrders = ordersByDate[date];
                    const dateTotal = dateOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
                    
                    return (
                      <Card key={date} className="overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
                          <h3 className="font-semibold text-slate-800">
                            {format(new Date(date), 'yyyy年MM月dd日')}
                          </h3>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-600">{dateOrders.length} 筆訂單</span>
                            <span className="font-bold text-emerald-600">${dateTotal.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[650px] text-xs sm:text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-2 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b w-[15%]">成員</th>
                                <th className="px-2 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b w-[22%]">餐盒</th>
                                <th className="px-2 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b w-[10%]">飯量</th>
                                <th className="px-2 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b w-[20%]">單點</th>
                                <th className="px-2 sm:px-3 py-2 sm:py-3 text-center font-semibold text-slate-700 border-b w-[10%]">付款</th>
                                <th className="px-2 sm:px-3 py-2 sm:py-3 text-center font-semibold text-slate-700 border-b w-[10%]">狀態</th>
                                <th className="px-2 sm:px-3 py-2 sm:py-3 text-right font-semibold text-slate-700 border-b w-[13%]">金額</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dateOrders.map(order => {
                                 const items = getOrderItems(order.id);
                                 // P0-9 + P2-10: 使用共用工具函式
                                 const { mealBox, riceLabel, sideItems } = parseOrderItems(items, mealBoxes, sideDishProducts);

                                 return (
                                   <tr key={order.id} className="border-b hover:bg-slate-50">
                                     <td className="px-2 sm:px-3 py-2 sm:py-3">
                                       <div className="font-medium text-slate-800 leading-tight">{order.member_name}</div>
                                       <div className="text-xs text-slate-500">
                                         {formatTaiwanTime(order.created_date, 'HH:mm')}
                                       </div>
                                     </td>
                                     <td className="px-2 sm:px-3 py-2 sm:py-3">
                                       {mealBox ? (
                                         <div className="text-slate-700 leading-tight">
                                           <div className="break-words line-clamp-2">{mealBox.product_name}</div>
                                           <div className="text-xs text-slate-500">${mealBox.price}</div>
                                         </div>
                                       ) : (
                                         <span className="text-slate-400">-</span>
                                       )}
                                     </td>
                                     <td className="px-2 sm:px-3 py-2 sm:py-3">
                                       {mealBox ? (
                                         <span className="text-slate-700 whitespace-nowrap">
                                           {riceLabel}
                                         </span>
                                       ) : (
                                         <span className="text-slate-400">-</span>
                                       )}
                                     </td>
                                     <td className="px-2 sm:px-3 py-2 sm:py-3">
                                       {sideItems.length > 0 ? (
                                         <div className="space-y-0.5">
                                           {sideItems.map(item => (
                                             <div key={item.id} className="text-slate-700 leading-tight break-words line-clamp-2">
                                               {item.product_name}
                                               <span className="text-xs text-slate-500 ml-1">${item.price}</span>
                                             </div>
                                           ))}
                                         </div>
                                       ) : (
                                         <span className="text-slate-400">-</span>
                                       )}
                                     </td>
                                     <td className="px-3 py-3 text-center">
                                       <Badge className={`text-xs ${
                                         order.payment_method === 'cash' ? 'bg-amber-500' : 
                                         order.payment_method === 'payer' ? 'bg-purple-500' :
                                         'bg-blue-500'
                                       }`}>
                                         {order.payment_method === 'cash' ? '現金' : 
                                          order.payment_method === 'payer' ? '支付人' :
                                          '餘額'}
                                       </Badge>
                                     </td>
                                     <td className="px-2 sm:px-3 py-2 sm:py-3 text-center">
                                       <Badge className={`text-xs ${order.status === 'completed' ? 'bg-green-500' : 'bg-slate-400'}`}>
                                         {order.status === 'completed' ? '已完成' : '待處理'}
                                       </Badge>
                                     </td>
                                     <td className="px-2 sm:px-3 py-2 sm:py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                                       ${order.total_amount.toLocaleString()}
                                     </td>
                                   </tr>
                                 );
                               })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}