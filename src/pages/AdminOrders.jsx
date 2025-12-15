import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, Calendar, DollarSign, User, Package, Edit, Trash2, History, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import EditOrderDialog from "@/components/food/EditOrderDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminOrders() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [orderStatus, setOrderStatus] = useState('pending');
  const [editingOrder, setEditingOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

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

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', selectedDate, orderStatus],
    queryFn: async () => {
      const allOrders = await base44.entities.Order.list('-created_date');
      return allOrders.filter(order => 
        order.order_date === selectedDate && order.status === orderStatus
      );
    }
  });

  const { data: orderItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['orderItems', orders.map(o => o.id)],
    queryFn: async () => {
      if (orders.length === 0) return [];
      try {
        const allItems = await base44.entities.OrderItem.list();
        return allItems.filter(item => orders.some(o => o.id === item.order_id));
      } catch (error) {
        console.error('Error fetching order items:', error);
        return [];
      }
    },
    enabled: orders.length > 0
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const mealBoxes = products.filter(p => p.category === 'meal_box');
  const sideDishProducts = products.filter(p => p.category === 'side_dish');

  const updateOrder = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] })
  });

  const createTransaction = useMutation({
    mutationFn: async (data) => base44.entities.Transaction.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const deleteOrder = useMutation({
    mutationFn: (id) => base44.entities.Order.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orderItems'] });
    }
  });

  const deleteOrderItem = useMutation({
    mutationFn: (id) => base44.entities.OrderItem.delete(id)
  });

  const createOrderItem = useMutation({
    mutationFn: async (itemData) => base44.entities.OrderItem.create(itemData),
  });

  const getOrderItems = (orderId) => {
    return orderItems.filter(item => item.order_id === orderId);
  };

  const handleDelete = async () => {
    if (!deletingOrder) return;

    // Delete all order items first
    const items = getOrderItems(deletingOrder.id);
    for (const item of items) {
      try {
        await deleteOrderItem.mutateAsync(item.id);
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }

    // Then delete the order
    await deleteOrder.mutateAsync(deletingOrder.id);
    setDeletingOrder(null);
  };

  const handleEdit = (order) => {
    setEditingOrder(order);
  };

  const handleSaveEdit = async (data) => {
    if (!editingOrder) return;

    // Delete existing order items
    const existingItems = getOrderItems(editingOrder.id);
    for (const item of existingItems) {
      try {
        await deleteOrderItem.mutateAsync(item.id);
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }

    // Create new order items
    for (const item of data.items) {
      await createOrderItem.mutateAsync({
        order_id: editingOrder.id,
        ...item
      });
    }

    // Update order
    await updateOrder.mutateAsync({
      id: editingOrder.id,
      data: {
        payment_method: data.payment_method,
        total_amount: data.total_amount,
        note: data.note
      }
    });

    setEditingOrder(null);
  };

  const handleCheckoutAll = async () => {
    if (!confirm(`確認要結帳 ${orders.length} 筆訂單嗎？`)) return;

    for (const order of orders) {
      const member = allMembers.find(m => m.id === order.member_id);
      if (!member) continue;

      // Update order status
      await updateOrder.mutateAsync({
        id: order.id,
        data: { status: 'completed' }
      });

      const transactionNote = `${format(new Date(order.order_date), 'yyyy/MM/dd')} 七分飽`;

      if (order.payment_method === 'balance') {
        await createTransaction.mutateAsync({
          type: 'withdraw',
          amount: order.total_amount,
          wallet_type: 'balance',
          from_member_id: member.id,
          from_member_name: member.name,
          note: transactionNote
        });

        await updateMember.mutateAsync({
          id: member.id,
          data: { balance: (member.balance || 0) - order.total_amount }
        });
      } else if (order.payment_method === 'cash') {
        await createTransaction.mutateAsync({
          type: 'withdraw',
          amount: order.total_amount,
          wallet_type: 'cash',
          from_member_id: member.id,
          from_member_name: member.name,
          note: transactionNote
        });

        await updateMember.mutateAsync({
          id: member.id,
          data: { cash_balance: (member.cash_balance || 0) - order.total_amount }
        });
      }
    }

    alert('結帳完成！');
  };

  const totalAmount = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const groupedOrders = orders.reduce((acc, order) => {
    if (!acc[order.member_name]) {
      acc[order.member_name] = [];
    }
    acc[order.member_name].push(order);
    return acc;
  }, {});

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-300 border-t-emerald-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="bg-emerald-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link to={createPageUrl('FoodOrder')}>
            <Button variant="ghost" className="text-white hover:bg-emerald-500 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回訂餐
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">訂單管理</h1>
              <p className="text-emerald-100 text-sm">查詢訂單紀錄與統一結帳</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link to={createPageUrl('OrderHistoryByDate')}>
                <Button variant="ghost" className="text-white hover:bg-emerald-500 w-full">
                  <Calendar className="w-4 h-4 mr-2" />
                  按日期查詢
                </Button>
              </Link>
              <Link to={createPageUrl('OrderHistoryByMember')}>
                <Button variant="ghost" className="text-white hover:bg-emerald-500 w-full">
                  <Users className="w-4 h-4 mr-2" />
                  按成員查詢
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Date and Status Selection */}
        <Card className="p-3 sm:p-4 mb-6">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700 text-sm whitespace-nowrap">訂餐日期：</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-36 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant={orderStatus === 'pending' ? 'default' : 'outline'}
                onClick={() => setOrderStatus('pending')}
                className={`text-xs ${orderStatus === 'pending' ? 'bg-emerald-600' : ''}`}
              >
                待處理
              </Button>
              <Button
                variant={orderStatus === 'completed' ? 'default' : 'outline'}
                onClick={() => setOrderStatus('completed')}
                className={`text-xs ${orderStatus === 'completed' ? 'bg-slate-600' : ''}`}
              >
                已完成
              </Button>
            </div>
          </div>
          {orders.length > 0 && (
            <div className="flex items-center justify-between gap-3 pt-3 border-t">
              <div className="text-left">
                <p className="text-xs text-slate-500">訂單數</p>
                <p className="text-lg font-bold text-slate-800">{orders.length}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-500">總金額</p>
                <p className="text-lg font-bold text-emerald-600">${totalAmount.toLocaleString()}</p>
              </div>
              {currentUser?.role === 'admin' && orderStatus === 'pending' && (
                <Button
                  onClick={handleCheckoutAll}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 text-xs whitespace-nowrap"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  結帳
                </Button>
              )}
            </div>
          )}
        </Card>

        {ordersLoading || itemsLoading ? (
          <Card className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-emerald-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500">載入中...</p>
          </Card>
        ) : orders.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">此日期沒有{orderStatus === 'pending' ? '待處理' : '已完成'}訂單</p>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-emerald-50">
                    <tr>
                      <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b">成員</th>
                      <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b">餐盒</th>
                      <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b">飯量</th>
                      <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b">單點</th>
                      <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b">付款</th>
                      <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-right font-semibold text-slate-700 border-b">小計</th>
                      <th className="px-1.5 sm:px-3 py-2 sm:py-3 text-center font-semibold text-slate-700 border-b">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const items = getOrderItems(order.id);
                      const mealBoxItem = items.find(item => item.rice_option && item.rice_option !== 'normal');
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
                          <td className="px-1.5 sm:px-3 py-2 sm:py-3">
                            <div className="font-medium text-slate-800 leading-tight">{order.member_name}</div>
                            <div className="text-[10px] sm:text-xs text-slate-500">
                              {format(new Date(order.created_date), 'HH:mm')}
                            </div>
                          </td>
                          <td className="px-1.5 sm:px-3 py-2 sm:py-3">
                            {mealBox ? (
                              <div className="text-slate-700 leading-tight">
                                <div className="break-words">{mealBox.product_name}</div>
                                <div className="text-[10px] sm:text-xs text-slate-500">${mealBox.price}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-1.5 sm:px-3 py-2 sm:py-3">
                            {mealBox && mealBoxItem ? (
                              <span className="text-slate-700 whitespace-nowrap">
                                {mealBoxItem.rice_option === 'less_rice' ? '飯少' : 
                                 mealBoxItem.rice_option === 'rice_to_veg' ? '飯換菜' : '正常'}
                              </span>
                            ) : mealBox ? (
                              <span className="text-slate-700">正常</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-1.5 sm:px-3 py-2 sm:py-3">
                            {sideItems.length > 0 ? (
                              <div className="space-y-0.5">
                                {sideItems.map(item => (
                                  <div key={item.id} className="text-slate-700 leading-tight break-words">
                                    {item.product_name}
                                    <span className="text-[10px] sm:text-xs text-slate-500 ml-1">${item.price}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-1.5 sm:px-3 py-2 sm:py-3">
                            <Badge className={`text-[10px] sm:text-xs ${order.payment_method === 'cash' ? 'bg-amber-500' : 'bg-blue-500'}`}>
                              {order.payment_method === 'cash' ? '現金' : '餘額'}
                            </Badge>
                          </td>
                          <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                            ${order.total_amount.toLocaleString()}
                          </td>
                          <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-center">
                            {currentUser?.role === 'admin' && orderStatus === 'pending' ? (
                              <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(order)}
                                  className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingOrder(order)}
                                  className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-emerald-50 font-bold">
                      <td colSpan="5" className="px-1.5 sm:px-3 py-3 sm:py-4 text-right text-sm sm:text-lg">總計</td>
                      <td className="px-1.5 sm:px-3 py-3 sm:py-4 text-right text-sm sm:text-lg text-emerald-600 whitespace-nowrap">
                        ${totalAmount.toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      <EditOrderDialog
        open={!!editingOrder}
        onOpenChange={() => setEditingOrder(null)}
        order={editingOrder}
        orderItems={editingOrder ? getOrderItems(editingOrder.id) : []}
        products={products}
        members={allMembers}
        onSave={handleSaveEdit}
      />

      <AlertDialog open={!!deletingOrder} onOpenChange={() => setDeletingOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除訂單</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deletingOrder?.member_name}」的訂單嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}