import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function ProductCard({ product, onAddToCart }) {
  const [showOptions, setShowOptions] = useState(false);
  const [riceOption, setRiceOption] = useState('normal');

  const handleAdd = () => {
    if (product.category === 'meal_box') {
      setShowOptions(true);
    } else {
      onAddToCart(product, 'normal');
    }
  };

  const handleConfirmAdd = () => {
    onAddToCart(product, riceOption);
    setShowOptions(false);
    setRiceOption('normal');
  };

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 mb-1">{product.name}</h3>
              {product.description && (
                <p className="text-sm text-slate-500 line-clamp-2">{product.description}</p>
              )}
            </div>
            {product.is_flash && (
              <Badge className="bg-red-500 ml-2">快閃</Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-emerald-600">NT${product.price}</p>
            <Button
              onClick={handleAdd}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              加入
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>選擇飯量選項</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">{product.name}</p>
            <RadioGroup value={riceOption} onValueChange={setRiceOption}>
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal" className="flex-1 cursor-pointer">
                  正常飯量
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="less_rice" id="less_rice" />
                <Label htmlFor="less_rice" className="flex-1 cursor-pointer">
                  飯少
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="rice_to_veg" id="rice_to_veg" />
                <Label htmlFor="rice_to_veg" className="flex-1 cursor-pointer">
                  飯換菜
                </Label>
              </div>
            </RadioGroup>
          </div>
          <Button onClick={handleConfirmAdd} className="w-full bg-emerald-600 hover:bg-emerald-700">
            確認加入購物車
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}