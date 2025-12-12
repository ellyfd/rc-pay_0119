import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
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
import { Upload } from "lucide-react";

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
    }
  }, [groupBuy]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, image_url: result.file_url });
    } catch (error) {
      alert('上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      alert('請輸入團購標題！');
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯團購</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label>團購標題 *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例：日本零食團購、韓國美妝團..."
            />
          </div>

          {/* Description */}
          <div>
            <Label>團購說明</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="說明團購內容、注意事項等..."
              rows={3}
            />
          </div>

          {/* Product Link */}
          <div>
            <Label>商品連結</Label>
            <Input
              value={formData.product_link}
              onChange={(e) => setFormData({ ...formData, product_link: e.target.value })}
              placeholder="https://..."
              type="url"
            />
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
              <div className="mt-3">
                <img
                  src={formData.image_url}
                  alt="Preview"
                  className="w-full max-w-xs rounded-lg border"
                />
              </div>
            )}
          </div>

          {/* Deadline */}
          <div>
            <Label>截止日期</Label>
            <Input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          {/* Note */}
          <div>
            <Label>備註</Label>
            <Input
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="其他說明..."
            />
          </div>
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
      </DialogContent>
    </Dialog>
  );
}