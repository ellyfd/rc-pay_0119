import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getShortName } from "@/components/utils/nameUtils";

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
    <Dialog open={showEditDialog} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            {editingMember ? '編輯成員訂單' : '新增成員訂單'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {editItems.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-semibold text-slate-700">成員：</label>
                <Select
                  value={editItems[0].member_id}
                  onValueChange={(v) => {
                    const member = memberMap.get(v);
                    const updated = editItems.map(item => ({
                      ...item,
                      member_id: v,
                      member_name: member?.name || ''
                    }));
                    onUpdateItem(updated);
                  }}
                >
                  <SelectTrigger className="text-sm flex-1">
                    <SelectValue placeholder="選擇成員" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{getShortName(m.name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Desktop: Table */}
          <div className="hidden sm:block overflow-x-auto border rounded-lg">
            <table className="w-full">
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

          {/* Mobile: Card list */}
          <div className="sm:hidden space-y-2">
            {editItems.map((item, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">#{index + 1}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onSplitItem(index)}
                      className="h-8 w-8 text-blue-600"
                      title="平分"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveItem(index)}
                      className="h-8 w-8 text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={item.item_name}
                    onChange={(e) => handleUpdateEditItem(index, 'item_name', e.target.value)}
                    placeholder="飲料名稱"
                    className="text-sm flex-1"
                  />
                  <Input
                    type="number"
                    value={item.price}
                    onChange={(e) => handleUpdateEditItem(index, 'price', parseFloat(e.target.value) || 0)}
                    placeholder="$0"
                    className="text-sm text-right w-24"
                  />
                </div>
              </div>
            ))}
            <div className="bg-orange-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">總計</span>
              <span className="font-bold text-orange-600">
                ${editItems.reduce((sum, item) => sum + (item.price || 0), 0)}
              </span>
            </div>
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
      </DialogContent>
    </Dialog>
  );
}
