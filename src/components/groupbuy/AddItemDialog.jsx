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
  const [selectedMember, setSelectedMember] = useState('');
  const [items, setItems] = useState([{
    product_name: '',
    quantity: 1,
    price: 0,
    note: ''
  }]);

  useEffect(() => {
    if (item) {
      // Editing single item mode
      setSelectedMember(item.member_id);
      setItems([{
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        note: item.note || ''
      }]);
    } else if (currentUser) {
      // Auto-select current user by default
      setSelectedMember(currentUser.id);
      setItems([{
        product_name: '',
        quantity: 1,
        price: 0,
        note: ''
      }]);
    }
  }, [item, currentUser, open]);

  const addRow = () => {
    setItems([...items, {
      product_name: '',
      quantity: 1,
      price: 0,
      note: ''
    }]);
  };

  const removeRow = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = () => {
    if (!selectedMember) {
      alert('請選擇成員！');
      return;
    }

    const member = members.find(m => m.id === selectedMember);
    if (!member) return;

    // Validate all items
    const validItems = items.filter(item => 
      item.product_name && item.price > 0
    );

    if (validItems.length === 0) {
      alert('請至少新增一個有效的品項（需填寫商品名稱和單價）！');
      return;
    }

    // If editing, only submit single item
    if (item) {
      onAdd({
        member_id: member.id,
        member_name: member.name,
        ...validItems[0]
      });
    } else {
      // Batch add - call onAdd for each valid item
      validItems.forEach(validItem => {
        onAdd({
          member_id: member.id,
          member_name: member.name,
          ...validItem
        });
      });
    }

    // Reset form
    setSelectedMember(currentUser?.id || '');
    setItems([{
      product_name: '',
      quantity: 1,
      price: 0,
      note: ''
    }]);
    onOpenChange(false);
  };

  const totalAmount = items.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? '編輯項目' : '新增項目'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Member */}
          <div>
            <Label>跟團者 *</Label>
            <Select value={formData.member_id} onValueChange={handleMemberChange}>
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
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              placeholder="例：洋芋片、口紅..."
            />
          </div>

          {/* Quantity */}
          <div>
            <Label>數量 *</Label>
            <Input
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
            />
          </div>

          {/* Price */}
          <div>
            <Label>單價 *</Label>
            <Input
              type="number"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>

          {/* Note */}
          <div>
            <Label>備註</Label>
            <Input
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="規格、顏色等..."
            />
          </div>

          {/* Total */}
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">小計</span>
              <span className="text-xl font-bold text-purple-600">
                ${(formData.price * formData.quantity).toLocaleString()}
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
            disabled={!formData.member_id || !formData.product_name || !formData.price}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {item ? '更新' : '新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}