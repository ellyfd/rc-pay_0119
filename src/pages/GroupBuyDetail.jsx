import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Calendar, ExternalLink, CheckCircle, Edit, Trash2, X, Download, ZoomIn, Wallet, Copy, Users as UsersIcon } from "lucide-react";
import DiscountProgressBar from "@/components/groupbuy/DiscountProgressBar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import AddItemDialog from "@/components/groupbuy/AddItemDialog";
import EditGroupBuyDialog from "@/components/groupbuy/EditGroupBuyDialog";
import { exportGroupBuyOrderSummary, exportGroupBuyPaymentRecord } from "@/components/utils/ExportCSV";
import SelectMemberDialog from "@/components/SelectMemberDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function GroupBuyDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const groupBuyId = urlParams.get('id');
  
  // Debug: log URL info
  console.log('=== GroupBuyDetail Debug ===');
  console.log('Full URL:', window.location.href);
  console.log('Search params:', window.location.search);
  console.log('groupBuyId:', groupBuyId);
  console.log('All params:', Object.fromEntries(urlParams));
  
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [showEditGroupBuy, setShowEditGroupBuy] = useState(false);
  const [deletingGroupBuy, setDeletingGroupBuy] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showSelectMember, setShowSelectMember] = useState(false);
  const [userMember, setUserMember] = useState(null);
  const [actualCharges, setActualCharges] = useState({});
  const queryClient = useQueryClient();

  const { data: groupBuy, isLoading: groupBuyLoading } = useQuery({
    queryKey: ['groupBuy', groupBuyId],
    queryFn: async () => {
      const allGroupBuys = await base44.entities.GroupBuy.list();
      return allGroupBuys.find(gb => gb.id === groupBuyId);
    },
    enabled: !!groupBuyId
  });

  const { data: items = [] } = useQuery({
    queryKey: ['groupBuyItems', groupBuyId],
    queryFn: async () => {
      const allItems = await base44.entities.GroupBuyItem.list('-created_date');
      return allItems.filter(item => item.group_buy_id === groupBuyId);
    },
    enabled: !!groupBuyId
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const { data: products = [] } = useQuery({
    queryKey: ['groupBuyProducts', groupBuyId],
    queryFn: async () => {
      const allProducts = await base44.entities.GroupBuyProduct.list('-created_date');
      return allProducts.filter(p => p.group_buy_id === groupBuyId);
    },
    enabled: !!groupBuyId
  });

  const memberMap = useMemo(() => 
    new Map(members.map(m => [m.id, m])),
    [members]
  );

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(console.error);
  }, []);

  useEffect(() => {
    if (currentUser && members.length > 0) {
      const linkedMember = members.find(m => 
        m.user_emails && m.user_emails.includes(currentUser.email)
      );
      setUserMember(linkedMember);
      if (!linkedMember) {
        setShowSelectMember(true);
      }
    }
  }, [currentUser, members]);

  const updateGroupBuy = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GroupBuy.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuy'] });
      queryClient.invalidateQueries({ queryKey: ['groupBuys'] });
    }
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GroupBuyItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuyItems'] });
    },
    onError: (error) => {
      toast.error('更新失敗：' + error.message);
    }
  });

  const createItem = useMutation({
    mutationFn: (data) => base44.entities.GroupBuyItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuyItems'] });
      toast.success('已成功加入團購！');
    },
    onError: (error) => {
      toast.error('加入團購失敗：' + error.message);
    }
  });



  const deleteItem = useMutation({
    mutationFn: (id) => base44.entities.GroupBuyItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuyItems'] });
      toast.success('已刪除訂單！');
    },
    onError: (error) => {
      toast.error('刪除失敗：' + error.message);
    }
  });

  const deleteGroupBuy = useMutation({
    mutationFn: (id) => base44.entities.GroupBuy.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuys'] });
      toast.success('團購已刪除！');
      window.location.href = createPageUrl('GroupBuy');
    },
    onError: (error) => {
      toast.error('刪除團購失敗：' + error.message);
    }
  });

  const createTransaction = useMutation({
    mutationFn: async (data) => base44.entities.Transaction.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const createTemplate = useMutation({
    mutationFn: (data) => base44.entities.GroupBuyTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuyTemplates'] });
      toast.success('範本已成功儲存！');
    },
    onError: (error) => {
      toast.error('儲存範本失敗：' + error.message);
    }
  });

  const handleSelectMember = async (memberId) => {
    const member = memberMap.get(memberId);
    if (!member || !currentUser) return;

    const updatedEmails = member.user_emails || [];
    if (!updatedEmails.includes(currentUser.email)) {
      updatedEmails.push(currentUser.email);
    }

    await updateMember.mutateAsync({
      id: memberId,
      data: { user_emails: updatedEmails }
    });

    setUserMember(member);
    setShowSelectMember(false);
  };

  const handleAddItem = async (itemData) => {
    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, data: itemData });
      setShowAddItem(false);
      setEditingItem(null);
    } else {
      // Single item is passed from the dialog
      await createItem.mutateAsync({
        ...itemData,
        group_buy_id: groupBuyId
      });
    }
  };

  const handleDeleteItem = async () => {
    if (deletingItem) {
      // Check if this item is part of a split order
      const isSplitItem = deletingItem.note && deletingItem.note.includes('平分');
      
      if (isSplitItem) {
        // Find all items with the same product name and split note pattern
        const relatedItems = items.filter(item => 
          item.product_name === deletingItem.product_name &&
          item.note && 
          item.note.includes('平分') &&
          item.note.includes(deletingItem.note.split('訂購')[0] + '訂購')
        );
        
        // Delete all related split items
        for (const item of relatedItems) {
          await deleteItem.mutateAsync(item.id);
        }
      } else {
        // Normal delete
        await deleteItem.mutateAsync(deletingItem.id);
      }
      
      setDeletingItem(null);
    }
  };

  const handleEditGroupBuy = async (data) => {
    await updateGroupBuy.mutateAsync({
      id: groupBuyId,
      data
    });
    setShowEditGroupBuy(false);
  };

  const handleDeleteGroupBuy = async () => {
    // Delete all items first
    for (const item of items) {
      await deleteItem.mutateAsync(item.id);
    }
    // Then delete the group buy
    await deleteGroupBuy.mutateAsync(groupBuyId);
  };

  const handleSaveAsTemplate = async () => {
    const templateName = prompt('請輸入範本名稱：', `${groupBuy.title} 範本`);
    if (!templateName) return;

    await createTemplate.mutateAsync({
      template_name: templateName,
      title: groupBuy.title,
      description: groupBuy.description,
      product_link: groupBuy.product_link,
      image_url: groupBuy.image_url,
      discount_rules: groupBuy.discount_rules,
      products: products.map(p => ({
        product_name: p.product_name,
        price: p.price,
        description: p.description
      }))
    });
  };

  const handleCloseGroupBuy = async () => {
    if (!confirm('確定要截止這個團購嗎？截止後成員將無法再新增項目。')) return;
    try {
      await updateGroupBuy.mutateAsync({
        id: groupBuyId,
        data: { status: 'closed', is_fully_paid: false }
      });
      toast.success('團購已截止，可以開始統計訂單並收款！');
    } catch (error) {
      toast.error('截止團購失敗：' + error.message);
    }
  };

  // Calculate total quantity across all items in the group buy (only count orderers, not split members)
  const getTotalQuantity = useMemo(() => {
    return items.reduce((sum, item) => {
      // If it's a split item and this member is not the orderer, don't count it
      const isSplitItem = item.note && item.note.includes('平分');
      if (isSplitItem && !item.note.includes(`${item.member_name}訂購`)) {
        return sum;
      }
      return sum + item.quantity;
    }, 0);
  }, [items]);

  // Calculate total amount across all items
  const getTotalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const isSplitItem = item.note && item.note.includes('平分');
      if (isSplitItem && !item.note.includes(`${item.member_name}訂購`)) {
        return sum;
      }
      return sum + (item.price * item.quantity);
    }, 0);
  }, [items]);

  // Calculate applicable discount based on total group buy quantity or amount
  const getApplicableDiscount = useMemo(() => {
    if (!groupBuy?.discount_rules || groupBuy.discount_rules.length === 0) {
      return null;
    }

    // Separate rules by type
    const quantityRules = groupBuy.discount_rules.filter(r => r.type === 'quantity');
    const amountRules = groupBuy.discount_rules.filter(r => r.type === 'amount');

    let bestRule = null;

    // Check quantity rules
    if (quantityRules.length > 0) {
      const sortedRules = [...quantityRules].sort((a, b) => b.min_quantity - a.min_quantity);
      const applicable = sortedRules.find(rule => getTotalQuantity >= rule.min_quantity);
      if (applicable) bestRule = applicable;
    }

    // Check amount rules
    if (amountRules.length > 0) {
      const sortedRules = [...amountRules].sort((a, b) => b.min_amount - a.min_amount);
      const applicable = sortedRules.find(rule => getTotalAmount >= rule.min_amount);
      if (applicable) {
        // If both types have applicable rules, choose the better discount
        if (bestRule) {
          const bestDiscount = bestRule.discount_type === 'percent' ? bestRule.discount_percent : bestRule.discount_amount;
          const thisDiscount = applicable.discount_type === 'percent' ? applicable.discount_percent : applicable.discount_amount;
          // For simplicity, prefer percentage discounts or higher values
          if (applicable.discount_type === 'percent' && bestRule.discount_type === 'percent') {
            if (thisDiscount > bestDiscount) bestRule = applicable;
          } else if (applicable.discount_type === bestRule.discount_type) {
            if (thisDiscount > bestDiscount) bestRule = applicable;
          }
        } else {
          bestRule = applicable;
        }
      }
    }

    return bestRule;
  }, [groupBuy?.discount_rules, getTotalQuantity, getTotalAmount]);

  // Calculate total discount amount for the entire group buy
  const getTotalDiscountAmount = useMemo(() => {
    if (!getApplicableDiscount) return 0;

    const totalBeforeDiscount = items.reduce((sum, item) => {
      const isSplitItem = item.note && item.note.includes('平分');
      if (isSplitItem && !item.note.includes(`${item.member_name}訂購`)) {
        return sum;
      }
      return sum + (item.price * item.quantity);
    }, 0);

    if (getApplicableDiscount.discount_type === 'percent') {
      return totalBeforeDiscount * (getApplicableDiscount.discount_percent / 100);
    } else {
      return getApplicableDiscount.discount_amount;
    }
  }, [getApplicableDiscount, items]);

  // Calculate discounted price per item based on allocation method
  const getDiscountedPrice = useMemo(() => (originalPrice, memberId = null) => {
    if (!getApplicableDiscount || getTotalDiscountAmount === 0) {
      return originalPrice;
    }

    const totalBeforeDiscount = items.reduce((sum, item) => {
      const isSplitItem = item.note && item.note.includes('平分');
      if (isSplitItem && !item.note.includes(`${item.member_name}訂購`)) {
        return sum;
      }
      return sum + (item.price * item.quantity);
    }, 0);

    if (totalBeforeDiscount === 0) return originalPrice;

    // For percentage discounts, always use proportional
    if (getApplicableDiscount.discount_type === 'percent') {
      const discountRatio = getTotalDiscountAmount / totalBeforeDiscount;
      const discountedPrice = originalPrice * (1 - discountRatio);
      return Math.round(discountedPrice * 100) / 100;
    }

    // For fixed amount discounts, use the specified allocation method
    const allocationMethod = groupBuy?.fixed_discount_allocation || 'proportional';
    
    if (allocationMethod === 'proportional') {
      // 按比例分攤：依各商品原價比例分配折扣
      const discountRatio = getTotalDiscountAmount / totalBeforeDiscount;
      const discountedPrice = originalPrice * (1 - discountRatio);
      return Math.round(discountedPrice * 100) / 100;
    } else if (allocationMethod === 'per_item') {
      // 按項目分攤：每個商品品項平均分攤折扣
      const totalItemCount = items.reduce((sum, item) => {
        const isSplitItem = item.note && item.note.includes('平分');
        if (isSplitItem && !item.note.includes(`${item.member_name}訂購`)) {
          return sum;
        }
        return sum + item.quantity;
      }, 0);
      
      if (totalItemCount === 0) return originalPrice;
      
      const discountPerItem = getTotalDiscountAmount / totalItemCount;
      const discountedPrice = originalPrice - discountPerItem;
      return Math.round(Math.max(0, discountedPrice) * 100) / 100;
    } else if (allocationMethod === 'per_member') {
      // 按人頭數分攤：每位參與者平均分攤折扣
      const uniqueMembers = new Set(items.map(item => item.member_id));
      const memberCount = uniqueMembers.size;
      
      if (memberCount === 0) return originalPrice;
      
      const discountPerMember = getTotalDiscountAmount / memberCount;
      
      // Calculate this member's total before discount
      const memberItems = items.filter(item => item.member_id === memberId);
      const memberTotalBeforeDiscount = memberItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);
      
      if (memberTotalBeforeDiscount === 0) return originalPrice;
      
      // Distribute member's share of discount proportionally among their items
      const memberDiscountRatio = discountPerMember / memberTotalBeforeDiscount;
      const discountedPrice = originalPrice * (1 - memberDiscountRatio);
      return Math.round(Math.max(0, discountedPrice) * 100) / 100;
    }

    return originalPrice;
  }, [getApplicableDiscount, getTotalDiscountAmount, items, groupBuy?.fixed_discount_allocation]);

  const handleMarkAsFullyPaid = async () => {
    if (!allPaid) {
      toast.warning('還有未付款的項目，無法標記為已完成！');
      return;
    }

    if (!confirm('確定所有款項都已結清嗎？')) return;

    try {
      await updateGroupBuy.mutateAsync({
        id: groupBuyId,
        data: { is_fully_paid: true }
      });
      toast.success('團購已標記為完成！所有款項已結清。');
    } catch (error) {
      toast.error('標記失敗：' + error.message);
    }
  };

  const handleTogglePaid = async (summary) => {
    // Check if all items have payment method selected
    const allHavePaymentMethod = summary.items.every(item => item.payment_method);
    if (!allHavePaymentMethod) {
      toast.warning('請先為所有項目選擇支付方式！');
      return;
    }
    
    const newPaidStatus = !summary.paid;
    
    // If marking as paid and using RC Pay, check balance (but don't deduct)
    if (newPaidStatus && summary.hasRcPay) {
      const member = memberMap.get(summary.member_id);
      if (member && member.balance < summary.total) {
        toast.warning(`提醒：${summary.member_name} 的錢包餘額不足（餘額：$${member.balance}，需支付：$${summary.total}）`);
      }
    }
    
    // Update all items for this member
    try {
      for (const item of summary.items) {
        await updateItem.mutateAsync({
          id: item.id,
          data: { paid: newPaidStatus }
        });
      }
      toast.success(newPaidStatus ? '已標記為已付款' : '已標記為未付款');
    } catch (error) {
      toast.error('更新付款狀態失敗：' + error.message);
    }
  };

  // Check if all items are paid
  const allPaid = items.length > 0 && items.every(item => item.paid);

  // Check if discount creates decimals
  const hasDiscountDecimals = useMemo(() => {
    if (!groupBuy?.discount_rules || groupBuy.discount_rules.length === 0) return false;
    if (!getApplicableDiscount) return false;
    
    return items.some(item => {
      const discountedPrice = getDiscountedPrice(item.price, item.member_id);
      const itemTotal = discountedPrice * item.quantity;
      return itemTotal % 1 !== 0;
    });
  }, [groupBuy?.discount_rules, getApplicableDiscount, items, getDiscountedPrice]);

  // Group items by member
  const memberSummary = useMemo(() => 
    items.reduce((acc, item) => {
      const existing = acc.find(m => m.member_id === item.member_id);
      const discountedPrice = getDiscountedPrice(item.price, item.member_id);
      const itemTotal = discountedPrice * item.quantity;
      if (existing) {
        existing.items.push(item);
        existing.total += itemTotal;
        existing.paid = existing.paid && item.paid;
        // Check if any item uses RC Pay
        if (item.payment_method === 'rcpay') {
          existing.hasRcPay = true;
        }
      } else {
        acc.push({
          member_id: item.member_id,
          member_name: item.member_name,
          items: [item],
          total: itemTotal,
          paid: item.paid || false,
          hasRcPay: item.payment_method === 'rcpay'
        });
      }
      return acc;
    }, []),
    [items, getDiscountedPrice]
  );

  // Group items by product for order summary
  const productSummary = useMemo(() => 
    items.reduce((acc, item) => {
      // For split items, extract original price from note
      const isSplitItem = item.note && item.note.includes('平分');
      let actualPrice = item.price;

      if (isSplitItem) {
        // Find the orderer's name from note (format: "XXX訂購，和YYY、ZZZ平分")
        const noteMatch = item.note.match(/(.+?)訂購，和(.+)平分/);
        if (noteMatch) {
          const otherMemberNames = noteMatch[2].split('、');
          const splitCount = otherMemberNames.length + 1; // +1 for the orderer
          actualPrice = item.price * splitCount; // Restore original total price
        }
      }

      const key = `${item.product_name}_${actualPrice}`;
      const existing = acc.find(p => p.key === key);

      if (existing) {
        // For split items, only count once (use orderer's entry)
        if (!isSplitItem || item.note.includes(`${item.member_name}訂購`)) {
          existing.quantity += item.quantity;
          existing.members.push({ name: item.member_name, quantity: item.quantity, note: item.note });
        }
      } else {
        // Only create entry if not split, or if this is the orderer
        if (!isSplitItem || item.note.includes(`${item.member_name}訂購`)) {
          acc.push({
            key,
            product_name: item.product_name,
            price: actualPrice,
            quantity: item.quantity,
            members: [{ name: item.member_name, quantity: item.quantity, note: item.note }]
          });
        }
      }
      return acc;
    }, []),
    [items]
  );

  // Show loading state
  if (!currentUser || groupBuyLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
          <p className="text-xs text-slate-400 mt-2">ID: {groupBuyId}</p>
          <p className="text-xs text-slate-400">User: {currentUser ? '已登入' : '未登入'}</p>
          <p className="text-xs text-slate-400">Loading: {groupBuyLoading ? '是' : '否'}</p>
          <p className="text-xs text-slate-400">GroupBuy: {groupBuy ? '已載入' : '未載入'}</p>
        </div>
      </div>
    );
  }

  // Check if ID exists
  if (!groupBuyId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-slate-500">找不到團購 ID</p>
          <Link to={createPageUrl('GroupBuy')}>
            <Button className="mt-4">返回團購列表</Button>
          </Link>
        </Card>
      </div>
    );
  }

  // Check if group buy exists
  if (!groupBuy) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-slate-500">找不到此團購 (ID: {groupBuyId})</p>
          <Link to={createPageUrl('GroupBuy')}>
            <Button className="mt-4">返回團購列表</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isOrganizer = currentUser && (groupBuy.created_by === currentUser.email || currentUser.role === 'admin');
  const isOpen = groupBuy.status === 'open';
  const isClosed = groupBuy.status === 'closed';
  const isFullyPaid = groupBuy.is_fully_paid === true;
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <div className="bg-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link to={createPageUrl('GroupBuy')}>
            <Button variant="ghost" className="text-white hover:bg-purple-500 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回團購列表
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Group Buy Info */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              {groupBuy.image_url && (
                <div 
                  className="relative bg-slate-100 rounded-lg overflow-hidden mb-4 cursor-pointer group h-48"
                  onClick={() => setShowImageModal(true)}
                >
                  <img
                    src={groupBuy.image_url}
                    alt={groupBuy.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                    <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h1 className="text-xl font-bold text-slate-800">{groupBuy.title}</h1>
                    <Badge className={
                      isOpen ? 'bg-green-500' :
                      isClosed && !isFullyPaid ? 'bg-amber-500' :
                      'bg-blue-500'
                    }>
                      {isOpen ? '進行中' :
                       isClosed && !isFullyPaid ? '已下單 (待收款)' :
                       '已完成'}
                    </Badge>
                  </div>
                  {groupBuy.description && (
                    <p className="text-sm text-slate-600">{groupBuy.description}</p>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-500">開團者：</span>
                    <Link 
                      to={createPageUrl('MemberDetail') + '?id=' + groupBuy.organizer_id}
                      className="font-medium text-purple-600 hover:text-purple-700 hover:underline"
                    >
                      {groupBuy.organizer_name}
                    </Link>
                  </div>
                  {groupBuy.deadline && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">
                        截止：{format(new Date(groupBuy.deadline), 'yyyy/MM/dd')}
                      </span>
                    </div>
                  )}
                  {groupBuy.product_link && (
                    <a
                      href={groupBuy.product_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-purple-600 hover:text-purple-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>查看商品連結</span>
                    </a>
                  )}
                  {groupBuy.discount_rules && groupBuy.discount_rules.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                      <p className="text-xs font-semibold text-amber-800 mb-1">📊 折扣規則</p>
                      {groupBuy.discount_rules
                        .sort((a, b) => {
                          if (a.type === 'quantity' && b.type === 'quantity') {
                            return a.min_quantity - b.min_quantity;
                          } else if (a.type === 'amount' && b.type === 'amount') {
                            return a.min_amount - b.min_amount;
                          }
                          return a.type === 'quantity' ? -1 : 1;
                        })
                        .map((rule, idx) => (
                          <p key={idx} className="text-xs text-amber-700">
                            • {rule.type === 'quantity' ? `滿 ${rule.min_quantity} 件` : `滿 $${rule.min_amount}`}：
                            {rule.discount_type === 'percent' ? `${rule.discount_percent}% off` : `-$${rule.discount_amount}`}
                          </p>
                        ))}

                    </div>
                  )}
                </div>

                {/* Discount Progress Bar */}
                {groupBuy.discount_rules && groupBuy.discount_rules.length > 0 && (
                  <div className="border-t pt-4">
                    <DiscountProgressBar 
                      discountRules={groupBuy.discount_rules}
                      currentQuantity={getTotalQuantity}
                      currentAmount={getTotalAmount}
                    />
                  </div>
                )}

                <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600">參與人數</span>
                  <span className="text-lg font-bold text-purple-600">{memberSummary.length} 人</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600">總金額</span>
                  <span className="text-2xl font-bold text-slate-800">${totalAmount.toLocaleString()}</span>
                </div>
                {isOrganizer && isClosed && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">已付款</span>
                    <span className={`font-semibold ${allPaid ? 'text-green-600' : 'text-amber-600'}`}>
                      {memberSummary.filter(m => m.paid).length} / {memberSummary.length}
                    </span>
                  </div>
                )}
                </div>

                {isOrganizer && (
                  <div className="space-y-2 border-t pt-4">
                    {!isFullyPaid && (
                      <Button
                        onClick={() => setShowEditGroupBuy(true)}
                        variant="outline"
                        className="w-full"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        編輯團購
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveAsTemplate}
                      variant="outline"
                      className="w-full text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      另存為範本
                    </Button>
                    <Button
                      onClick={() => setDeletingGroupBuy(true)}
                      variant="outline"
                      className="w-full text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      刪除團購
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right: Items List */}
          <div className="lg:col-span-2 space-y-6">
            {isClosed && productSummary.length > 0 && (
              <Card>
                <div className="p-4 bg-green-50 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-green-800 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    訂購彙總表（按產品統計）
                  </h3>
                  {isOrganizer && (
                    <Button
                      onClick={() => exportGroupBuyOrderSummary(
                        productSummary, 
                        groupBuy.title, 
                        groupBuy.discount_rules,
                        getDiscountedPrice,
                        getApplicableDiscount
                      )}
                      size="sm"
                      variant="outline"
                      className="bg-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      匯出訂購表
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-slate-700">產品名稱</th>
                        <th className="text-right px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap">{groupBuy.discount_rules?.length > 0 ? '原價' : '單價'}</th>
                        {groupBuy.discount_rules?.length > 0 && (
                          <th className="text-right px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-slate-700">
                            <div className="whitespace-nowrap">折扣價</div>
                            {getApplicableDiscount && (
                              <div className="text-[10px] sm:text-xs text-green-600 font-normal mt-0.5">
                                ({getApplicableDiscount.discount_percent}% off)
                              </div>
                            )}
                          </th>
                        )}
                        <th className="text-center px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap">總數量</th>
                        <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-slate-700">訂購明細</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {productSummary.map((product) => {
                        const discountedPrice = getDiscountedPrice(product.price);
                        const hasDiscount = discountedPrice !== product.price;
                        return (
                          <tr key={product.key} className="hover:bg-slate-50">
                            <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-slate-800 text-xs sm:text-sm">{product.product_name}</td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-slate-700 text-xs sm:text-sm whitespace-nowrap">${product.price.toLocaleString()}</td>
                            {groupBuy.discount_rules?.length > 0 && (
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium text-xs sm:text-sm whitespace-nowrap">
                                <span className={hasDiscount ? 'text-amber-600 font-semibold' : 'text-slate-700'}>
                                  ${discountedPrice.toLocaleString()}
                                </span>
                              </td>
                            )}
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                              <span className="inline-block bg-purple-100 text-purple-800 font-semibold px-2 sm:px-3 py-1 rounded text-xs sm:text-sm">
                                {product.quantity}
                              </span>
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3">
                              <div className="text-xs sm:text-sm space-y-0.5 sm:space-y-1">
                                {product.members.map((member, idx) => (
                                  <div key={idx} className="text-slate-600">
                                    • {member.name} × {member.quantity}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800">團購項目（按成員）</h2>
              <div className="flex gap-2">
                {isOrganizer && isClosed && memberSummary.length > 0 && (
                  <Button
                    onClick={() => exportGroupBuyPaymentRecord(
                      memberSummary, 
                      groupBuy.title,
                      groupBuy.discount_rules,
                      getDiscountedPrice
                    )}
                    variant="outline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    匯出收款紀錄
                  </Button>
                )}
                {isOpen && (
                  <Button
                    onClick={() => {
                      setEditingItem(null);
                      setShowAddItem(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    新增訂單
                  </Button>
                )}
              </div>
            </div>

            {memberSummary.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <p className="text-slate-500 text-lg mb-2">還沒有人跟團</p>
                {isOpen && <p className="text-slate-400 text-sm">點擊「新增項目」開始跟團！</p>}
              </Card>
            ) : (
              <Card>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                   <table className="w-full min-w-[800px]">
                    <thead className="bg-slate-50 border-b sticky top-0">
                       <tr>
                         <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">成員</th>
                         <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">產品</th>
                         <th className="text-center px-2 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">數量</th>
                         <th className="text-right px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">{groupBuy.discount_rules?.length > 0 ? '原價' : '單價'}</th>
                         {groupBuy.discount_rules?.length > 0 && (
                           <th className="text-right px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">折扣價</th>
                         )}
                         <th className="text-right px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">小計</th>
                         <th className="text-right px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">個人加總</th>
                         {hasDiscountDecimals && isOrganizer && isClosed && (
                           <th className="text-right px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">實際支付</th>
                         )}
                         {isOrganizer && isClosed && !isFullyPaid && (
                           <th className="text-center px-2 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">支付</th>
                         )}
                         {isOrganizer && isClosed && !isFullyPaid && (
                           <th className="text-center px-2 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">收款</th>
                         )}
                         {((isOrganizer || items.some(i => i.created_by === currentUser?.email)) && isOpen) && (
                           <th className="text-center px-2 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">操作</th>
                         )}
                       </tr>
                     </thead>
                    <tbody className="divide-y">
                      {memberSummary.map((summary, summaryIdx) => (
                        summary.items.map((item, itemIdx) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            {itemIdx === 0 && (
                              <>
                                <td 
                                      className="px-3 py-2 font-medium align-top text-xs whitespace-nowrap"
                                      rowSpan={summary.items.length}
                                    >
                                      <Link
                                        to={createPageUrl('MemberDetail') + '?id=' + summary.member_id}
                                        className="text-purple-600 hover:text-purple-700 hover:underline"
                                      >
                                        {summary.member_name}
                                      </Link>
                                    </td>
                              </>
                            )}
                            <td className="px-3 py-2 text-xs">
                              <div className="text-slate-700">{item.product_name}</div>
                              {item.note && item.note.includes('平分') && (
                                <div className="text-[10px] text-slate-500 mt-0.5">{item.note}</div>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center text-slate-700 text-xs whitespace-nowrap">
                              {(() => {
                                const isSplitItem = item.note && item.note.includes('平分');
                                const isOrderer = item.note && item.note.includes(`${item.member_name}訂購`);
                                if (isSplitItem && !isOrderer) {
                                  return '-';
                                }
                                return item.quantity;
                              })()}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-700 text-xs whitespace-nowrap">${item.price.toLocaleString()}</td>
                            {groupBuy.discount_rules?.length > 0 && (
                              <td className="px-3 py-2 text-right font-medium text-slate-700 text-xs whitespace-nowrap">
                                {(() => {
                                  const discountedPrice = getDiscountedPrice(item.price, item.member_id);
                                  const hasDiscount = discountedPrice !== item.price;
                                  return (
                                    <span className={hasDiscount ? 'text-amber-600 font-semibold' : ''}>
                                      ${discountedPrice.toLocaleString()}
                                    </span>
                                  );
                                })()}
                              </td>
                            )}
                            <td className="px-3 py-2 text-right font-medium text-slate-800 text-xs whitespace-nowrap">
                              {(() => {
                                const discountedPrice = groupBuy.discount_rules?.length > 0 ? getDiscountedPrice(item.price, item.member_id) : item.price;
                                return `$${(discountedPrice * item.quantity).toLocaleString()}`;
                              })()}
                            </td>
                            {itemIdx === 0 ? (
                              <td 
                                className="px-2 sm:px-3 py-2 text-right align-top"
                                rowSpan={summary.items.length}
                              >
                                <span className="text-base sm:text-lg font-bold text-purple-600">
                                  ${summary.total.toLocaleString()}
                                </span>
                              </td>
                            ) : null}
                            {itemIdx === 0 && hasDiscountDecimals && isOrganizer && isClosed && (
                              <td 
                                className="px-2 sm:px-3 py-2 text-right align-top"
                                rowSpan={summary.items.length}
                              >
                                <input
                                  type="number"
                                  value={actualCharges[summary.member_id] ?? Math.round(summary.total)}
                                  onChange={(e) => {
                                    const newCharges = { ...actualCharges, [summary.member_id]: parseFloat(e.target.value) || 0 };
                                    setActualCharges(newCharges);
                                  }}
                                  className="w-16 sm:w-20 px-1 sm:px-2 py-1 text-xs sm:text-sm text-right font-bold text-orange-600 border border-orange-300 rounded focus:border-orange-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  disabled={isFullyPaid}
                                />
                              </td>
                            )}
                            {itemIdx === 0 && isOrganizer && isClosed && !isFullyPaid && (
                              <td className="px-1 sm:px-2 py-2 text-center align-top" rowSpan={summary.items.length}>
                                <select
                                  value={item.payment_method || ''}
                                  onChange={(e) => {
                                    // Update all items for this member
                                    summary.items.forEach(memberItem => {
                                      updateItem.mutate({
                                        id: memberItem.id,
                                        data: { payment_method: e.target.value }
                                      });
                                    });
                                  }}
                                  className="text-[10px] sm:text-xs px-1 sm:px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 w-full max-w-[80px]"
                                >
                                  <option value="">請選擇</option>
                                  {(() => {
                                    const member = memberMap.get(item.member_id);
                                    return member && member.balance > 0 ? (
                                      <option value="rcpay">RC Pay</option>
                                    ) : null;
                                  })()}
                                  <option value="linepay">Line Pay</option>
                                  <option value="ipasspay">iPASS Pay</option>
                                  <option value="cash">現金</option>
                                </select>
                              </td>
                            )}
                            {itemIdx === 0 && isOrganizer && isClosed && !isFullyPaid && (
                              <td 
                                className="px-1 sm:px-2 py-2 align-top"
                                rowSpan={summary.items.length}
                              >
                                <div className="flex items-center justify-center">
                                  <button
                                    onClick={() => handleTogglePaid(summary)}
                                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                      summary.paid 
                                        ? 'bg-green-600 border-green-600' 
                                        : 'border-slate-300 hover:border-slate-400'
                                    }`}
                                  >
                                    {summary.paid && <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />}
                                  </button>
                                </div>
                              </td>
                            )}
                            {((isOrganizer || (currentUser && item.created_by === currentUser.email)) && isOpen) && (
                              <td className="px-1 sm:px-2 py-2">
                                {(() => {
                                  const isSplitItem = item.note && item.note.includes('平分');
                                  const isOrderer = item.note && item.note.includes(`${item.member_name}訂購`);
                                  const canEdit = !isSplitItem || isOrderer;

                                  return canEdit ? (
                                    <div className="flex gap-0.5 sm:gap-1 justify-center">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setEditingItem(item);
                                          setShowAddItem(true);
                                        }}
                                        className="h-6 w-6 sm:h-8 sm:w-8"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDeletingItem(item)}
                                        className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 hover:text-red-700"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="text-center text-[10px] sm:text-xs text-slate-400">-</div>
                                  );
                                })()}
                              </td>
                            )}
                          </tr>
                        ))
                      ))}
                      <tr className="bg-slate-50 font-semibold">
                        <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-right text-slate-700 text-xs sm:text-sm">總計</td>
                        <td className="px-1 sm:px-2 py-2 sm:py-3 text-center text-slate-800 text-xs sm:text-sm">
                          {items.reduce((sum, item) => {
                            const isSplitItem = item.note && item.note.includes('平分');
                            const isOrderer = item.note && item.note.includes(`${item.member_name}訂購`);
                            if (isSplitItem && !isOrderer) return sum;
                            return sum + item.quantity;
                          }, 0)}
                        </td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-right text-slate-800 text-xs sm:text-sm whitespace-nowrap">
                          ${items.reduce((sum, item) => {
                            const isSplitItem = item.note && item.note.includes('平分');
                            const isOrderer = item.note && item.note.includes(`${item.member_name}訂購`);
                            if (isSplitItem && !isOrderer) return sum;
                            return sum + (item.price * item.quantity);
                          }, 0).toLocaleString()}
                        </td>
                        {groupBuy.discount_rules?.length > 0 && (
                          <td className="px-2 sm:px-3 py-2 sm:py-3 text-right text-orange-600 text-xs sm:text-sm whitespace-nowrap">
                            {getTotalDiscountAmount > 0 && (
                              <span className="font-bold">
                                -${Math.round(getTotalDiscountAmount).toLocaleString()}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-right font-medium text-slate-800 text-xs sm:text-sm whitespace-nowrap"></td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-right text-base sm:text-lg text-purple-600 whitespace-nowrap">
                          ${memberSummary.reduce((sum, m) => sum + m.total, 0).toLocaleString()}
                        </td>
                        {hasDiscountDecimals && isOrganizer && isClosed && (
                          <td className="px-2 sm:px-3 py-2 sm:py-3 text-right text-base sm:text-lg text-orange-600 whitespace-nowrap">
                            ${memberSummary.reduce((sum, m) => {
                              const actualCharge = actualCharges[m.member_id] ?? Math.round(m.total);
                              return sum + actualCharge;
                            }, 0).toLocaleString()}
                          </td>
                        )}
                        {isOrganizer && isClosed && !isFullyPaid && (
                          <td></td>
                        )}
                        {((isOrganizer || items.some(i => i.created_by === currentUser?.email)) && isOpen) && (
                          <td></td>
                        )}
                      </tr>
                      {groupBuy.discount_rules?.length > 0 && groupBuy.discount_rules.some(r => r.discount_type === 'fixed') && (
                        <tr className="bg-slate-50 border-none">
                          <td colSpan={4}></td>
                          {groupBuy.discount_rules?.length > 0 && (
                            <td className="px-2 sm:px-3 py-0 -mt-2.5 text-right text-red-500 text-[10px] sm:text-xs whitespace-nowrap">
                              ({groupBuy.fixed_discount_allocation === 'proportional' ? '按比例分攤' : 
                                groupBuy.fixed_discount_allocation === 'per_item' ? '按項目分攤' : '按人數分攤'})
                            </td>
                          )}
                          <td colSpan={10}></td>
                        </tr>
                      )}
                    </tbody>
                    </table>
                    </div>
                    </Card>
                    )}

                    {isOrganizer && (
                    <div className="flex gap-2 justify-end">
                    {isOpen && (
                    <Button
                    onClick={handleCloseGroupBuy}
                    className="bg-amber-600 hover:bg-amber-700"
                    >
                    <X className="w-4 h-4 mr-2" />
                    截止團購並開始收款
                    </Button>
                    )}
                    {isClosed && !isFullyPaid && items.length > 0 && (
                    <Button
                    onClick={handleMarkAsFullyPaid}
                    className={`${allPaid ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-400 cursor-not-allowed'}`}
                    disabled={!allPaid}
                    >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    標記為已完成 {!allPaid && `(${memberSummary.filter(m => m.paid).length}/${memberSummary.length})`}
                    </Button>
                    )}
                    </div>
                    )}
                    </div>
                    </div>
                    </div>

      <AddItemDialog
        open={showAddItem}
        onOpenChange={setShowAddItem}
        members={members}
        currentUser={currentUser}
        item={editingItem}
        onAdd={handleAddItem}
        presetProducts={products}
      />

      <EditGroupBuyDialog
        open={showEditGroupBuy}
        onOpenChange={setShowEditGroupBuy}
        groupBuy={groupBuy}
        onSave={handleEditGroupBuy}
      />

      {/* Image Modal */}
      {showImageModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 overflow-auto p-4"
          onClick={() => setShowImageModal(false)}
        >
          <button
            onClick={() => setShowImageModal(false)}
            className="sticky top-4 left-full bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10 mb-4"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={groupBuy.image_url}
            alt={groupBuy.title}
            className="w-full h-auto max-w-7xl mx-auto"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除項目</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deletingItem?.product_name}」嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-red-500 hover:bg-red-600">
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletingGroupBuy} onOpenChange={setDeletingGroupBuy}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除團購</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{groupBuy?.title}」嗎？所有相關的訂購項目也會一併刪除，此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroupBuy} className="bg-red-500 hover:bg-red-600">
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SelectMemberDialog
        open={showSelectMember}
        onOpenChange={setShowSelectMember}
        members={members}
        onSelect={handleSelectMember}
      />
    </div>
  );
}