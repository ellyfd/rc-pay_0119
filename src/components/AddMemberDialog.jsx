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

const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan'];
const colorMap = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
};

export default function AddMemberDialog({ open, onOpenChange, onAdd }) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    await onAdd({ name: name.trim(), avatar_color: selectedColor, balance: 0, is_internal: isInternal });
    setLoading(false);
    setName('');
    setSelectedColor('blue');
    setIsInternal(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">新增成員</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-700">姓名</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="輸入成員姓名"
              className="h-12"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-slate-700">選擇顏色</Label>
            <div className="flex gap-3 flex-wrap">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-10 h-10 rounded-full ${colorMap[color]} transition-all ${
                    selectedColor === color ? 'ring-4 ring-amber-400 scale-110' : 'opacity-60 hover:opacity-100'
                  }`}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">3F內部成員（可使用RC Pay）</span>
            </label>
          </div>
          
          <Button 
            type="submit" 
            className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-white font-medium"
            disabled={loading || !name.trim()}
          >
            {loading ? '新增中...' : '確認新增'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}