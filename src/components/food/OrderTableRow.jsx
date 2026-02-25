import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";
import { formatTaiwanTime } from "@/components/utils/dateUtils";

// P3-3：提取表格行為獨立元件
export default function OrderTableRow({
  order,
  items,
  mealBoxes,
  sideDishProducts,
  currentUserRole,
  orderStatus,
  onEdit,
  onDelete
}) {
  const mealBox = items.find(item => {
    const product = mealBoxes.find(p => p.id === item.product_id);
    return product && product.category === 'meal_box';
  });

  const sideItems = items.filter(item => {
    const product = sideDishProducts.find(p => p.id === item.product_id);
    return product && product.category === 'side_dish';
  });

  return (
    <tr className="border-b hover:bg-slate-50">
      <td className="px-1.5 sm:px-3 py-2 sm:py-3">
        <div className="font-medium text-slate-800 leading-tight">{order.member_name}</div>
        <div className="text-[10px] sm:text-xs text-slate-500">
          {formatTaiwanTime(order.created_date, 'HH:mm')}
        </div>
      </td>
      <td className="px-1.5 sm:px-3 py-2 sm:py-3">
        {mealBox ? (
          <div className="text-slate-700 leading-tight">
            <div className="break-words">{mealBox.product_name}</div>
            <div className="text-[10px] sm:text-xs text-slate-500">${mealBox.price}</div>
          </div>
        ) : (
          <span className="text-slate-400">-</span>
        )}
      </td>
      <td className="px-1.5 sm:px-3 py-2 sm:py-3">
        {mealBox ? (
          <span className="text-slate-700 whitespace-nowrap">
            {mealBox.rice_option === 'less_rice' ? '飯少' : 
             mealBox.rice_option === 'rice_to_veg' ? '飯換菜' : '正常'}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        )}
      </td>
      <td className="px-1.5 sm:px-3 py-2 sm:py-3">
        {sideItems.length > 0 ? (
          <div className="space-y-0.5">
            {sideItems.map(item => (
              <div key={item.id} className="text-slate-700 leading-tight break-words">
                {item.product_name}
                <span className="text-[10px] sm:text-xs text-slate-500 ml-1">${item.price}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-slate-400">-</span>
        )}
      </td>
      <td className="px-1.5 sm:px-3 py-2 sm:py-3">
        <Badge className={`text-[10px] sm:text-xs ${
          order.payment_method === 'cash' ? 'bg-amber-500' : 
          order.payment_method === 'payer' ? 'bg-purple-500' :
          'bg-blue-500'
        }`}>
          {order.payment_method === 'cash' ? '現金' : 
           order.payment_method === 'payer' ? '支付人' :
           '餘額'}
        </Badge>
      </td>
      <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
        ${order.total_amount.toLocaleString()}
      </td>
      <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-center">
        {currentUserRole === 'admin' && orderStatus === 'pending' ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(order)}
              className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(order)}
              className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>
        ) : (
          <span className="text-slate-400">-</span>
        )}
      </td>
    </tr>
  );
}