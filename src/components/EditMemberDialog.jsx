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

const colors = [
  { name: "blue", bg: "bg-blue-500" },
  { name: "green", bg: "bg-emerald-500" },
  { name: "purple", bg: "bg-purple-500" },
  { name: "orange", bg: "bg-orange-500" },
  { name: "pink", bg: "bg-pink-500" },
  { name: "cyan", bg: "bg-cyan-500" },
];

export default function EditMemberDialog({ open, onOpenChange, member, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    avatar_color: 'blue',
    user_email: ''
  });

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name || '',
        avatar_color: member.avatar_color || 'blue',
        user_email: member.user_email || ''
      });
    }
  }, [member]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert('請輸入成員姓名！');
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯成員</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>成員姓名 *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="請輸入姓名"
            />
          </div>

          <div>
            <Label>關聯系統帳號（選填）</Label>
            <Input
              type="email"
              value={formData.user_email}
              onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
              placeholder="例：user@example.com"
            />
            <p className="text-xs text-slate-500 mt-1">填入系統登入的 email，可將該帳號與此成員綁定</p>
          </div>

          <div>
            <Label className="mb-2 block">頭像顏色</Label>
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setFormData({ ...formData, avatar_color: color.name })}
                  className={`w-10 h-10 rounded-full ${color.bg} ${
                    formData.avatar_color === color.name
                      ? 'ring-2 ring-slate-800 ring-offset-2'
                      : 'hover:ring-2 hover:ring-slate-400 hover:ring-offset-2'
                  } transition-all`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!formData.name.trim()}>
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}