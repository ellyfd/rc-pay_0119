import React, { useState, useEffect } from 'react';
import { toast } from "sonner";
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
import { Trash2 } from "lucide-react";
import { getAvatarColorStyle } from "@/components/utils/colorMap";

export default function EditMemberDialog({ open, onOpenChange, member, onSave, onDelete }) {
  const [formData, setFormData] = useState({
    name: '',
    alias: [],
    avatar_color: 'blue',
    user_emails: []
  });
  const [newEmail, setNewEmail] = useState('');
  const [newAlias, setNewAlias] = useState('');

  useEffect(() => {
    if (member) {
      // 處理舊資料：如果 alias 是字串，轉換為陣列
      let aliasArray = [];
      if (member.alias) {
        if (Array.isArray(member.alias)) {
          aliasArray = member.alias;
        } else if (typeof member.alias === 'string' && member.alias.trim()) {
          aliasArray = [member.alias.trim()];
        }
      }
      
      setFormData({
        name: member.name || '',
        alias: aliasArray,
        avatar_color: member.avatar_color || 'blue',
        user_emails: member.user_emails || []
      });
    }
  }, [member]);

  const handleAddEmail = () => {
    if (!newEmail.trim()) return;
    if (!newEmail.includes('@')) {
      toast.error('請輸入有效的 email 格式');
      return;
    }
    if (formData.user_emails.includes(newEmail)) {
      toast.error('此 email 已存在');
      return;
    }
    setFormData({ ...formData, user_emails: [...formData.user_emails, newEmail] });
    setNewEmail('');
  };

  const handleRemoveEmail = (email) => {
    setFormData({
      ...formData,
      user_emails: formData.user_emails.filter(e => e !== email)
    });
  };

  const handleAddAlias = () => {
    if (!newAlias.trim()) return;
    if (formData.alias.includes(newAlias.trim())) {
      toast.error('此別名已存在');
      return;
    }
    setFormData({ ...formData, alias: [...formData.alias, newAlias.trim()] });
    setNewAlias('');
  };

  const handleRemoveAlias = (alias) => {
    setFormData({
      ...formData,
      alias: formData.alias.filter(a => a !== alias)
    });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('請輸入成員姓名');
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
            <Label>別名（選填）</Label>
            <div className="flex gap-2">
              <Input
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
                placeholder="輸入別名後按 Enter"
              />
              <Button type="button" onClick={handleAddAlias} variant="outline">
                新增
              </Button>
            </div>
            {formData.alias.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.alias.map((alias, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full text-sm">
                    <span>{alias}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAlias(alias)}
                      className="text-slate-500 hover:text-red-600 ml-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>關聯系統帳號（選填）</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                placeholder="例：user@example.com"
              />
              <Button type="button" onClick={handleAddEmail} variant="outline">
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
              {['blue', 'green', 'purple', 'orange', 'pink', 'cyan'].map((colorName) => (
                <button
                  key={colorName}
                  type="button"
                  onClick={() => setFormData({ ...formData, avatar_color: colorName })}
                  className={`w-10 h-10 rounded-full ${getAvatarColorStyle(colorName)} ${
                    formData.avatar_color === colorName
                      ? 'ring-2 ring-slate-800 ring-offset-2'
                      : 'hover:ring-2 hover:ring-slate-400 hover:ring-offset-2'
                  } transition-all`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 flex justify-start">
            {onDelete && (
              <Button
                variant="outline"
                onClick={() => onDelete(member)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                刪除成員
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim()}>
              儲存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}