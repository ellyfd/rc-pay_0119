import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProductFormDialog({ open, onOpenChange, product, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: 'meal_box',
    is_active: true,
    is_flash: false,
    description: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        price: product.price || '',
        category: product.category || 'meal_box',
        is_active: product.is_active ?? true,
        is_flash: product.is_flash || false,
        description: product.description || ''
      });
    } else {
      setFormData({
        name: '',
        price: '',
        category: 'meal_box',
        is_active: true,
        is_flash: false,
        description: ''
      });
    }
  }, [product, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) return;

    setLoading(true);
    await onSave({
      ...formData,
      price: parseFloat(formData.price)
    });
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">
            {product ? '編輯產品' : '新增產品'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">產品名稱</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：古早味瓜仔肉"
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">價格</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="110"
                className="h-11"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">分類</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meal_box">餐盒系列</SelectItem>
                  <SelectItem value="side_dish">單點系列</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">產品描述（選填）</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="例如：套餐包含五穀飯、三樣配菜、主餐"
              className="resize-none"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label htmlFor="is_active" className="font-medium">啟用產品</Label>
              <p className="text-sm text-slate-500">停用後將不會顯示在訂餐頁面</p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label htmlFor="is_flash" className="font-medium">快閃餐盒</Label>
              <p className="text-sm text-slate-500">標記為限時特別餐盒</p>
            </div>
            <Switch
              id="is_flash"
              checked={formData.is_flash}
              onCheckedChange={(checked) => setFormData({ ...formData, is_flash: checked })}
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700"
            disabled={loading || !formData.name || !formData.price}
          >
            {loading ? '儲存中...' : product ? '更新產品' : '新增產品'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}