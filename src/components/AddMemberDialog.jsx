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
  const [aliases, setAliases] = useState([]);
  const [newAlias, setNewAlias] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    await onAdd({ 
      name: name.trim(), 
      alias: aliases.length > 0 ? aliases : undefined,
      avatar_color: selectedColor, 
      balance: 0 
    });
    setLoading(false);
    setName('');
    setAliases([]);
    setNewAlias('');
    setSelectedColor('blue');
    onOpenChange(false);
  };

  const handleAddAlias = () => {
    if (!newAlias.trim()) return;
    if (aliases.includes(newAlias.trim())) {
      return;
    }
    setAliases([...aliases, newAlias.trim()]);
    setNewAlias('');
  };

  const handleRemoveAlias = (aliasToRemove) => {
    setAliases(aliases.filter(a => a !== aliasToRemove));
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
            <Label htmlFor="alias" className="text-slate-700">別名（選填）</Label>
            <div className="flex gap-2">
              <Input
                id="alias"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
                placeholder="輸入別名後按 Enter"
                className="h-12"
              />
              <Button type="button" onClick={handleAddAlias} variant="outline" className="h-12">
                新增
              </Button>
            </div>
            {aliases.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {aliases.map((alias, idx) => (
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