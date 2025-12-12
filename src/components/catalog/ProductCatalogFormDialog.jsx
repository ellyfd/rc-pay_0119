import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { base44 } from '@/api/base44Client';
import { Upload, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProductCatalogFormDialog({ open, onOpenChange, product, existingCategories, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    category: '',
    base_price: 0,
    is_active: true
  });
  const [uploading, setUploading] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        image_url: product.image_url || '',
        category: product.category || '',
        base_price: product.base_price || 0,
        is_active: product.is_active !== false
      });
      setIsNewCategory(!existingCategories.includes(product.category));
    } else {
      setFormData({
        name: '',
        description: '',
        image_url: '',
        category: '',
        base_price: 0,
        is_active: true
      });
      setIsNewCategory(false);
    }
  }, [product, open, existingCategories]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, image_url: file_url });
    } catch (error) {
      alert('圖片上傳失敗');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.category) {
      alert('請填寫產品名稱和分類！');
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? '編輯產品' : '新增產品'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Name */}
          <div>
            <Label>產品名稱 *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例：特級洋芋片、YSL口紅..."
            />
          </div>

          {/* Category */}
          <div>
            <Label>分類 *</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isNewCategory}
                  onCheckedChange={setIsNewCategory}
                />
                <span className="text-sm text-slate-600">新增分類</span>
              </div>
              {isNewCategory ? (
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="輸入新分類名稱"
                />
              ) : (
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇分類" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>產品描述</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="產品的詳細說明..."
              rows={3}
            />
          </div>

          {/* Base Price */}
          <div>
            <Label>參考價格</Label>
            <Input
              type="number"
              min="0"
              value={formData.base_price}
              onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
            <p className="text-xs text-slate-500 mt-1">僅供參考，實際價格可在訂購時調整</p>
          </div>

          {/* Image */}
          <div>
            <Label>產品圖片</Label>
            <div className="space-y-3">
              {formData.image_url && (
                <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
                  <img
                    src={formData.image_url}
                    alt="產品圖片"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('image-upload').click()}
                  disabled={uploading}
                  className="flex-1"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      上傳中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {formData.image_url ? '更換圖片' : '上傳圖片'}
                    </>
                  )}
                </Button>
                {formData.image_url && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormData({ ...formData, image_url: '' })}
                  >
                    移除
                  </Button>
                )}
              </div>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between">
            <div>
              <Label>啟用狀態</Label>
              <p className="text-xs text-slate-500">停用的產品不會在選單中顯示</p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.name || !formData.category}
          >
            {product ? '更新' : '新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}