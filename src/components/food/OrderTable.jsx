import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";

const riceOptions = {
  normal: '正常',
  less_rice: '飯少',
  rice_to_veg: '飯換菜'
};

export default function OrderTable({ 
  orders, 
  members, 
  mealBoxes, 
  sideDishes,
  onUpdateOrder,
  onRemoveOrder,
  calculateOrderTotal
}) {
  const updateSideDish = (orderId, dishId, quantity) => {
    const order = orders.find(o => o.id === orderId);
    const newSideDishes = { ...order.side_dishes, [dishId]: quantity };
    onUpdateOrder(orderId, 'side_dishes', newSideDishes);
  };

  const getSideDishQuantity = (order, dishId) => {
    return order.side_dishes?.[dishId] || 0;
  };

  const getTotalSideDishQuantity = (dishId) => {
    return orders.reduce((sum, order) => sum + (order.side_dishes?.[dishId] || 0), 0);
  };

  const getTotalOrders = () => orders.length;
  const getTotalAmount = () => orders.reduce((sum, order) => sum + calculateOrderTotal(order), 0);

  return (
    <div className="overflow-x-auto">
      <Card className="p-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-300">
              <th className="text-left p-3 font-semibold text-slate-700 min-w-[120px]">餐盒</th>
              <th className="text-left p-3 font-semibold text-slate-700 min-w-[100px]">飯量</th>
              {sideDishes.map(dish => (
                <th key={dish.id} className="text-center p-3 font-semibold text-slate-700 min-w-[80px]">
                  {dish.name}
                </th>
              ))}
              <th className="text-center p-3 font-semibold text-slate-700 min-w-[80px]">數量</th>
              <th className="text-right p-3 font-semibold text-slate-700 min-w-[100px]">金額</th>
              <th className="text-center p-3 font-semibold text-slate-700 min-w-[120px]">成員</th>
              <th className="text-center p-3 font-semibold text-slate-700 w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const member = members.find(m => m.id === order.member_id);
              const mealBox = mealBoxes.find(m => m.id === order.meal_box_id);
              
              return (
                <tr key={order.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-3">
                    <Select
                      value={order.meal_box_id}
                      onValueChange={(value) => onUpdateOrder(order.id, 'meal_box_id', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="選擇餐盒" />
                      </SelectTrigger>
                      <SelectContent>
                        {mealBoxes.map(box => (
                          <SelectItem key={box.id} value={box.id}>
                            {box.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Select
                      value={order.rice_option}
                      onValueChange={(value) => onUpdateOrder(order.id, 'rice_option', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(riceOptions).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {sideDishes.map(dish => (
                    <td key={dish.id} className="p-3 text-center">
                      <Input
                        type="number"
                        min="0"
                        value={getSideDishQuantity(order, dish.id)}
                        onChange={(e) => updateSideDish(order.id, dish.id, parseInt(e.target.value) || 0)}
                        className="w-20 text-center mx-auto"
                      />
                    </td>
                  ))}
                  <td className="p-3 text-center font-semibold">1</td>
                  <td className="p-3 text-right font-bold text-emerald-600">
                    $ {calculateOrderTotal(order).toFixed(1)}
                  </td>
                  <td className="p-3">
                    <Select
                      value={order.member_id}
                      onValueChange={(value) => onUpdateOrder(order.id, 'member_id', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="選擇成員" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map(member => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveOrder(order.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            
            {/* Summary Row */}
            <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
              <td className="p-3" colSpan="2"></td>
              {sideDishes.map(dish => (
                <td key={dish.id} className="p-3 text-center text-slate-700">
                  {getTotalSideDishQuantity(dish.id)}
                </td>
              ))}
              <td className="p-3 text-center text-slate-700">{getTotalOrders()}</td>
              <td className="p-3 text-right text-emerald-700 text-lg">
                $ {getTotalAmount().toLocaleString()}
              </td>
              <td className="p-3" colSpan="2"></td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}