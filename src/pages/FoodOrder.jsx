import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import OrderTable from "@/components/food/OrderTable";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function FoodOrder() {
  const [orders, setOrders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date')
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('-created_date')
  });

  const activeProducts = products.filter(p => p.is_active);
  const mealBoxes = activeProducts.filter(p => p.category === 'meal_box');
  const sideDishes = activeProducts.filter(p => p.category === 'side_dish');

  const addNewOrder = () => {
    setOrders([...orders, {
      id: Date.now(),
      member_id: '',
      meal_box_id: '',
      rice_option: 'normal',
      side_dishes: {}
    }]);
  };

  const updateOrder = (id, field, value) => {
    setOrders(orders.map(order => 
      order.id === id ? { ...order, [field]: value } : order
    ));
  };

  const removeOrder = (id) => {
    setOrders(orders.filter(order => order.id !== id));
  };

  const calculateOrderTotal = (order) => {
    let total = 0;
    if (order.meal_box_id) {
      const mealBox = mealBoxes.find(m => m.id === order.meal_box_id);
      if (mealBox) total += mealBox.price;
    }
    Object.keys(order.side_dishes || {}).forEach(dishId => {
      const quantity = order.side_dishes[dishId];
      if (quantity > 0) {
        const dish = sideDishes.find(d => d.id === dishId);
        if (dish) total += dish.price * quantity;
      }
    });
    return total;
  };

  const getTotalAmount = () => {
    return orders.reduce((sum, order) => sum + calculateOrderTotal(order), 0);
  };

  const handleSubmit = async () => {
    if (orders.length === 0) return;
    
    setSubmitting(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      for (const order of orders) {
        if (!order.member_id || !order.meal_box_id) continue;
        
        const member = members.find(m => m.id === order.member_id);
        const mealBox = mealBoxes.find(m => m.id === order.meal_box_id);
        if (!member || !mealBox) continue;

        const orderTotal = calculateOrderTotal(order);
        
        // Create order
        const createdOrder = await base44.entities.Order.create({
          member_id: member.id,
          member_name: member.name,
          total_amount: orderTotal,
          payment_method: 'balance',
          status: 'completed',
          order_date: today,
          note: ''
        });

        // Create order items
        await base44.entities.OrderItem.create({
          order_id: createdOrder.id,
          product_id: mealBox.id,
          product_name: mealBox.name,
          price: mealBox.price,
          quantity: 1,
          rice_option: order.rice_option
        });

        // Add side dishes
        for (const dishId of Object.keys(order.side_dishes || {})) {
          const quantity = order.side_dishes[dishId];
          if (quantity > 0) {
            const dish = sideDishes.find(d => d.id === dishId);
            if (dish) {
              await base44.entities.OrderItem.create({
                order_id: createdOrder.id,
                product_id: dish.id,
                product_name: dish.name,
                price: dish.price,
                quantity: quantity,
                rice_option: 'normal'
              });
            }
          }
        }

        // Create transaction and update balance
        await base44.entities.Transaction.create({
          type: 'withdraw',
          amount: orderTotal,
          from_member_id: member.id,
          to_member_id: null,
          from_member_name: member.name,
          to_member_name: '',
          note: `七分飽訂餐 - ${today}`
        });

        await base44.entities.Member.update(member.id, {
          balance: (member.balance || 0) - orderTotal
        });
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      
      setOrders([]);
      alert('訂單已送出！');
    } catch (error) {
      alert('訂單送出失敗：' + error.message);
    } finally {
      setSubmitting(false);
    }
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
            <Link to={createPageUrl('ProductManagement')}>
              <Button variant="ghost" className="text-white hover:bg-emerald-500">
                產品管理
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">七分飽訂餐</h1>
              <p className="text-emerald-100">{format(new Date(), 'yyyy/MM/dd')}</p>
            </div>
            <div className="text-right">
              <p className="text-emerald-100 text-sm">總金額</p>
              <p className="text-4xl font-bold">$ {getTotalAmount().toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {productsLoading ? (
          <Card className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-emerald-300 border-t-emerald-600 rounded-full animate-spin mx-auto" />
            <p className="text-slate-500 mt-4">載入中...</p>
          </Card>
        ) : (
          <>
            <div className="flex gap-3 mb-6">
              <Button
                onClick={addNewOrder}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={members.length === 0 || mealBoxes.length === 0}
              >
                <Plus className="w-5 h-5 mr-2" />
                新增訂單
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={orders.length === 0 || submitting}
              >
                <Save className="w-5 h-5 mr-2" />
                {submitting ? '送出中...' : '送出訂單'}
              </Button>
            </div>

            {orders.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <Plus className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-lg mb-2">尚未新增訂單</p>
                <p className="text-slate-400 text-sm">點擊「新增訂單」開始訂餐</p>
              </Card>
            ) : (
              <OrderTable
                orders={orders}
                members={members}
                mealBoxes={mealBoxes}
                sideDishes={sideDishes}
                onUpdateOrder={updateOrder}
                onRemoveOrder={removeOrder}
                calculateOrderTotal={calculateOrderTotal}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}