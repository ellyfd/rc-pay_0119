import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// P2-15: 統一折扣規則編輯元件
export default function DiscountRulesEditor({
  discountRules, setDiscountRules,
  discountRuleType, setDiscountRuleType,
  discountType, setDiscountType,
  fixedDiscountAllocation, setFixedDiscountAllocation,
  showTipExample, setShowTipExample
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-slate-800 text-sm border-b pb-2 mb-3">💰 團購優惠規則（選填）</h3>
        
        {/* Example Tips - Collapsible（僅在 Edit 時顯示）*/}
        {setShowTipExample && (
          <Collapsible open={showTipExample} onOpenChange={setShowTipExample} className="mb-3">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors">
                <ChevronDown className={`w-4 h-4 text-amber-700 transition-transform ${showTipExample ? 'rotate-180' : ''}`} />
                <span className="text-xs font-semibold text-amber-800">📌 設定折扣規則範例與分攤方式</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 border-t-0 space-y-2">
              <div>
                <p className="text-xs font-semibold text-amber-800 mb-1">折扣規則範例：</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  • 按數量：滿 10 件打 9 折、滿 20 件全團折 $500<br/>
                  • 按金額：滿 $5,000 打 9 折、滿 $10,000 全團折 $1,000
                </p>
              </div>
              <div className="border-t border-amber-300 pt-2">
                <p className="text-xs font-semibold text-amber-800 mb-1">固定金額折扣的分攤方式：</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  • 按比例：依各商品原價比例分配折扣<br/>
                  • 按項目：每個商品品項平均分攤折扣<br/>
                  • 按人數：每位參與者平均分攤折扣
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* 若無 Collapsible（Create 版），顯示靜態提示 */}
        {!setShowTipExample && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
            <p className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">設定折扣規則範例：</span><br/>
              • 按數量：滿 10 件打 9 折、滿 20 件全團折 $500<br/>
              • 按金額：滿 $5,000 打 9 折、滿 $10,000 全團折 $1,000
            </p>
          </div>
        )}
      </div>
      
      {/* Global Type Selectors */}
      <div className="flex gap-4 p-3 bg-slate-50 rounded-lg border flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">折扣類型：</Label>
          <Select value={discountRuleType} onValueChange={setDiscountRuleType}>
            <SelectTrigger className="h-9 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quantity">數量</SelectItem>
              <SelectItem value="amount">金額</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">優惠方式：</Label>
          <Select value={discountType} onValueChange={setDiscountType}>
            <SelectTrigger className="h-9 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">百分比</SelectItem>
              <SelectItem value="fixed">固定金額</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {discountType === 'fixed' && (
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">分攤方式：</Label>
            <Select value={fixedDiscountAllocation} onValueChange={setFixedDiscountAllocation}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proportional">按比例</SelectItem>
                <SelectItem value="per_item">按項目</SelectItem>
                <SelectItem value="per_member">按人數</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {discountRules.length > 0 && (
        <div className="border rounded-lg overflow-hidden mb-2">
          <table className="w-full">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700">
                  {discountRuleType === 'quantity' ? '達標數量' : '達標金額'}
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700">
                  {discountType === 'percent' ? '折扣百分比' : '折扣金額'}
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-700 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {discountRules.map((rule, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5">
                    {discountRuleType === 'amount' ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">$</span>
                        <Input
                          type="number"
                          min="1"
                          value={rule.min_amount || 0}
                          onChange={(e) => {
                            const newRules = [...discountRules];
                            newRules[index].min_amount = parseInt(e.target.value) || 0;
                            setDiscountRules(newRules);
                          }}
                          placeholder="1000"
                          className="h-8 text-sm"
                        />
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min="1"
                        value={rule.min_quantity || 0}
                        onChange={(e) => {
                          const newRules = [...discountRules];
                          newRules[index].min_quantity = parseInt(e.target.value) || 0;
                          setDiscountRules(newRules);
                        }}
                        placeholder="10"
                        className="h-8 text-sm"
                      />
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {discountType === 'fixed' ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">-$</span>
                        <Input
                          type="number"
                          min="0"
                          value={rule.discount_amount || 0}
                          onChange={(e) => {
                            const newRules = [...discountRules];
                            newRules[index].discount_amount = parseFloat(e.target.value) || 0;
                            setDiscountRules(newRules);
                          }}
                          placeholder="100"
                          className="h-8 text-sm"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={rule.discount_percent || 0}
                          onChange={(e) => {
                            const newRules = [...discountRules];
                            newRules[index].discount_percent = parseFloat(e.target.value) || 0;
                            setDiscountRules(newRules);
                          }}
                          placeholder="10"
                          className="h-8 text-sm"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDiscountRules(discountRules.filter((_, i) => i !== index))}
                      className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button
        type="button"
        onClick={() => {
          const newRule = {
            type: discountRuleType,
            discount_type: discountType
          };
          if (discountRuleType === 'quantity') {
            newRule.min_quantity = 0;
          } else {
            newRule.min_amount = 0;
          }
          if (discountType === 'percent') {
            newRule.discount_percent = 0;
          } else {
            newRule.discount_amount = 0;
          }
          setDiscountRules([...discountRules, newRule]);
        }}
        variant="outline"
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        新增折扣規則
      </Button>
    </div>
  );
}