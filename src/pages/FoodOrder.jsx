import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Package, UtensilsCrossed, Plus, Settings, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ProductCard from "@/components/food/ProductCard";
import CartDialog from "@/components/food/CartDialog";
import CheckoutDialog from "@/components/food/CheckoutDialog";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FoodOrder() {
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
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

  const addToCart = (product, riceOption = 'normal') => {
    const existingIndex = cart.findIndex(
      item => item.product_id === product.id && item.rice_option === riceOption
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity: 1,
        rice_option: riceOption,
        category: product.category
      }]);
    }
  };

  const updateCartItem = (index, quantity) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }
    const newCart = [...cart];
    newCart[index].quantity = quantity;
    setCart(newCart);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0 || !selectedMemberId) return;
    setShowCart(false);
    setShowCheckout(true);
  };

  const handleCheckoutComplete = () => {
    setCart([]);
    setShowCheckout(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-emerald-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                <UtensilsCrossed className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">七分飽訂餐</h1>
                <p className="text-emerald-100 text-sm">健康美味的午餐選擇</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to={createPageUrl('ProductManagement')}>
                <Button variant="ghost" className="text-white hover:bg-emerald-500">
                  <Settings className="w-5 h-5 mr-2" />
                  產品管理
                </Button>
              </Link>
              <Button
                onClick={() => setShowCart(true)}
                className="bg-white text-emerald-600 hover:bg-emerald-50 relative"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                購物車
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-red-500 text-white px-2">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
          
          {/* Member Selection */}
          <div className="bg-emerald-500 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-white" />
              <div className="flex-1">
                <p className="text-emerald-100 text-sm mb-1">訂購人</p>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                  <SelectTrigger className="h-11 bg-white text-slate-800 border-0">
                    <SelectValue placeholder="請選擇訂購人" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} - 餘額: ${member.balance?.toLocaleString() || 0}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="meal_box" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="meal_box" className="text-base">
              <Package className="w-4 h-4 mr-2" />
              餐盒系列
            </TabsTrigger>
            <TabsTrigger value="side_dish" className="text-base">
              <Plus className="w-4 h-4 mr-2" />
              單點系列
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meal_box">
            {productsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="h-32 bg-slate-200 rounded mb-3" />
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                    <div className="h-6 bg-slate-200 rounded w-1/2" />
                  </Card>
                ))}
              </div>
            ) : mealBoxes.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">尚無餐盒產品</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mealBoxes.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="side_dish">
            {productsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="h-20 bg-slate-200 rounded mb-3" />
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                    <div className="h-6 bg-slate-200 rounded w-1/2" />
                  </Card>
                ))}
              </div>
            ) : sideDishes.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <Plus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">尚無單點產品</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sideDishes.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CartDialog
        open={showCart}
        onOpenChange={setShowCart}
        cart={cart}
        onUpdateItem={updateCartItem}
        onRemoveItem={removeFromCart}
        onCheckout={handleCheckout}
        totalAmount={getTotalAmount()}
      />

      <CheckoutDialog
        open={showCheckout}
        onOpenChange={setShowCheckout}
        cart={cart}
        members={members}
        selectedMemberId={selectedMemberId}
        totalAmount={getTotalAmount()}
        onComplete={handleCheckoutComplete}
      />
    </div>
  );
}