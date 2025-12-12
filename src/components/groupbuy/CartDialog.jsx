import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, Plus, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CartDialog({ open, onOpenChange, cart, onUpdateQuantity, onRemove, onCheckout }) {
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            購物車
            {cart.length > 0 && (
              <Badge className="bg-purple-600">{cart.length}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {cart.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">購物車是空的</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item, index) => (
              <div key={index} className="flex items-start gap-4 bg-slate-50 rounded-lg p-4">
                <div className="flex-1">
                  <h4 className="font-medium text-slate-800">{item.product_name}</h4>
                  <p className="text-sm text-slate-500">單價：${item.price}</p>
                  {item.note && (
                    <p className="text-xs text-slate-400 mt-1">備註：{item.note}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                <div className="text-right">
                  <p className="font-bold text-purple-600">${(item.price * item.quantity).toLocaleString()}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 mt-1"
                    onClick={() => onRemove(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="border-t pt-4 flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-700">總計</span>
              <span className="text-2xl font-bold text-purple-600">${total.toLocaleString()}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            繼續選購
          </Button>
          <Button
            onClick={onCheckout}
            disabled={cart.length === 0}
            className="bg-purple-600 hover:bg-purple-700"
          >
            提交訂單
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}