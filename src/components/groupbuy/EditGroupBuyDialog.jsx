import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import imageCompression from 'browser-image-compression';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Plus, Trash2, ZoomIn, X, ChevronDown } from "lucide-react";
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import DiscountRulesEditor from "./DiscountRulesEditor";
import ProductListEditor from "./ProductListEditor";

export default function EditGroupBuyDialog({ open, onOpenChange, groupBuy, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    product_link: '',
    image_url: '',
    deadline: '',
    note: ''
  });
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);
  const [discountRules, setDiscountRules] = useState([]);
  const [discountRuleType, setDiscountRuleType] = useState('quantity');
  const [discountType, setDiscountType] = useState('percent');
  const [fixedDiscountAllocation, setFixedDiscountAllocation] = useState('per_item');
  const [showImageModal, setShowImageModal] = useState(false);
  const [showTipExample, setShowTipExample] = useState(false);
  const queryClient = useQueryClient();

  const { data: existingProducts = [] } = useQuery({
    queryKey: ['groupBuyProducts', groupBuy?.id],
    queryFn: async () => {
      const allProducts = await base44.entities.GroupBuyProduct.list('-created_date');
      return allProducts.filter(p => p.group_buy_id === groupBuy?.id);
    },
    enabled: !!groupBuy?.id && open
  });

  useEffect(() => {
    if (groupBuy) {
      setFormData({
        title: groupBuy.title || '',
        description: groupBuy.description || '',
        product_link: groupBuy.product_link || '',
        image_url: groupBuy.image_url || '',
        deadline: groupBuy.deadline || '',
        note: groupBuy.note || ''
      });
      const rules = groupBuy.discount_rules || [];
      setDiscountRules(rules);
      setFixedDiscountAllocation(groupBuy.fixed_discount_allocation || 'per_item');
      
      // 根據現有折扣規則設定類型
      if (rules.length > 0) {
        const firstRule = rules[0];
        setDiscountRuleType(firstRule.type || 'quantity');
        setDiscountType(firstRule.discount_type || 'percent');
      }
    }
  }, [groupBuy]);

  useEffect(() => {
    if (existingProducts.length > 0) {
      setProducts(existingProducts.map(p => ({
        id: p.id,
        product_name: p.product_name,
        price: p.price,
        description: p.description || ''
      })));
    } else {
      setProducts([]);
    }
  }, [existingProducts]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Compress image before upload
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true
        };
        try {
          fileToUpload = await imageCompression(file, options);
        } catch (compressionError) {
          console.warn('圖片壓縮失敗，使用原始檔案', compressionError);
        }
      }
      const result = await base44.integrations.Core.UploadFile({ file: fileToUpload });
      setFormData({ ...formData, image_url: result.file_url });
      } catch (error) {
       toast.error('上傳失敗：' + error.message);
      } finally {
      setUploading(false);
    }
  };



  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('請輸入團購標題！');
      return;
    }

    try {
      const validProducts = products.filter(p => p.product_name && p.price > 0);

      // ✅ 先處理商品（失敗時 dialog 還在，可以重試）
      // 並行刪除
      await Promise.all(
        existingProducts
          .filter(ep => !validProducts.find(p => p.id === ep.id))
          .map(ep => base44.entities.GroupBuyProduct.delete(ep.id))
      );

      // 並行更新/建立
      await Promise.all(
        validProducts.map(product =>
          product.id
            ? base44.entities.GroupBuyProduct.update(product.id, {
                product_name: product.product_name,
                price: product.price,
                description: product.description
              })
            : base44.entities.GroupBuyProduct.create({
                group_buy_id: groupBuy.id,
                product_name: product.product_name,
                price: product.price,
                description: product.description
              })
        )
      );

      // ✅ 商品都處理完才更新主資料
      await onSave({
        ...formData,
        discount_rules: discountRules.filter(r => {
          const hasCondition = (r.type === 'quantity' && r.min_quantity > 0) || 
                              (r.type === 'amount' && r.min_amount > 0);
          const hasDiscount = (r.discount_type === 'percent' && r.discount_percent > 0) || 
                             (r.discount_type === 'fixed' && r.discount_amount > 0);
          return hasCondition && hasDiscount;
        }),
        fixed_discount_allocation: fixedDiscountAllocation
      });

      queryClient.invalidateQueries({ queryKey: ['groupBuyProducts'] });
    } catch (error) {
      toast.error('儲存失敗：' + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯團購</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic Info Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm border-b pb-2">📝 基本資訊</h3>
            
            {/* Title */}
            <div>
              <Label className="text-slate-700">團購標題 <span className="text-red-500">*</span></Label>
              <p className="text-xs text-slate-500 mb-1.5">設定一個吸引人的標題</p>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例：日本零食團購、韓國美妝團..."
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-slate-700">團購說明（選填）</Label>
              <p className="text-xs text-slate-500 mb-1.5">詳細說明團購內容、注意事項等</p>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="說明團購內容、注意事項等..."
                rows={3}
              />
            </div>

            {/* Product Link */}
            <div>
              <Label className="text-slate-700">商品連結（選填）</Label>
              <p className="text-xs text-slate-500 mb-1.5">可貼上購物網站連結</p>
              <Input
                value={formData.product_link}
                onChange={(e) => setFormData({ ...formData, product_link: e.target.value })}
                placeholder="https://..."
                type="url"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <Label>商品圖片</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('edit-groupbuy-image').click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? '上傳中...' : '上傳圖片'}
              </Button>
              <input
                id="edit-groupbuy-image"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              {formData.image_url && (
                <span className="text-sm text-green-600">✓ 已上傳</span>
              )}
            </div>
            {formData.image_url && (
              <div 
                className="mt-3 relative bg-slate-100 rounded-lg overflow-hidden cursor-pointer group h-48 max-w-xs"
                onClick={() => setShowImageModal(true)}
              >
                <img
                  src={formData.image_url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                  <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}
          </div>

          {/* Deadline */}
          <div>
            <Label className="text-slate-700">截止日期（選填）</Label>
            <p className="text-xs text-slate-500 mb-1.5">設定團購截止時間</p>
            <Input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          {/* Note */}
          <div>
            <Label className="text-slate-700">備註（選填）</Label>
            <Input
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="其他說明..."
            />
          </div>

          <DiscountRulesEditor
            discountRules={discountRules}
            setDiscountRules={setDiscountRules}
            discountRuleType={discountRuleType}
            setDiscountRuleType={setDiscountRuleType}
            discountType={discountType}
            setDiscountType={setDiscountType}
            fixedDiscountAllocation={fixedDiscountAllocation}
            setFixedDiscountAllocation={setFixedDiscountAllocation}
            showTipExample={showTipExample}
            setShowTipExample={setShowTipExample}
          />

          <ProductListEditor products={products} setProducts={setProducts} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.title.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            儲存變更
            </Button>
            </DialogFooter>

            {/* Image Modal */}
            {showImageModal && formData.image_url && (
            <div 
            className="fixed inset-0 z-50 bg-black/90 overflow-auto p-4"
            onClick={() => setShowImageModal(false)}
            >
            <button
              onClick={() => setShowImageModal(false)}
              className="sticky top-4 left-full bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10 mb-4"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <img
              src={formData.image_url}
              alt="Preview"
              className="w-full h-auto max-w-7xl mx-auto"
              onClick={(e) => e.stopPropagation()}
            />
            </div>
            )}
            </DialogContent>
            </Dialog>
            );
}