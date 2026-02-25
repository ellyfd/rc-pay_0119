import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { useQuery } from '@tanstack/react-query';
import { getAvatarColorStyle } from '@/components/utils/colorMap';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Package, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { formatTaiwanTime } from "@/components/utils/dateUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseOrderItems } from "@/components/utils/orderItemUtils";

export default function OrderHistoryByMember() {
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const { data: orders = [], isLoading: ordersLoading, refetch } = useQuery({
    queryKey: ['ordersByMember', selectedMemberId],
    queryFn: async () => {
      if (!selectedMemberId) return [];
      const allOrders = await base44.entities.Order.list('-order_date');
      return allOrders.filter(order => order.member_id === selectedMemberId);
    },
    enabled: false
  });

  // P1-7: 稳定化 queryKey，避免 orders 引用变化导致重新查询
  const orderIds = useMemo(
    () => orders.map(o => o.id).sort().join(','),
    [orders]
  );

  const { data: orderItems = [] } = useQuery({
    queryKey: ['orderItemsByMember', orderIds],
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
    if (!selectedMemberId) {
      alert('請選擇成員');
      return;
    }
    setHasSearched(true);
    refetch();
  };

  const getOrderItems = (orderId) => {
    return orderItems.filter(item => item.order_id === orderId);
  };

  const selectedMember = members.find(m => m.id === selectedMemberId);
  const totalAmount = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const completedOrders = orders.filter(o => o.status === 'completed');
  const pendingOrders = orders.filter(o => o.status === 'pending');

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
              <h1 className="text-2xl font-bold">按成員查詢訂單</h1>
              <p className="text-emerald-100 text-sm">查看特定成員的所有訂單記錄</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <Card className="p-6 mb-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">選擇成員</label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="請選擇成員" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSearch}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
            >
              <Users className="w-4 h-4 mr-2" />
              查詢
            </Button>
          </div>
        </Card>

        {hasSearched && selectedMember && (
          <>
            {ordersLoading ? (
              <Card className="p-8 text-center">
                <div className="w-12 h-12 border-4 border-emerald-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-500">載入中...</p>
              </Card>
            ) : orders.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">{selectedMember.name} 沒有訂單記錄</p>
              </Card>
            ) : (
              <>
                <Card className="p-6 mb-6">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-full ${getAvatarColorStyle(selectedMember.avatar_color)} hidden sm:flex items-center justify-center text-white font-bold text-2xl`}>
                      {selectedMember.name?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-slate-800 mb-2">{selectedMember.name}</h2>
                      <div className="hidden sm:flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-slate-600">總訂單數：</span>
                          <span className="font-bold text-slate-800">{orders.length}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">已完成：</span>
                          <span className="font-bold text-green-600">{completedOrders.length}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">待處理：</span>
                          <span className="font-bold text-amber-600">{pendingOrders.length}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">總金額：</span>
                          <span className="font-bold text-emerald-600">${totalAmount.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="sm:hidden space-y-2">
                        <div className="grid grid-cols-4 gap-2 text-xs text-slate-600 text-center">
                          <div>總訂單數</div>
                          <div>已完成</div>
                          <div>待處理</div>
                          <div>總金額</div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-sm font-bold text-center">
                          <div className="text-slate-800">{orders.length}</div>
                          <div className="text-green-600">{completedOrders.length}</div>
                          <div className="text-amber-600">{pendingOrders.length}</div>
                          <div className="text-emerald-600">${totalAmount.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-xs sm:text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b w-[8%]">日期</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b w-[7%]">時間</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b w-[22%]">餐盒</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b w-[8%]">飯量</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b w-[20%]">單點</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-center font-semibold text-slate-700 border-b w-[10%]">付款</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-center font-semibold text-slate-700 border-b w-[10%]">狀態</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-right font-semibold text-slate-700 border-b w-[15%]">金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(order => {
                           const items = getOrderItems(order.id);
                           const mealBox = items.find(item => {
                             const product = mealBoxes.find(p => p.id === item.product_id);
                             return product && product.category === 'meal_box';
                           });
                           const sideItems = items.filter(item => {
                             const product = sideDishProducts.find(p => p.id === item.product_id);
                             return product && product.category === 'side_dish';
                           });

                           return (
                             <tr key={order.id} className="border-b hover:bg-slate-50">
                               <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-slate-700 whitespace-nowrap">
                                 {format(new Date(order.order_date), 'MM/dd')}
                               </td>
                               <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-slate-700 whitespace-nowrap">
                                 {formatTaiwanTime(order.created_date, 'HH:mm')}
                               </td>
                               <td className="px-1.5 sm:px-3 py-2 sm:py-3">
                                 {mealBox ? (
                                   <div className="text-slate-700 leading-tight">
                                     <div className="break-words line-clamp-2">{mealBox.product_name}</div>
                                     <div className="text-[10px] sm:text-xs text-slate-500">${mealBox.price}</div>
                                   </div>
                                 ) : (
                                   <span className="text-slate-400">-</span>
                                 )}
                               </td>
                               <td className="px-1.5 sm:px-3 py-2 sm:py-3">
                                 {mealBox ? (
                                   <span className="text-slate-700 whitespace-nowrap">
                                     {mealBox.rice_option === 'less_rice' ? '飯少' : 
                                      mealBox.rice_option === 'rice_to_veg' ? '飯換菜' : '正常'}
                                   </span>
                                 ) : (
                                   <span className="text-slate-400">-</span>
                                 )}
                               </td>
                               <td className="px-1.5 sm:px-3 py-2 sm:py-3">
                                 {sideItems.length > 0 ? (
                                   <div className="space-y-0.5">
                                     {sideItems.map(item => (
                                       <div key={item.id} className="text-slate-700 leading-tight break-words line-clamp-2">
                                         {item.product_name}
                                         <span className="text-[10px] sm:text-xs text-slate-500 ml-1">${item.price}</span>
                                       </div>
                                     ))}
                                   </div>
                                 ) : (
                                   <span className="text-slate-400">-</span>
                                 )}
                               </td>
                               <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-center">
                                 <Badge className={`text-[10px] sm:text-xs ${
                                   order.payment_method === 'cash' ? 'bg-amber-500' : 
                                   order.payment_method === 'payer' ? 'bg-purple-500' :
                                   'bg-blue-500'
                                 }`}>
                                   {order.payment_method === 'cash' ? '現金' : 
                                    order.payment_method === 'payer' ? '支付人' :
                                    '餘額'}
                                 </Badge>
                               </td>
                               <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-center">
                                 <Badge className={`text-[10px] sm:text-xs ${order.status === 'completed' ? 'bg-green-500' : 'bg-slate-400'}`}>
                                   {order.status === 'completed' ? '已完成' : '待處理'}
                                 </Badge>
                               </td>
                               <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                                 ${order.total_amount.toLocaleString()}
                               </td>
                             </tr>
                           );
                         })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}