import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShoppingCart, Trash2, Plus, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RICE_OPTION_LABELS } from "@/components/utils/constants";

export default function CartDialog({ open, onOpenChange, cart, onUpdateItem, onRemoveItem, onCheckout, totalAmount }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            購物車
          </DialogTitle>
        </DialogHeader>

        {cart.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">購物車是空的</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cart Items */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {cart.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800">{item.product_name}</h4>
                      {item.category === 'meal_box' && item.rice_option !== 'normal' && (
                        <Badge variant="outline" className="mt-1">
                          {RICE_OPTION_LABELS[item.rice_option]}
                        </Badge>
                      )}
                      <p className="text-sm text-slate-500 mt-1">NT${item.price}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onUpdateItem(index, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onUpdateItem(index, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-emerald-600">
                        NT${(item.price * item.quantity).toLocaleString()}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 mt-1"
                        onClick={() => onRemoveItem(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Total */}
            <Card className="p-4 bg-emerald-50 border-emerald-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-slate-800">總計</span>
                <span className="text-2xl font-bold text-emerald-600">
                  NT${totalAmount.toLocaleString()}
                </span>
              </div>
            </Card>

            {/* Checkout Button */}
            <Button
              onClick={onCheckout}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              前往結帳
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}