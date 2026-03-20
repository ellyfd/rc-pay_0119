import React, { useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, Package, Edit, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Input } from "@/components/ui/input";
import EditOrderDialog from "@/components/food/EditOrderDialog";
import OrderTableRow from "@/components/food/OrderTableRow";
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
  // P4-2：整理狀態管理，分組 UI 狀態和資料狀態
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [orderStatus, setOrderStatus] = useState('pending');
  
  // UI 對話框狀態
  const [editingOrder, setEditingOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  
  const { user: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

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
        toast.error('載入訂單項目失敗');
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

  const mealBoxes = useMemo(() => 
    products.filter(p => p.category === 'meal_box'),
    [products]
  );
  const sideDishProducts = useMemo(() => 
    products.filter(p => p.category === 'side_dish'),
    [products]
  );

  // P4-3：提取數據映射邏輯
  const memberMap = useMemo(() => 
    new Map(allMembers.map(m => [m.id, m])),
    [allMembers]
  );

  const productMap = useMemo(() =>
    new Map(products.map(p => [p.id, p])),
    [products]
  );

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

  const getOrderItems = useCallback((orderId) => {
    return orderItems.filter(item => item.order_id === orderId);
  }, [orderItems]);

  const handleDelete = async () => {
    if (!deletingOrder) return;

    // Delete all order items first
    const items = getOrderItems(deletingOrder.id);
    for (const item of items) {
      try {
        await deleteOrderItem.mutateAsync(item.id);
      } catch (error) {
        toast.error(`刪除項目失敗：${error.message}`);
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
        toast.error(`刪除項目失敗：${error.message}`);
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

  // P2-2：提取交易邏輯到獨立函式（允許負餘額，不靜默跳過）
  const processOrderPayment = async (order, member, transactionNote) => {
    const amount = order.total_amount || 0;

    if (order.payment_method === 'payer') {
      await createTransaction.mutateAsync({
        type: 'note',
        amount: amount,
        wallet_type: 'payer',
        from_member_id: member.id,
        from_member_name: member.name,
        note: `${transactionNote}（由 ${order.payer_id ? memberMap.get(order.payer_id)?.name : '未知'} 代付）`
      });
    } else if (order.payment_method === 'balance') {
      const freshMembers = await base44.entities.Member.list('name');
      const freshMember = freshMembers.find(m => m.id === member.id);
      if (!freshMember) throw new Error(`找不到成員 ${member.name}`);
      await createTransaction.mutateAsync({
        type: 'withdraw',
        amount: amount,
        wallet_type: 'balance',
        from_member_id: member.id,
        from_member_name: member.name,
        note: transactionNote
      });
      await updateMember.mutateAsync({
        id: member.id,
        data: { balance: (freshMember.balance || 0) - amount }
      });
    } else if (order.payment_method === 'cash') {
      const freshMembers = await base44.entities.Member.list('name');
      const freshMember = freshMembers.find(m => m.id === member.id);
      if (!freshMember) throw new Error(`找不到成員 ${member.name}`);
      await createTransaction.mutateAsync({
        type: 'withdraw',
        amount: amount,
        wallet_type: 'cash',
        from_member_id: member.id,
        from_member_name: member.name,
        note: transactionNote
      });
      await updateMember.mutateAsync({
        id: member.id,
        data: { cash_balance: (freshMember.cash_balance || 0) - amount }
      });
    }
  };

  const handleCheckoutAll = async () => {
    if (currentUser?.role !== 'admin') {
      toast.error('僅管理員可執行此操作');
      return;
    }

    // 先取最新成員資料，統一列出餘額不足者
    const freshMembers = await base44.entities.Member.list('name');
    const insufficientList = [];

    for (const order of orders) {
      const freshMember = freshMembers.find(m => m.id === order.member_id);
      if (!freshMember) continue;
      const amount = order.total_amount || 0;
      if (order.payment_method === 'balance' && (freshMember.balance || 0) < amount) {
        insufficientList.push(`・${order.member_name}：餘額 $${freshMember.balance || 0}，應付 $${amount}`);
      } else if (order.payment_method === 'cash' && (freshMember.cash_balance || 0) < amount) {
        insufficientList.push(`・${order.member_name}（現金）：餘額 $${freshMember.cash_balance || 0}，應付 $${amount}`);
      }
    }

    let confirmMessage = `確認要結帳 ${orders.length} 筆訂單嗎？`;
    if (insufficientList.length > 0) {
      confirmMessage += `\n\n⚠️ 以下成員餘額不足，將扣成負數：\n${insufficientList.join('\n')}`;
    }

    if (!confirm(confirmMessage)) return;

    const failedOrders = [];

    for (const order of orders) {
      const member = memberMap.get(order.member_id);
      if (!member) continue;

      try {
        await updateOrder.mutateAsync({
          id: order.id,
          data: { status: 'completed' }
        });
        const transactionNote = `${format(new Date(order.order_date), 'yyyy/MM/dd')} 七分飽`;
        await processOrderPayment(order, member, transactionNote);
      } catch (error) {
        failedOrders.push(order.member_name);
      }
    }

    if (failedOrders.length > 0) {
      toast.error(`以下訂單扣款失敗，請手動處理：${failedOrders.join('、')}`);
    } else {
      toast.success('結帳完成！');
    }
  };

  const totalAmount = useMemo(() => 
    orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
    [orders]
  );
  
  const handleDeleteWithRollback = async () => {
    if (!deletingOrder) return;

    try {
      // Delete all order items first
      const items = getOrderItems(deletingOrder.id);
      for (const item of items) {
        try {
          await deleteOrderItem.mutateAsync(item.id);
        } catch (error) {
          toast.error(`刪除項目失敗：${error.message}`);
        }
      }

      // Then delete the order
      await deleteOrder.mutateAsync(deletingOrder.id);
      setDeletingOrder(null);
      toast.success('訂單已刪除');
    } catch (error) {
      toast.error(`刪除失敗：${error.message}`);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="bg-emerald-600 text-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 md:py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-emerald-500 mb-2 md:mb-4 -ml-2 h-8 md:h-10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首頁
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">訂單管理</h1>
              <p className="text-emerald-100 text-sm">查詢訂單紀錄與統一結帳</p>
            </div>
            <Link to={createPageUrl('OrderHistoryByMember')}>
              <Button variant="ghost" className="text-white hover:bg-emerald-500">
                <Users className="w-4 h-4 mr-2" />
                按成員查詢
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Date and Status Selection */}
        <Card className="p-3 sm:p-4 mb-6">
          <div className="flex items-center justify-between gap-2 sm:gap-4 mb-3">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700 text-sm whitespace-nowrap">日期：</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-32 sm:w-36 text-sm"
              />
            </div>
            <div className="flex gap-2">
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
           <LoadingSpinner message="載入訂單中..." />
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
                    {orders.map((order) => (
                      <OrderTableRow
                        key={order.id}
                        order={order}
                        items={getOrderItems(order.id)}
                        mealBoxes={mealBoxes}
                        sideDishProducts={sideDishProducts}
                        currentUserRole={currentUser?.role}
                        orderStatus={orderStatus}
                        onEdit={handleEdit}
                        onDelete={setDeletingOrder}
                      />
                    ))}
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
            <AlertDialogAction onClick={handleDeleteWithRollback} className="bg-red-500 hover:bg-red-600">
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}