import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, Calendar, DollarSign, User, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

export default function AdminOrders() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();

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
      const allItems = await base44.entities.OrderItem.list();
      return allItems.filter(item => orders.some(o => o.id === item.order_id));
    },
    enabled: orders.length > 0
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

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

  const getOrderItems = (orderId) => {
    return orderItems.filter(item => item.order_id === orderId);
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

      // Only process balance deduction if payment method is balance
      if (order.payment_method === 'balance' || order.payment_method === 'cash') {
        const walletType = order.payment_method === 'cash' ? 'cash' : 'balance';
        const balanceField = order.payment_method === 'cash' ? 'cash_balance' : 'balance';
        const transactionNote = `${format(new Date(order.order_date), 'yyyy/MM/dd')} 七分飽`;

        await createTransaction.mutateAsync({
          type: 'withdraw',
          amount: order.total_amount,
          wallet_type: walletType,
          from_member_id: member.id,
          from_member_name: member.name,
          note: transactionNote
        });

        await updateMember.mutateAsync({
          id: member.id,
          data: { [balanceField]: (member[balanceField] || 0) - order.total_amount }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="bg-emerald-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-emerald-500 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
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
          <div className="space-y-4">
            {Object.entries(groupedOrders).map(([memberName, memberOrders]) => (
              <Card key={memberName} className="overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-600" />
                    <h3 className="font-semibold text-slate-800">{memberName}</h3>
                    <Badge variant="outline">{memberOrders.length} 筆</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">小計</span>
                    <span className="font-bold text-emerald-600">
                      ${memberOrders.reduce((sum, o) => sum + o.total_amount, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {memberOrders.map(order => {
                    const items = getOrderItems(order.id);
                    return (
                      <div key={order.id} className="bg-white border border-slate-200 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={order.payment_method === 'cash' ? 'bg-amber-500' : 'bg-blue-500'}>
                                {order.payment_method === 'cash' ? '現金' : '餘額'}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {format(new Date(order.created_date), 'HH:mm')}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {items.map(item => (
                                <div key={item.id} className="text-sm text-slate-700 flex items-center gap-2">
                                  <span>• {item.product_name}</span>
                                  {item.rice_option !== 'normal' && (
                                    <span className="text-xs text-slate-500">
                                      ({item.rice_option === 'less_rice' ? '飯少' : '飯換菜'})
                                    </span>
                                  )}
                                  <span className="text-slate-500">${item.price}</span>
                                </div>
                              ))}
                            </div>
                            {order.note && (
                              <p className="text-xs text-slate-500 mt-2">備註：{order.note}</p>
                            )}
                          </div>
                          <div className="font-bold text-emerald-600 ml-4">
                            ${order.total_amount.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}