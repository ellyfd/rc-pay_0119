import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { parseOrderItems } from "@/components/utils/orderItemUtils";

export default function EditOrderDialog({ open, onOpenChange, order, orderItems, products, onSave }) {
  // P3-12: 移除未使用的 members prop
  const [paymentMethod, setPaymentMethod] = useState('balance');
  const [note, setNote] = useState('');
  const [mealBoxId, setMealBoxId] = useState('');
  const [riceOption, setRiceOption] = useState('normal');
  const [sideDishes, setSideDishes] = useState([]);

  const mealBoxes = products.filter(p => p.category === 'meal_box');
  const sideDishProducts = products.filter(p => p.category === 'side_dish');

  useEffect(() => {
    if (order && orderItems) {
      setPaymentMethod(order.payment_method || 'balance');
      setNote(order.note || '');

      // P2-14: 使用共用工具函式
      const { mealBox, riceOption: mealBoxRiceOption, sideItems } = parseOrderItems(orderItems, mealBoxes, sideDishProducts);

      if (mealBox) {
        setMealBoxId(mealBox.product_id);
        setRiceOption(mealBoxRiceOption);
      } else {
        setMealBoxId('');
        setRiceOption('normal');
      }

      setSideDishes(sideItems.map(item => ({ id: item.product_id, quantity: item.quantity || 1 })));
    }
  }, [order, orderItems]);

  const getTotal = () => {
    let total = 0;
    if (mealBoxId) {
      const mealBox = mealBoxes.find(p => p.id === mealBoxId);
      if (mealBox) total += mealBox.price;
    }
    sideDishes.forEach(({ id, quantity }) => {
      const dish = sideDishProducts.find(p => p.id === id);
      if (dish) total += dish.price * quantity;
    });
    return total;
  };

  const handleSave = () => {
    // P0-12: 處理 '__none__' 值
    const effectiveMealBoxId = mealBoxId === '__none__' ? '' : mealBoxId;
    
    if (!effectiveMealBoxId && sideDishes.length === 0) {
      toast.error('請至少選擇一個餐盒或單點');
      return;
    }

    const items = [];
    
    if (effectiveMealBoxId) {
      const mealBox = mealBoxes.find(p => p.id === effectiveMealBoxId);
      if (mealBox) {
        items.push({
          product_id: mealBox.id,
          product_name: mealBox.name,
          price: mealBox.price,
          quantity: 1,
          rice_option: riceOption
        });
      }
    }

    sideDishes.forEach(({ id: dishId, quantity }) => {
      const dish = sideDishProducts.find(p => p.id === dishId);
      if (dish) {
        items.push({
          product_id: dish.id,
          product_name: dish.name,
          price: dish.price,
          quantity,
          rice_option: 'normal'
        });
      }
    });

    onSave({
      payment_method: paymentMethod,
      note: note || undefined,
      total_amount: getTotal(),
      items
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯訂單 - {order?.member_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meal Box Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">餐盒</label>
            <Select value={mealBoxId} onValueChange={setMealBoxId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇餐盒（可不選）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">不選</SelectItem>
                {mealBoxes.map((box) => (
                  <SelectItem key={box.id} value={box.id}>
                    {box.name} - ${box.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rice Option */}
          {mealBoxId && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">飯量</label>
              <Select value={riceOption} onValueChange={setRiceOption}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">正常</SelectItem>
                  <SelectItem value="less_rice">飯少</SelectItem>
                  <SelectItem value="rice_to_veg">飯換菜</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Side Dishes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">單點（可多選）</label>
            <Select
              value=""
              onValueChange={(value) => {
                if (value) {
                  const existing = sideDishes.find(d => d.id === value);
                  if (existing) {
                    setSideDishes(sideDishes.map(d => d.id === value ? { ...d, quantity: d.quantity + 1 } : d));
                  } else {
                    setSideDishes([...sideDishes, { id: value, quantity: 1 }]);
                  }
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇單點" />
              </SelectTrigger>
              <SelectContent>
                {sideDishProducts.map((dish) => (
                  <SelectItem key={dish.id} value={dish.id}>
                    {dish.name} - ${dish.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sideDishes.length > 0 && (
              <div className="mt-3 space-y-2">
                {sideDishes.map(({ id: dishId, quantity }) => {
                  const dish = sideDishProducts.find(d => d.id === dishId);
                  return dish ? (
                    <div key={dishId} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-slate-700">{dish.name} - ${dish.price}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (quantity <= 1) {
                              setSideDishes(sideDishes.filter(d => d.id !== dishId));
                            } else {
                              setSideDishes(sideDishes.map(d => d.id === dishId ? { ...d, quantity: d.quantity - 1 } : d));
                            }
                          }}
                          className="h-7 w-7 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-sm font-medium w-6 text-center">{quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSideDishes(sideDishes.map(d => d.id === dishId ? { ...d, quantity: d.quantity + 1 } : d))}
                          className="h-7 w-7 p-0"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSideDishes(sideDishes.filter(d => d.id !== dishId))}
                          className="text-red-500 hover:text-red-700 h-6 px-2 ml-1"
                        >
                          移除
                        </Button>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">付款方式</label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="balance">餘額</SelectItem>
                <SelectItem value="cash">現金</SelectItem>
                <SelectItem value="payer">支付人</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">備註（選填）</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：不要蔥、辣一點..."
            />
          </div>

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold text-slate-700">總計</span>
              <span className="text-2xl font-bold text-emerald-600">${getTotal().toLocaleString()}</span>
            </div>
            <Button
              onClick={handleSave}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              儲存變更
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}