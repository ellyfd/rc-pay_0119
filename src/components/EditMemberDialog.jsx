import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
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
    user_emails: []
  });
  const [selectedUserId, setSelectedUserId] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('email'),
    enabled: open
  });

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name || '',
        avatar_color: member.avatar_color || 'blue',
        user_emails: member.user_emails || []
      });
    }
  }, [member]);

  const handleAddUser = () => {
    if (!selectedUserId) return;
    const user = users.find(u => u.id === selectedUserId);
    if (!user) return;
    if (formData.user_emails.includes(user.email)) {
      alert('此帳號已綁定');
      return;
    }
    setFormData({ ...formData, user_emails: [...formData.user_emails, user.email] });
    setSelectedUserId('');
  };

  const handleRemoveEmail = (email) => {
    setFormData({
      ...formData,
      user_emails: formData.user_emails.filter(e => e !== email)
    });
  };

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
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="選擇系統帳號" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(user => !formData.user_emails.includes(user.email))
                    .map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name} ({user.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={handleAddUser} variant="outline" disabled={!selectedUserId}>
                新增
              </Button>
            </div>
            {formData.user_emails.length > 0 && (
              <div className="mt-2 space-y-1">
                {formData.user_emails.map((email, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded">
                    <span className="text-sm text-slate-700">{email}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEmail(email)}
                      className="h-6 text-red-500 hover:text-red-700"
                    >
                      移除
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">可綁定多個系統登入帳號</p>
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