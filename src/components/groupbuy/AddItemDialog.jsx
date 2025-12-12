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
    note: '',
    split: false,
    splitMembers: []
  }]);

  useEffect(() => {
    if (item) {
      // Editing single item mode
      setSelectedMember(item.member_id);
      setItems([{
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        note: item.note || '',
        split: false,
        splitMembers: []
      }]);
    } else if (currentUser) {
      // Auto-select current user by default
      setSelectedMember(currentUser.id);
      setItems([{
        product_name: '',
        quantity: 1,
        price: 0,
        note: '',
        split: false,
        splitMembers: []
      }]);
    }
  }, [item, currentUser, open]);

  const addRow = () => {
    setItems([...items, {
      product_name: '',
      quantity: 1,
      price: 0,
      note: '',
      split: false,
      splitMembers: []
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
        note: product.description || '',
        split: false,
        splitMembers: []
      };
      setItems(newItems);
    }
  };

  const toggleSplit = (index) => {
    const newItems = [...items];
    newItems[index].split = !newItems[index].split;
    if (!newItems[index].split) {
      newItems[index].splitMembers = [];
    } else {
      // Auto-add current member when enabling split
      if (selectedMember) {
        newItems[index].splitMembers = [{
          member_id: selectedMember,
          quantity: 1
        }];
      }
    }
    setItems(newItems);
  };

  const addSplitMember = (itemIndex) => {
    const newItems = [...items];
    newItems[itemIndex].splitMembers.push({
      member_id: '',
      quantity: 1
    });
    setItems(newItems);
  };

  const removeSplitMember = (itemIndex, memberIndex) => {
    const newItems = [...items];
    newItems[itemIndex].splitMembers = newItems[itemIndex].splitMembers.filter((_, i) => i !== memberIndex);
    setItems(newItems);
  };

  const updateSplitMember = (itemIndex, memberIndex, field, value) => {
    const newItems = [...items];
    newItems[itemIndex].splitMembers[memberIndex][field] = value;
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
        // If split mode is enabled, create items for each member
        if (validItem.split && validItem.splitMembers.length > 0) {
          validItem.splitMembers.forEach(splitMember => {
            const splitMemberData = members.find(m => m.id === splitMember.member_id);
            if (splitMemberData && splitMember.quantity > 0) {
              onAdd({
                member_id: splitMemberData.id,
                member_name: splitMemberData.name,
                product_name: validItem.product_name,
                quantity: splitMember.quantity,
                price: validItem.price,
                note: validItem.note
              });
            }
          });
        } else {
          // Normal mode - add to selected member
          onAdd({
            member_id: member.id,
            member_name: member.name,
            product_name: validItem.product_name,
            quantity: validItem.quantity,
            price: validItem.price,
            note: validItem.note
          });
        }
      });
    }

    // Reset form
    setSelectedMember(currentUser?.id || '');
    setItems([{
      product_name: '',
      quantity: 1,
      price: 0,
      note: '',
      split: false,
      splitMembers: []
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

          {/* Items Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">商品名稱 *</th>
                  <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-24">數量 *</th>
                  <th className="text-right px-3 py-2 text-sm font-semibold text-slate-700 w-28">單價 *</th>
                  <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">備註</th>
                  {!item && (
                    <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-20">平分</th>
                  )}
                  <th className="text-right px-3 py-2 text-sm font-semibold text-slate-700 w-28">小計</th>
                  {!item && (
                    <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-16"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((rowItem, index) => (
                  <React.Fragment key={index}>
                    <tr className={rowItem.split ? 'border-b-0' : ''}>
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
                      {!item && (
                        <td className="px-3 py-2 text-center">
                          <Checkbox
                            checked={rowItem.split}
                            onCheckedChange={() => toggleSplit(index)}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2 text-right font-medium text-slate-700">
                        ${(rowItem.price * (rowItem.split ? rowItem.splitMembers.reduce((sum, m) => sum + m.quantity, 0) : rowItem.quantity)).toLocaleString()}
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
                    {!item && rowItem.split && (
                      <tr>
                        <td colSpan={7} className="px-3 py-2 bg-slate-50 border-b">
                          <div className="flex items-start gap-2">
                            <Users className="w-4 h-4 text-slate-500 mt-2" />
                            <div className="flex-1 space-y-2">
                              <div className="text-xs font-semibold text-slate-600 mb-2">平分成員：</div>
                              {rowItem.splitMembers.map((splitMember, memberIndex) => (
                                <div key={memberIndex} className="flex gap-2 items-center">
                                  <Select
                                    value={splitMember.member_id}
                                    onValueChange={(value) => updateSplitMember(index, memberIndex, 'member_id', value)}
                                  >
                                    <SelectTrigger className="h-8 flex-1">
                                      <SelectValue placeholder="選擇成員" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {members.map(m => (
                                        <SelectItem key={m.id} value={m.id}>
                                          {m.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={splitMember.quantity}
                                    onChange={(e) => updateSplitMember(index, memberIndex, 'quantity', parseInt(e.target.value) || 1)}
                                    className="h-8 w-20 text-center"
                                    placeholder="數量"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeSplitMember(index, memberIndex)}
                                    className="h-8 w-8 text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                onClick={() => addSplitMember(index)}
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                新增成員
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t">
                <tr>
                  <td colSpan={item ? 4 : 6} className="px-3 py-2 text-right font-semibold text-slate-700">
                    總計
                  </td>
                  <td className="px-3 py-2 text-right text-lg font-bold text-purple-600">
                    ${items.reduce((sum, item) => 
                      sum + (item.price * (item.split ? item.splitMembers.reduce((s, m) => s + m.quantity, 0) : item.quantity)), 0
                    ).toLocaleString()}
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