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
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [splitMode, setSplitMode] = useState(false);
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
      setSplitMode(false);
      setSelectedMembers([]);
      setItems([{
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        note: item.note || ''
      }]);
    } else if (currentUser) {
      // Auto-select current user by default
      setSelectedMember(currentUser.id);
      setSplitMode(false);
      setSelectedMembers([]);
      setItems([{
        product_name: '',
        quantity: 1,
        price: 0,
        note: ''
      }]);
    }
  }, [item, currentUser, open]);

  const toggleMember = (memberId) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

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
    // Validate member selection
    const targetMembers = splitMode ? selectedMembers : [selectedMember];
    
    if (targetMembers.length === 0) {
      alert('請選擇成員！');
      return;
    }

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
      const member = members.find(m => m.id === selectedMember);
      if (!member) return;
      
      onAdd({
        member_id: member.id,
        member_name: member.name,
        ...validItems[0]
      });
    } else {
      // For each valid item
      validItems.forEach(validItem => {
        if (splitMode && targetMembers.length > 1) {
          // Split mode: divide price among members
          const splitPrice = validItem.price / targetMembers.length;
          targetMembers.forEach(memberId => {
            const member = members.find(m => m.id === memberId);
            if (member) {
              onAdd({
                member_id: member.id,
                member_name: member.name,
                product_name: validItem.product_name,
                quantity: validItem.quantity,
                price: Math.round(splitPrice * 100) / 100, // Round to 2 decimals
                note: validItem.note
              });
            }
          });
        } else {
          // Normal mode: single member
          const member = members.find(m => m.id === selectedMember);
          if (member) {
            onAdd({
              member_id: member.id,
              member_name: member.name,
              ...validItem
            });
          }
        }
      });
    }

    // Reset form
    setSelectedMember(currentUser?.id || '');
    setSelectedMembers([]);
    setSplitMode(false);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? '編輯項目' : '新增項目'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Split Mode Toggle */}
          {!item && (
            <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
              <Checkbox
                id="splitMode"
                checked={splitMode}
                onCheckedChange={(checked) => {
                  setSplitMode(checked);
                  if (checked) {
                    setSelectedMembers([selectedMember].filter(Boolean));
                  } else {
                    setSelectedMembers([]);
                  }
                }}
              />
              <Label htmlFor="splitMode" className="cursor-pointer text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>多人平分模式</span>
                </div>
                <p className="text-xs text-slate-600 font-normal mt-0.5">
                  金額將平均分攤給所選成員
                </p>
              </Label>
            </div>
          )}

          {/* Member Selection */}
          {!splitMode ? (
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
          ) : (
            <div>
              <Label>選擇平分成員 * ({selectedMembers.length} 人)</Label>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`member-${member.id}`}
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={() => toggleMember(member.id)}
                      />
                      <Label htmlFor={`member-${member.id}`} className="cursor-pointer text-sm">
                        {member.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              {splitMode && selectedMembers.length > 1 && items.length > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  每人將分攤：${Math.round((totalAmount / selectedMembers.length) * 100) / 100}
                </p>
              )}
            </div>
          )}

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
            disabled={splitMode ? selectedMembers.length === 0 : !selectedMember}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {item ? '更新' : splitMode && selectedMembers.length > 1 
              ? `平分給 ${selectedMembers.length} 人` 
              : `新增 ${items.filter(i => i.product_name && i.price > 0).length} 個項目`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}