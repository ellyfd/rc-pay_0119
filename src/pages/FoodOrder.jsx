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
        ...
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