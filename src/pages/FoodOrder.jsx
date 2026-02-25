import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, UtensilsCrossed, Settings, Save, Trash2 } from "lucide-react";
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
  const [selectedMember, setSelectedMember] = useState('');
  const [isOrderingForOthers, setIsOrderingForOthers] = useState(false);
  const [mealBoxId, setMealBoxId] = useState('');
  const [riceOption, setRiceOption] = useState('normal');
  const [sideDishes, setSideDishes] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('balance');
  const [note, setNote] = useState('');
  const [payerId, setPayerId] = useState('');
  const { user: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date')
  });

  const { data: allMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  // Auto-select current user's member
  React.useEffect(() => {
    if (currentUser && allMembers.length > 0 && !selectedMember && !isOrderingForOthers) {
      const userMember = allMembers.find(m => 
        m.user_emails && m.user_emails.includes(currentUser.email)
      );
      if (userMember) {
        setSelectedMember(userMember.id);
      }
    }
  }, [currentUser, allMembers, selectedMember, isOrderingForOthers]);

  const activeProducts = useMemo(() => 
    products.filter(p => p.is_active),
    [products]
  );
  
  const mealBoxes = useMemo(() => 
    activeProducts.filter(p => p.category === 'meal_box'),
    [activeProducts]
  );
  
  const sideDishProducts = useMemo(() => 
    activeProducts.filter(p => p.category === 'side_dish'),
    [activeProducts]
  );

  const total = useMemo(() => {
    let sum = 0;
    if (mealBoxId) {
      const mealBox = mealBoxes.find(p => p.id === mealBoxId);
      if (mealBox) sum += mealBox.price;
    }
    sideDishes.forEach(dishId => {
      const dish = sideDishProducts.find(p => p.id === dishId);
      if (dish) sum += dish.price;
    });
    return sum;
  }, [mealBoxId, mealBoxes, sideDishes, sideDishProducts]);

  const createOrder = useMutation({
    mutationFn: async (orderData) => base44.entities.Order.create(orderData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] })
  });

  const createOrderItem = useMutation({
    mutationFn: async (itemData) => base44.entities.OrderItem.create(itemData),
  });

  const handleSubmitOrder = async () => {
    if (!selectedMember) {
      alert('請選擇成員！');
      return;
    }

    if (!mealBoxId && sideDishes.length === 0) {
      alert('請至少選擇一個餐盒或單點！');
      return;
    }

    const member = allMembers.find(m => m.id === selectedMember);
    if (!member) return;

    const totalAmount = total;
    
    // Determine payment method based on whether member is the payer
    const finalMealBoxId = mealBoxId === '__none__' ? '' : mealBoxId;
    const finalPayerId = payerId === '__none__' ? '' : payerId;
    const finalPaymentMethod = finalPayerId && selectedMember === finalPayerId ? 'payer' : paymentMethod;
    const payer = finalPayerId ? allMembers.find(m => m.id === finalPayerId) : null;

    // Create order with pending status
    const orderRecord = await createOrder.mutateAsync({
      member_id: member.id,
      member_name: member.name,
      total_amount: totalAmount,
      payment_method: finalPaymentMethod,
      status: 'pending',
      order_date: orderDate,
      payer_id: finalPayerId || undefined,
      payer_name: payer?.name || undefined,
      note: note || undefined
    });

    // Create order items
    if (finalMealBoxId) {
      const mealBox = mealBoxes.find(p => p.id === finalMealBoxId);
      if (mealBox) {
        await createOrderItem.mutateAsync({
          order_id: orderRecord.id,
          product_id: mealBox.id,
          product_name: mealBox.name,
          price: mealBox.price,
          quantity: 1,
          rice_option: riceOption
        });
      }
    }

    for (const dishId of sideDishes) {
      const dish = sideDishProducts.find(p => p.id === dishId);
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

    // Reset form
    setMealBoxId('');
    setRiceOption('normal');
    setSideDishes([]);
    setNote('');
    setPayerId('');
    alert('訂單已送出，等待管理員結帳！');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-emerald-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-emerald-500 -ml-2 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                <UtensilsCrossed className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">七分飽訂餐</h1>
                <p className="text-emerald-100 text-sm">個人點餐系統</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to={createPageUrl('AdminOrders')}>
                <Button variant="ghost" className="text-white hover:bg-emerald-500">
                  <Settings className="w-5 h-5 mr-2" />
                  訂單管理
                </Button>
              </Link>
              <Link to={createPageUrl('ProductManagement')}>
                <Button variant="ghost" className="text-white hover:bg-emerald-500">
                  <Settings className="w-5 h-5 mr-2" />
                  產品管理
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Order Form */}
        {membersLoading || productsLoading ? (
          <Card className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-emerald-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500">載入中...</p>
          </Card>
        ) : allMembers.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <p className="text-slate-500">尚未新增成員，請先到首頁新增成員</p>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="space-y-6">
              {/* Date & Member Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">訂餐日期</label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="hidden md:block"
                  />
                  <div className="md:hidden bg-slate-50 border rounded-md px-3 py-2 text-slate-700">
                    {format(new Date(orderDate), 'yyyy年MM月dd日')}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700">訂購人</label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsOrderingForOthers(!isOrderingForOthers);
                        if (!isOrderingForOthers) {
                          setSelectedMember('');
                        } else {
                          const userMember = allMembers.find(m => 
                            m.user_emails && currentUser && m.user_emails.includes(currentUser.email)
                          );
                          if (userMember) {
                            setSelectedMember(userMember.id);
                          }
                        }
                      }}
                      className="text-emerald-600 hover:text-emerald-700 h-auto py-1"
                    >
                      {isOrderingForOthers ? '取消代訂' : '代替訂購'}
                    </Button>
                  </div>
                  {isOrderingForOthers ? (
                    <Select value={selectedMember} onValueChange={setSelectedMember}>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇成員" />
                      </SelectTrigger>
                      <SelectContent>
                        {allMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={allMembers.find(m => m.id === selectedMember)?.name || ''}
                      disabled
                      className="bg-slate-50"
                    />
                  )}
                </div>
              </div>

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
                        <div className="flex items-center gap-2">
                          <span>{box.name} - ${box.price}</span>
                          {box.is_flash && (
                            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded">快閃</span>
                          )}
                        </div>
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
                    if (value && !sideDishes.includes(value)) {
                      setSideDishes([...sideDishes, value]);
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
                    {sideDishes.map((dishId) => {
                      const dish = sideDishProducts.find(d => d.id === dishId);
                      return dish ? (
                        <div key={dishId} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                          <span className="text-sm text-slate-700">{dish.name} - ${dish.price}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSideDishes(sideDishes.filter(id => id !== dishId))}
                            className="text-red-500 hover:text-red-700 h-6 px-2"
                          >
                            移除
                          </Button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              {/* Payer Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">付款人（選填）</label>
                <Select value={payerId} onValueChange={setPayerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇統一付款的人（留空則各付各的）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">無（各付各的）</SelectItem>
                    {allMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method */}
              {selectedMember !== payerId && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">付款方式</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balance">餘額</SelectItem>
                      <SelectItem value="cash">現金</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedMember === payerId && payerId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium">您是付款人，此訂單將由您統一支付，不會扣除您的餘額</p>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">備註（選填）</label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例：不要蔥、辣一點..."
                />
              </div>

              {/* Total & Submit */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-semibold text-slate-700">總計</span>
                  <span className="text-2xl font-bold text-emerald-600">${total.toLocaleString()}</span>
                </div>
                <Button
                  onClick={handleSubmitOrder}
                  disabled={!selectedMember || (!mealBoxId && sideDishes.length === 0)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg"
                >
                  <Save className="w-5 h-5 mr-2" />
                  送出訂單
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}