import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, Calendar, DollarSign, User, Package, Edit, Trash2 } from "lucide-react";
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
  const [editingOrder, setEditingOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [cashPaidStatus, setCashPaidStatus] = useState({});
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
    queryKey: ['orders', selectedDate],
    queryFn: async () => {
      const allOrders = await base44.entities.Order.list('-created_date');
      return allOrders.filter(order => 
        order.order_date === selectedDate && order.status === 'pending'
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
    // 檢查所有現金訂單是否都已勾選確認收款
    const cashOrders = orders.filter(o => o.payment_method === 'cash');
    const uncheckedCash = cashOrders.filter(o => !cashPaidStatus[o.id]);
    
    if (uncheckedCash.length > 0) {
      alert(`請先確認所有現金訂單已收款（共 ${uncheckedCash.length} 筆未勾選）`);
      return;
    }

    if (!confirm(`確認要結帳 ${orders.length} 筆訂單嗎？`)) return;

    for (const order of orders) {
      const member = allMembers.find(m => m.id === order.member_id);
      if (!member) continue;

      // 1. 更新訂單狀態為已完成
      await updateOrder.mutateAsync({
        id: order.id,
        data: { status: 'completed' }
      });

      const transactionNote = `${format(new Date(order.order_date), 'yyyy/MM/dd')} 七分飽`;

      // 2. 根據付款方式處理
      if (order.payment_method === 'balance') {
        // 餘額支付：需扣款並記錄交易
        
        // 2a. 建立交易紀錄
        await createTransaction.mutateAsync({
          type: 'withdraw',
          amount: order.total_amount,
          wallet_type: 'balance',
          from_member_id: member.id,
          from_member_name: member.name,
          note: transactionNote
        });

        // 2b. 扣除成員錢包餘額
        await updateMember.mutateAsync({
          id: member.id,
          data: { balance: (member.balance || 0) - order.total_amount }
        });
      } else if (order.payment_method === 'cash') {
        // 現金支付：只記錄交易，不扣除餘額（已由打勾確認收款）
        
        await createTransaction.mutateAsync({
          type: 'withdraw',
          amount: order.total_amount,
          wallet_type: 'cash',
          from_member_id: member.id,
          from_member_name: member.name,
          note: transactionNote + '（現金）'
        });
      }
    }

    alert('結帳完成！');
    // 清空現金收款確認狀態
    setCashPaidStatus({});
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

  if (currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">無權限訪問</h2>
          <p className="text-slate-500 mb-4">此頁面僅限管理員使用</p>
          <Link to={createPageUrl('Home')}>
            <Button className="w-full">返回首頁</Button>
          </Link>
        </Card>
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
              <p className="text-emerald-100 text-sm">統一結帳待處理訂單</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Date Selection */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="font-semibold text-slate-700">訂餐日期：</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-48"
              />
            </div>
            {orders.length > 0 && (
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm text-slate-500">訂單數</p>
                  <p className="text-xl font-bold text-slate-800">{orders.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">總金額</p>
                  <p className="text-xl font-bold text-emerald-600">${totalAmount.toLocaleString()}</p>
                </div>
                <Button
                  onClick={handleCheckoutAll}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  統一結帳
                </Button>
              </div>
            )}
          </div>
        </Card>

        {ordersLoading || itemsLoading ? (
          <Card className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-emerald-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500">載入中...</p>
          </Card>
        ) : orders.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">此日期沒有待處理訂單</p>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-emerald-50">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700 border-b w-32">成員</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700 border-b">餐盒</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700 border-b w-24">飯量</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700 border-b">單點</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700 border-b w-24">付款</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-700 border-b w-32">小計</th>
                      <th className="px-3 py-3 text-center font-semibold text-slate-700 border-b w-24">操作</th>
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
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-800">{order.member_name}</div>
                            <div className="text-xs text-slate-500">
                              {format(new Date(order.created_date), 'HH:mm')}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {mealBox ? (
                              <div className="text-sm text-slate-700">
                                {mealBox.product_name}
                                <div className="text-xs text-slate-500">${mealBox.price}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {mealBox && mealBoxItem ? (
                              <span className="text-sm text-slate-700">
                                {mealBoxItem.rice_option === 'less_rice' ? '飯少' : 
                                 mealBoxItem.rice_option === 'rice_to_veg' ? '飯換菜' : '正常'}
                              </span>
                            ) : mealBox ? (
                              <span className="text-sm text-slate-700">正常</span>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {sideItems.length > 0 ? (
                              <div className="space-y-1">
                                {sideItems.map(item => (
                                  <div key={item.id} className="text-sm text-slate-700">
                                    {item.product_name}
                                    <span className="text-xs text-slate-500 ml-1">${item.price}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Badge className={order.payment_method === 'cash' ? 'bg-amber-500' : 'bg-blue-500'}>
                                {order.payment_method === 'cash' ? '現金' : '餘額'}
                              </Badge>
                              {order.payment_method === 'cash' && (
                                <input 
                                  type="checkbox"
                                  checked={cashPaidStatus[order.id] || false}
                                  onChange={(e) => setCashPaidStatus({
                                    ...cashPaidStatus,
                                    [order.id]: e.target.checked
                                  })}
                                  className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                                />
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-emerald-600">
                            ${order.total_amount.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(order)}
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingOrder(order)}
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-emerald-50 font-bold">
                      <td colSpan="5" className="px-3 py-4 text-right text-lg">總計</td>
                      <td className="px-3 py-4 text-right text-lg text-emerald-600">
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