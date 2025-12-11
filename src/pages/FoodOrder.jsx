import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, UtensilsCrossed, Settings, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function FoodOrder() {
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [orderItems, setOrderItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(user => setCurrentUser(user)).catch(() => {});
  }, []);

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date')
  });

  const { data: allMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const members = allMembers.filter(m => m.is_active !== false);

  const activeProducts = products.filter(p => p.is_active);
  const mealBoxes = activeProducts.filter(p => p.category === 'meal_box');
  const sideDishes = activeProducts.filter(p => p.category === 'side_dish');

  const addOrderItem = () => {
    setOrderItems([...orderItems, {
      id: Date.now(),
      member_id: '',
      meal_box_id: '',
      rice_option: 'normal',
      side_dishes: [],
      payment_method: 'balance'
    }]);
  };

  const updateOrderItem = (id, field, value) => {
    setOrderItems(orderItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeOrderItem = (id) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };

  const getItemTotal = (item) => {
    let total = 0;
    
    if (item.meal_box_id) {
      const mealBox = mealBoxes.find(p => p.id === item.meal_box_id);
      if (mealBox) total += mealBox.price;
    }
    
    if (item.side_dishes && item.side_dishes.length > 0) {
      item.side_dishes.forEach(dishId => {
        const dish = sideDishes.find(p => p.id === dishId);
        if (dish) total += dish.price;
      });
    }
    
    return total;
  };

  const getGrandTotal = () => {
    return orderItems.reduce((sum, item) => sum + getItemTotal(item), 0);
  };

  const createOrder = useMutation({
    mutationFn: async (orderData) => base44.entities.Order.create(orderData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] })
  });

  const createOrderItem = useMutation({
    mutationFn: async (itemData) => base44.entities.OrderItem.create(itemData),
  });

  const createTransaction = useMutation({
    mutationFn: async (data) => base44.entities.Transaction.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const handleSubmitOrders = async () => {
    // Validate all items have a member
    if (orderItems.some(item => !item.member_id)) {
      alert('請為所有項目選擇成員！');
      return;
    }

    // Process each order item
    for (const item of orderItems) {
      const member = allMembers.find(m => m.id === item.member_id);
      if (!member) continue;

      // Skip if no meal box or side dishes
      if (!item.meal_box_id && (!item.side_dishes || item.side_dishes.length === 0)) {
        continue;
      }

      const totalAmount = getItemTotal(item);
      
      // Create order
      const orderRecord = await createOrder.mutateAsync({
        member_id: member.id,
        member_name: member.name,
        total_amount: totalAmount,
        payment_method: item.payment_method,
        status: 'completed',
        order_date: orderDate
      });

      // Create order items
      if (item.meal_box_id) {
        const mealBox = mealBoxes.find(p => p.id === item.meal_box_id);
        if (mealBox) {
          await createOrderItem.mutateAsync({
            order_id: orderRecord.id,
            product_id: mealBox.id,
            product_name: mealBox.name,
            price: mealBox.price,
            quantity: 1,
            rice_option: item.rice_option || 'normal'
          });
        }
      }

      if (item.side_dishes && item.side_dishes.length > 0) {
        for (const dishId of item.side_dishes) {
          const dish = sideDishes.find(p => p.id === dishId);
          if (dish) {
            await createOrderItem.mutateAsync({
              order_id: orderRecord.id,
              product_id: dish.id,
              product_name: dish.name,
              price: dish.price,
              quantity: 1,
              rice_option: 'normal'
            });
          }
        }
      }

      // Create transaction record for both payment methods
      const walletType = item.payment_method === 'cash' ? 'cash' : 'balance';
      const balanceField = item.payment_method === 'cash' ? 'cash_balance' : 'balance';
      const transactionNote = `${format(new Date(orderDate), 'yyyy/MM/dd')} 七分飽`;

      await createTransaction.mutateAsync({
        type: 'withdraw',
        amount: totalAmount,
        wallet_type: walletType,
        from_member_id: member.id,
        from_member_name: member.name,
        note: transactionNote
      });

      // Update corresponding balance
      await updateMember.mutateAsync({
        id: member.id,
        data: { [balanceField]: (member[balanceField] || 0) - totalAmount }
      });
    }

    // Clear orders after submission
    setOrderItems([]);
    alert('訂單已送出！');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-emerald-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link to={createPageUrl('Home')}>
              <Button variant="ghost" className="text-white hover:bg-emerald-500 -ml-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            {currentUser?.role === 'admin' && (
              <Link to={createPageUrl('ProductManagement')}>
                <Button variant="ghost" className="text-white hover:bg-emerald-500">
                  <Settings className="w-5 h-5 mr-2" />
                  產品管理
                </Button>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">七分飽訂餐</h1>
              <p className="text-emerald-100 text-sm">團體訂餐系統</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Date Selection */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="font-semibold text-slate-700">訂餐日期：</label>
            <Input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-48"
            />
          </div>
        </Card>

        {/* Order Table */}
        {membersLoading || productsLoading ? (
          <Card className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-emerald-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500">載入中...</p>
          </Card>
        ) : members.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <p className="text-slate-500">尚未新增成員，請先到首頁新增成員</p>
          </Card>
        ) : currentUser?.role === 'admin' ? (
          <>
            <Card className="overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-emerald-50">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700 border-b w-32">成員</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700 border-b">餐盒</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700 border-b w-28">飯</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700 border-b">單點</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700 border-b w-28">付款</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-700 border-b w-24">小計</th>
                      <th className="px-3 py-3 border-b w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <Select
                            value={item.member_id}
                            onValueChange={(value) => updateOrderItem(item.id, 'member_id', value)}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue placeholder="選擇" />
                            </SelectTrigger>
                            <SelectContent>
                              {members.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Select
                            value={item.meal_box_id}
                            onValueChange={(value) => updateOrderItem(item.id, 'meal_box_id', value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="選擇餐盒" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={null}>不選</SelectItem>
                              {mealBoxes.map((box) => (
                                <SelectItem key={box.id} value={box.id}>
                                  {box.name} ${box.price}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Select
                            value={item.rice_option}
                            onValueChange={(value) => updateOrderItem(item.id, 'rice_option', value)}
                            disabled={!item.meal_box_id}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">正常</SelectItem>
                              <SelectItem value="less_rice">飯少</SelectItem>
                              <SelectItem value="rice_to_veg">飯換菜</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Select
                            value=""
                            onValueChange={(value) => {
                              if (value) {
                                updateOrderItem(item.id, 'side_dishes', [...(item.side_dishes || []), value]);
                              }
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="選擇單點" />
                            </SelectTrigger>
                            <SelectContent>
                              {sideDishes.map((dish) => (
                                <SelectItem key={dish.id} value={dish.id}>
                                  {dish.name} ${dish.price}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {item.side_dishes && item.side_dishes.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.side_dishes.map((dishId, idx) => {
                                const dish = sideDishes.find(d => d.id === dishId);
                                return dish ? (
                                  <div key={idx} className="text-xs text-slate-600 flex items-center gap-2">
                                    <span>• {dish.name}</span>
                                    <button
                                      onClick={() => {
                                        const newDishes = item.side_dishes.filter((_, i) => i !== idx);
                                        updateOrderItem(item.id, 'side_dishes', newDishes);
                                      }}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : null;
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Select
                            value={item.payment_method}
                            onValueChange={(value) => updateOrderItem(item.id, 'payment_method', value)}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="balance">餘額</SelectItem>
                              <SelectItem value="cash">現金</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-600">
                          ${getItemTotal(item).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOrderItem(item.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            ✕
                          </Button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50 font-bold">
                      <td colSpan="5" className="px-3 py-4 text-right text-lg">總計</td>
                      <td className="px-3 py-4 text-right text-lg text-emerald-600">
                        ${getGrandTotal().toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <Button
                onClick={addOrderItem}
                variant="outline"
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50"
              >
                <UtensilsCrossed className="w-4 h-4 mr-2" />
                新增項目
              </Button>
              <Button
                onClick={handleSubmitOrders}
                disabled={orderItems.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg"
              >
                <Save className="w-5 h-5 mr-2" />
                送出訂單
              </Button>
            </div>
          </>
        ) : (
          <Card className="p-8 text-center border-dashed">
            <p className="text-slate-500">只有管理員可以新增訂單</p>
          </Card>
        )}
      </div>
    </div>
  );
}