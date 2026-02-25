import React from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, X, Users } from "lucide-react";
import { toast } from "sonner";

// P3-2：提取編輯對話框為獨立元件
export default function EditMemberOrderDialog({
  showEditDialog,
  editingMember,
  editItems,
  members,
  memberMap,
  onClose,
  onSave,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onSplitItem
}) {
  if (!showEditDialog) return null;

  const handleSave = async () => {
    if (!editItems.every(item => item.member_id && item.item_name && item.price)) {
      toast.warning('請填寫完整資料！');
      return;
    }
    await onSave();
  };

  const handleUpdateEditItem = (index, field, value) => {
    const newItems = [...editItems];
    newItems[index][field] = value;
    
    if (field === 'member_id') {
      const member = memberMap.get(value);
      if (member) {
        newItems[index].member_name = member.name;
      }
    }
    
    onUpdateItem(newItems);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-slate-800">
            {editingMember ? '編輯成員訂單' : '新增成員訂單'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {editItems.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-semibold text-slate-700">成員：</label>
                <select
                  value={editItems[0].member_id}
                  onChange={(e) => {
                    const member = memberMap.get(e.target.value);
                    const updated = editItems.map(item => ({
                      ...item,
                      member_id: e.target.value,
                      member_name: member?.name || ''
                    }));
                    onUpdateItem(updated);
                  }}
                  className="px-3 py-1 border rounded text-sm flex-1"
                  disabled={editingMember}
                >
                  <option value="">選擇成員</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full min-w-[500px]">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">品項</th>
                  <th className="text-right px-3 py-2 text-sm font-semibold text-slate-700 w-24">金額</th>
                  <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-32">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {editItems.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Input
                        value={item.item_name}
                        onChange={(e) => handleUpdateEditItem(index, 'item_name', e.target.value)}
                        placeholder="飲料名稱"
                        className="text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleUpdateEditItem(index, 'price', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="text-sm text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onSplitItem(index)}
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="平分"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveItem(index)}
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-orange-50">
                  <td className="px-3 py-2 text-right font-semibold text-slate-700">總計</td>
                  <td className="px-3 py-2 text-right font-bold text-orange-600">
                    ${editItems.reduce((sum, item) => sum + (item.price || 0), 0)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <Button
              variant="outline"
              onClick={onAddItem}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              新增品項
            </Button>
            <Button
              onClick={handleSave}
              className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
            >
              儲存
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}