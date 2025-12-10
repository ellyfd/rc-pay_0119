import React, { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function BatchTransactionDialog({ open, onOpenChange, members, onBatchTransaction }) {
  const [items, setItems] = useState([{ member_id: '', amount: '' }]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setItems([{ member_id: '', amount: '' }]);
    setNote('');
  };

  const addItem = () => {
    setItems([...items, { member_id: '', amount: '' }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => {
      const amount = parseFloat(item.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  };

  const isValid = () => {
    if (items.length === 0) return false;
    return items.every(item => item.member_id && item.amount && parseFloat(item.amount) > 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid()) return;

    setLoading(true);
    const transactions = items.map(item => ({
      member_id: item.member_id,
      amount: parseFloat(item.amount),
      note
    }));
    await onBatchTransaction(transactions);
    setLoading(false);
    resetForm();
    onOpenChange(false);
  };

  const getAvailableMembers = (currentIndex) => {
    const selectedIds = items
      .map((item, idx) => idx !== currentIndex ? item.member_id : null)
      .filter(Boolean);
    return members.filter(m => !selectedIds.includes(m.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5" />
            批次扣款（訂餐）
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">一次向多位成員收取不同金額</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Items List */}
          <div className="space-y-3">
            <Label className="text-slate-700">扣款明細</Label>
            {items.map((item, index) => (
              <Card key={index} className="p-4 bg-slate-50 border-slate-200">
                <div className="flex gap-3 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">成員</Label>
                      <Select
                        value={item.member_id}
                        onValueChange={(value) => updateItem(index, 'member_id', value)}
                      >
                        <SelectTrigger className="h-11 bg-white">
                          <SelectValue placeholder="選擇成員" />
                        </SelectTrigger>
                        <SelectContent>
                          {item.member_id && (
                            <SelectItem value={item.member_id}>
                              {members.find(m => m.id === item.member_id)?.name}
                            </SelectItem>
                          )}
                          {getAvailableMembers(index).map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">金額</Label>
                      <Input
                        type="number"
                        value={item.amount}
                        onChange={(e) => updateItem(index, 'amount', e.target.value)}
                        placeholder="0"
                        className="h-11 text-lg font-semibold bg-white"
                        min="0"
                        step="1"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    className="mt-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                    disabled={items.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              className="w-full h-11 border-dashed border-2 hover:bg-slate-50"
              disabled={items.length >= members.length}
            >
              <Plus className="w-4 h-4 mr-2" />
              新增成員
            </Button>
          </div>

          {/* Total Amount */}
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex justify-between items-center">
              <span className="text-slate-700 font-medium">總金額</span>
              <span className="text-2xl font-bold text-amber-700">
                ${getTotalAmount().toLocaleString()}
              </span>
            </div>
          </Card>

          {/* Note */}
          <div className="space-y-2">
            <Label className="text-slate-700">備註（選填）</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：午餐訂購、下午茶、團購..."
              className="resize-none"
              rows={2}
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 bg-red-500 hover:bg-red-600 font-medium text-white"
            disabled={loading || !isValid()}
          >
            {loading ? '處理中...' : `確認扣款 ${items.length} 筆交易`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}