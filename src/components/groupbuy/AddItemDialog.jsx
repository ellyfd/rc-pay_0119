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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export default function AddItemDialog({ open, onOpenChange, members, currentUser, item, onAdd }) {
  const [items, setItems] = useState([{
    id: Date.now(),
    member_id: '',
    member_name: '',
    product_name: '',
    quantity: 1,
    price: 0,
    note: ''
  }]);

  useEffect(() => {
    if (item) {
      // Editing single item
      setItems([{
        id: Date.now(),
        member_id: item.member_id,
        member_name: item.member_name,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        note: item.note || ''
      }]);
    } else if (currentUser && open) {
      // Reset for new items
      setItems([{
        id: Date.now(),
        member_id: currentUser.id,
        member_name: currentUser.full_name || currentUser.email,
        product_name: '',
        quantity: 1,
        price: 0,
        note: ''
      }]);
    }
  }, [item, currentUser, open]);

  const handleMemberChange = (itemId, memberId) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      setItems(items.map(i => 
        i.id === itemId 
          ? { ...i, member_id: member.id, member_name: member.name }
          : i
      ));
    }
  };

  const updateItem = (itemId, field, value) => {
    setItems(items.map(i => 
      i.id === itemId ? { ...i, [field]: value } : i
    ));
  };

  const addNewItem = () => {
    setItems([...items, {
      id: Date.now(),
      member_id: currentUser?.id || '',
      member_name: currentUser?.full_name || currentUser?.email || '',
      product_name: '',
      quantity: 1,
      price: 0,
      note: ''
    }]);
  };

  const removeItem = (itemId) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== itemId));
    }
  };

  const handleSubmit = () => {
    // Validate all items
    for (const item of items) {
      if (!item.member_id || !item.product_name || !item.price) {
        alert('請填寫所有項目的必填欄位！');
        return;
      }
    }
    
    // If editing, submit single item
    if (item) {
      const { id, ...itemData } = items[0];
      onAdd(itemData);
    } else {
      // Submit all items
      items.forEach(({ id, ...itemData }) => {
        onAdd(itemData);
      });
    }
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? '編輯項目' : '新增項目'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {items.map((itemData, index) => (
            <div key={itemData.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">項目 #{index + 1}</span>
                {!item && items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(itemData.id)}
                    className="h-7 w-7 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Member */}
                <div>
                  <Label>跟團者 *</Label>
                  <Select 
                    value={itemData.member_id} 
                    onValueChange={(value) => handleMemberChange(itemData.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇成員" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product Name */}
                <div>
                  <Label>商品名稱 *</Label>
                  <Input
                    value={itemData.product_name}
                    onChange={(e) => updateItem(itemData.id, 'product_name', e.target.value)}
                    placeholder="例：洋芋片、口紅..."
                  />
                </div>

                {/* Quantity */}
                <div>
                  <Label>數量 *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={itemData.quantity}
                    onChange={(e) => updateItem(itemData.id, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>

                {/* Price */}
                <div>
                  <Label>單價 *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={itemData.price}
                    onChange={(e) => updateItem(itemData.id, 'price', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <Label>備註</Label>
                <Input
                  value={itemData.note}
                  onChange={(e) => updateItem(itemData.id, 'note', e.target.value)}
                  placeholder="規格、顏色等..."
                />
              </div>

              {/* Item Total */}
              <div className="bg-slate-50 rounded-lg p-2 text-right">
                <span className="text-sm text-slate-600">小計：</span>
                <span className="text-lg font-bold text-purple-600 ml-2">
                  ${(itemData.price * itemData.quantity).toLocaleString()}
                </span>
              </div>
            </div>
          ))}

          {/* Add More Button */}
          {!item && (
            <Button
              type="button"
              variant="outline"
              onClick={addNewItem}
              className="w-full border-dashed"
            >
              <Plus className="w-4 h-4 mr-2" />
              再新增一個項目
            </Button>
          )}

          {/* Grand Total */}
          <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
            <div className="flex justify-between items-center">
              <span className="text-slate-700 font-semibold">總金額</span>
              <span className="text-2xl font-bold text-purple-600">
                ${getTotalAmount().toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {item ? '更新' : `新增 ${items.length} 個項目`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}