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
import { Plus, Trash2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function AddItemDialog({ open, onOpenChange, members, currentUser, item, onAdd, presetProducts = [] }) {
  const [selectedMember, setSelectedMember] = useState('');
  const [items, setItems] = useState([{
    product_name: '',
    quantity: 1,
    price: 0,
    note: ''
  }]);
  const [splitMembers, setSplitMembers] = useState([]);

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
      // Load split members if exists
      if (item.split_members && item.split_members.length > 0) {
        setSplitMembers(item.split_members.map(m => m.member_id));
      } else {
        setSplitMembers([]);
      }
    } else if (currentUser) {
      // Auto-select current user by default
      setSelectedMember(currentUser.id);
      setItems([{
        product_name: '',
        quantity: 1,
        price: 0,
        note: ''
      }]);
      setSplitMembers([]);
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

  const handleSelectPresetProduct = (index, productId) => {
    const product = presetProducts.find(p => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        product_name: product.product_name,
        quantity: 1,
        price: product.price,
        note: product.description || ''
      };
      setItems(newItems);
    }
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

    // Build split members array
    const splitMembersData = splitMembers.length > 0 
      ? splitMembers.map(memberId => {
          const m = members.find(mem => mem.id === memberId);
          return { member_id: m.id, member_name: m.name };
        })
      : [];

    // If editing, only submit single item
    if (item) {
      onAdd({
        member_id: member.id,
        member_name: member.name,
        ...validItems[0],
        split_members: splitMembersData,
        split_count: splitMembersData.length
      });
    } else {
      // Batch add - call onAdd for each valid item
      validItems.forEach(validItem => {
        onAdd({
          member_id: member.id,
          member_name: member.name,
          ...validItem,
          split_members: splitMembersData,
          split_count: splitMembersData.length
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
    setSplitMembers([]);
    onOpenChange(false);
  };

  const totalAmount = items.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  );

  const toggleSplitMember = (memberId) => {
    if (splitMembers.includes(memberId)) {
      setSplitMembers(splitMembers.filter(id => id !== memberId));
    } else {
      setSplitMembers([...splitMembers, memberId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? '編輯項目' : '新增項目'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Member Selection */}
          <div>
            <Label>跟團者 *</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
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

          {/* Split Members Selection */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <Label className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4" />
              多人平分（可選）
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {members.map(member => (
                <div key={member.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`split-${member.id}`}
                    checked={splitMembers.includes(member.id)}
                    onCheckedChange={() => toggleSplitMember(member.id)}
                  />
                  <label
                    htmlFor={`split-${member.id}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {member.name}
                  </label>
                </div>
              ))}
            </div>
            {splitMembers.length > 0 && (
              <p className="text-xs text-slate-600 mt-3">
                已選 {splitMembers.length} 人，每人平均付款：${(totalAmount / splitMembers.length).toFixed(0)}
              </p>
            )}
          </div>

          {/* Items Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">商品名稱 *</th>
                  <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-24">數量 *</th>
                  <th className="text-right px-3 py-2 text-sm font-semibold text-slate-700 w-28">單價 *</th>
                  <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">備註</th>
                  <th className="text-right px-3 py-2 text-sm font-semibold text-slate-700 w-28">小計</th>
                  {!item && (
                    <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-16"></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((rowItem, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2">
                      {presetProducts.length > 0 && !item ? (
                        <div className="flex gap-2">
                          <Select
                            value=""
                            onValueChange={(value) => handleSelectPresetProduct(index, value)}
                          >
                            <SelectTrigger className="h-9 w-[140px]">
                              <SelectValue placeholder="選擇商品" />
                            </SelectTrigger>
                            <SelectContent>
                              {presetProducts.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.product_name} - ${p.price}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={rowItem.product_name}
                            onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                            placeholder="或自行輸入..."
                            className="h-9 flex-1"
                          />
                        </div>
                      ) : (
                        <Input
                          value={rowItem.product_name}
                          onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                          placeholder="洋芋片、口紅..."
                          className="h-9"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="1"
                        value={rowItem.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="h-9 text-center"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        value={rowItem.price}
                        onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="h-9 text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={rowItem.note}
                        onChange={(e) => updateItem(index, 'note', e.target.value)}
                        placeholder="規格、顏色..."
                        className="h-9"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700">
                      ${(rowItem.price * rowItem.quantity).toLocaleString()}
                    </td>
                    {!item && (
                      <td className="px-3 py-2 text-center">
                        {items.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(index)}
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t">
                <tr>
                  <td colSpan={item ? 4 : 5} className="px-3 py-2 text-right font-semibold text-slate-700">
                    總計
                  </td>
                  <td className="px-3 py-2 text-right text-lg font-bold text-purple-600">
                    ${totalAmount.toLocaleString()}
                  </td>
                  {!item && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>

          {!item && (
            <Button
              onClick={addRow}
              variant="outline"
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              新增一行
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedMember}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {item ? '更新' : `新增 ${items.filter(i => i.product_name && i.price > 0).length} 個項目`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}