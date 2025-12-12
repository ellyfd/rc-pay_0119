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
import { Plus, Trash2, Users, Wallet } from "lucide-react";
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
      const userMember = members.find(m => 
        m.user_emails && m.user_emails.includes(currentUser.email)
      );
      setSelectedMember(userMember?.id || '');
      setItems([{
        product_name: '',
        quantity: 1,
        price: 0,
        note: '',
        split: false,
        splitMembers: []
      }]);
    }
  }, [item, currentUser, open, members]);

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
        split: newItems[index].split || false,
        splitMembers: newItems[index].splitMembers || []
      };
      setItems(newItems);
    }
  };

  const toggleSplitMember = (itemIndex, memberId) => {
    const newItems = [...items];
    const splitMembers = newItems[itemIndex].splitMembers || [];
    
    if (splitMembers.includes(memberId)) {
      newItems[itemIndex].splitMembers = splitMembers.filter(id => id !== memberId);
    } else {
      newItems[itemIndex].splitMembers = [...splitMembers, memberId];
    }
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
      const itemData = validItems[0];
      onAdd({
        member_id: member.id,
        member_name: member.name,
        product_name: itemData.product_name,
        quantity: itemData.quantity,
        price: itemData.price,
        note: itemData.note
        });
    } else {
      // Batch add - call onAdd for each valid item
      validItems.forEach(validItem => {
        if (validItem.split && validItem.splitMembers && validItem.splitMembers.length > 0) {
          // Split mode: create item for each selected member including the main member
          const allSplitMembers = [member.id, ...validItem.splitMembers.filter(id => id !== member.id)];
          const splitCount = allSplitMembers.length;
          const splitPrice = validItem.price / splitCount;

          // Build split note - only show other members' names (excluding the orderer)
          const otherMemberNames = validItem.splitMembers
            .map(id => members.find(m => m.id === id)?.name)
            .filter(Boolean)
            .join('、');
          const splitNote = validItem.note 
            ? `${validItem.note}（${member.name}訂購，和${otherMemberNames}平分）` 
            : `${member.name}訂購，和${otherMemberNames}平分`;
          
          allSplitMembers.forEach(splitMemberId => {
            const splitMember = members.find(m => m.id === splitMemberId);
            if (splitMember) {
              onAdd({
                member_id: splitMember.id,
                member_name: splitMember.name,
                product_name: validItem.product_name,
                quantity: validItem.quantity,
                price: Math.round(splitPrice * 100) / 100,
                note: splitNote
                });
            }
          });
        } else {
          // Normal mode: add to selected member
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
    const userMember = members.find(m => 
      m.user_emails && currentUser && m.user_emails.includes(currentUser.email)
    );
    setSelectedMember(userMember?.id || '');
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
              <tbody className="divide-y">
                {items.map((rowItem, index) => (
                  <React.Fragment key={index}>
                    <tr>
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
                          onCheckedChange={(checked) => {
                            updateItem(index, 'split', checked);
                            if (!checked) {
                              updateItem(index, 'splitMembers', []);
                            }
                          }}
                        />
                        {rowItem.split && (
                          <div className="text-xs text-purple-600 mt-1">
                            <Users className="w-3 h-3 inline mr-1" />
                            {(rowItem.splitMembers?.length || 0) + 1}人
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right font-medium text-slate-700">
                      ${(rowItem.price * rowItem.quantity).toLocaleString()}
                      {!item && rowItem.split && rowItem.splitMembers?.length > 0 && (
                        <div className="text-xs text-slate-500">
                          (每人 ${Math.round((rowItem.price / (rowItem.splitMembers.length + 1)) * 100) / 100})
                        </div>
                      )}
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
                        <td colSpan={7} className="px-3 py-3 bg-purple-50">
                          <div className="text-xs font-medium text-slate-700 mb-2">選擇平分成員：</div>
                          <div className="flex flex-wrap gap-2">
                            {members.filter(m => m.id !== selectedMember).map(m => (
                              <label key={m.id} className="flex items-center gap-1 px-2 py-1 bg-white rounded border cursor-pointer hover:bg-purple-100">
                                <Checkbox
                                  checked={rowItem.splitMembers?.includes(m.id)}
                                  onCheckedChange={() => toggleSplitMember(index, m.id)}
                                />
                                <span className="text-xs">{m.name}</span>
                              </label>
                            ))}
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
            {item ? '更新' : '送出'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}