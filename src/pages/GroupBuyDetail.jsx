import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Calendar, ExternalLink, CheckCircle, Edit, Trash2, X, Download, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import AddItemDialog from "@/components/groupbuy/AddItemDialog";
import EditGroupBuyDialog from "@/components/groupbuy/EditGroupBuyDialog";
import { exportGroupBuyOrderSummary, exportGroupBuyPaymentRecord } from "@/components/utils/ExportCSV";
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
  const [groupBuyId, setGroupBuyId] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [showEditGroupBuy, setShowEditGroupBuy] = useState(false);
  const [deletingGroupBuy, setDeletingGroupBuy] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setGroupBuyId(params.get('id'));
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  const { data: groupBuy, isLoading: groupBuyLoading } = useQuery({
    queryKey: ['groupBuy', groupBuyId],
    queryFn: async () => {
      const allGroupBuys = await base44.entities.GroupBuy.list();
      return allGroupBuys.find(gb => gb.id === groupBuyId);
    },
    enabled: !!groupBuyId
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
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

  const updateGroupBuy = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GroupBuy.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groupBuy'] })
  });

  const createItem = useMutation({
    mutationFn: (data) => base44.entities.GroupBuyItem.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groupBuyItems'] })
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GroupBuyItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groupBuyItems'] })
  });

  const deleteItem = useMutation({
    mutationFn: (id) => base44.entities.GroupBuyItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groupBuyItems'] })
  });

  const deleteGroupBuy = useMutation({
    mutationFn: (id) => base44.entities.GroupBuy.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuys'] });
      window.location.href = createPageUrl('GroupBuy');
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

  const handleCloseGroupBuy = async () => {
    if (!confirm('確定要截止這個團購嗎？截止後成員將無法再新增項目。')) return;
    await updateGroupBuy.mutateAsync({
      id: groupBuyId,
      data: { status: 'closed' }
    });
  };

  const handleCompleteGroupBuy = async () => {
    if (!confirm(`確定要結單嗎？結單後將產生訂購表單供統計。`)) return;

    await updateGroupBuy.mutateAsync({
      id: groupBuyId,
      data: { status: 'completed' }
    });

    alert('結單完成！請查看下方訂購彙總表。');
  };

  const handleTogglePaid = async (summary) => {
    const newPaidStatus = !summary.paid;
    // Update all items for this member
    for (const item of summary.items) {
      await updateItem.mutateAsync({
        id: item.id,
        data: { paid: newPaidStatus }
      });
    }
  };

  if (!currentUser || groupBuyLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
        </div>
      </div>
    );
  }

  if (!groupBuy) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-slate-500">找不到此團購</p>
          <Link to={createPageUrl('GroupBuy')}>
            <Button className="mt-4">返回團購列表</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isOrganizer = currentUser && groupBuy.created_by === currentUser.email;
  const isOpen = groupBuy.status === 'open';
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Group items by member
  const memberSummary = items.reduce((acc, item) => {
    const existing = acc.find(m => m.member_id === item.member_id);
    const itemTotal = item.price * item.quantity;
    if (existing) {
      existing.items.push(item);
      existing.total += itemTotal;
      existing.paid = existing.paid && item.paid;
    } else {
      acc.push({
        member_id: item.member_id,
        member_name: item.member_name,
        items: [item],
        total: itemTotal,
        paid: item.paid || false
      });
    }
    return acc;
  }, []);

  // Group items by product for order summary
  const productSummary = items.reduce((acc, item) => {
    // For split items, extract original price from note
    const isSplitItem = item.note && item.note.includes('平分');
    let actualPrice = item.price;
    
    if (isSplitItem) {
      // Find the orderer's name from note (format: "XXX訂購，與YYY、ZZZ平分")
      const noteMatch = item.note.match(/(.+?)訂購，與(.+)平分/);
      if (noteMatch) {
        const allNames = noteMatch[2].split('、');
        const splitCount = allNames.length;
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
  }, []);

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
                  className="relative bg-slate-100 rounded-lg overflow-hidden mb-4 cursor-pointer group"
                  onClick={() => setShowImageModal(true)}
                >
                  <img
                    src={groupBuy.image_url}
                    alt={groupBuy.title}
                    className="w-full h-auto object-contain"
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
                      groupBuy.status === 'open' ? 'bg-green-500' :
                      groupBuy.status === 'closed' ? 'bg-amber-500' :
                      'bg-slate-500'
                    }>
                      {groupBuy.status === 'open' ? '進行中' :
                       groupBuy.status === 'closed' ? '已截止' :
                       '已結單'}
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
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600">參與人數</span>
                    <span className="text-lg font-bold text-purple-600">{memberSummary.length} 人</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600">總金額</span>
                    <span className="text-2xl font-bold text-slate-800">${totalAmount.toLocaleString()}</span>
                  </div>
                  {isOrganizer && groupBuy.status !== 'open' && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">已付款</span>
                      <span className="font-semibold text-green-600">
                        {memberSummary.filter(m => m.paid).length} / {memberSummary.length}
                      </span>
                    </div>
                  )}
                </div>

                {isOrganizer && (
                  <div className="space-y-2 border-t pt-4">
                    {(isOpen || groupBuy.status === 'closed') && (
                      <Button
                        onClick={() => setShowEditGroupBuy(true)}
                        variant="outline"
                        className="w-full"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        編輯團購
                      </Button>
                    )}
                    {isOpen && (
                      <Button
                        onClick={handleCloseGroupBuy}
                        variant="outline"
                        className="w-full"
                      >
                        <X className="w-4 h-4 mr-2" />
                        截止團購
                      </Button>
                    )}
                    {groupBuy.status === 'closed' && items.length > 0 && (
                      <Button
                        onClick={handleCompleteGroupBuy}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        產生訂購表單
                      </Button>
                    )}
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
            {groupBuy.status === 'completed' && productSummary.length > 0 && (
              <Card>
                <div className="p-4 bg-green-50 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-green-800 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    訂購彙總表（按產品統計）
                  </h3>
                  {isOrganizer && (
                    <Button
                      onClick={() => exportGroupBuyOrderSummary(productSummary, groupBuy.title)}
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
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">產品名稱</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">單價</th>
                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">總數量</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">訂購明細</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {productSummary.map((product) => (
                        <tr key={product.key} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{product.product_name}</td>
                          <td className="px-4 py-3 text-right text-slate-700">${product.price.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block bg-purple-100 text-purple-800 font-semibold px-3 py-1 rounded">
                              {product.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm space-y-1">
                              {product.members.map((member, idx) => (
                                <div key={idx} className="text-slate-600">
                                  • {member.name} × {member.quantity}
                                  {member.note && <span className="text-slate-400 ml-2">({member.note})</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800">團購項目（按成員）</h2>
              <div className="flex gap-2">
                {isOrganizer && groupBuy.status !== 'open' && memberSummary.length > 0 && (
                  <Button
                    onClick={() => exportGroupBuyPaymentRecord(memberSummary, groupBuy.title)}
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
                    新增項目
                  </Button>
                )}
              </div>
            </div>

            {itemsLoading ? (
              <Card className="p-8 text-center">
                <div className="w-12 h-12 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto" />
                <p className="text-slate-500 mt-4">載入中...</p>
              </Card>
            ) : memberSummary.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <p className="text-slate-500 text-lg mb-2">還沒有人跟團</p>
                {isOpen && <p className="text-slate-400 text-sm">點擊「新增項目」開始跟團！</p>}
              </Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">成員</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">產品</th>
                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">數量</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">金額</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">小計</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">小結</th>
                        {isOrganizer && groupBuy.status !== 'open' && (
                          <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">收款</th>
                        )}
                        {((isOrganizer || items.some(i => i.created_by === currentUser?.email)) && isOpen) && (
                          <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">操作</th>
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
                                  className="px-4 py-3 font-medium align-top"
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
                            <td className="px-4 py-3">
                              <div className="text-slate-700">{item.product_name}</div>
                              {item.note && (
                                <div className="text-xs text-slate-400 mt-0.5">備註：{item.note}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-700">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-slate-700">${item.price.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-800">
                              ${(item.price * item.quantity).toLocaleString()}
                            </td>
                            {itemIdx === 0 ? (
                              <td 
                                className="px-4 py-3 text-right align-top"
                                rowSpan={summary.items.length}
                              >
                                <span className="text-lg font-bold text-purple-600">
                                  ${summary.total.toLocaleString()}
                                </span>
                              </td>
                            ) : null}
                            {itemIdx === 0 && isOrganizer && groupBuy.status !== 'open' && (
                              <td 
                                className="px-4 py-3 align-top"
                                rowSpan={summary.items.length}
                              >
                                <div className="flex items-center justify-center">
                                  <button
                                    onClick={() => handleTogglePaid(summary)}
                                    className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                      summary.paid 
                                        ? 'bg-green-600 border-green-600' 
                                        : 'border-slate-300 hover:border-slate-400'
                                    }`}
                                  >
                                    {summary.paid && <CheckCircle className="w-4 h-4 text-white" />}
                                  </button>
                                </div>
                              </td>
                            )}
                            {((isOrganizer || (currentUser && item.created_by === currentUser.email)) && isOpen) && (
                              <td className="px-4 py-3">
                                <div className="flex gap-1 justify-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingItem(item);
                                      setShowAddItem(true);
                                    }}
                                    className="h-8 w-8"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeletingItem(item)}
                                    className="h-8 w-8 text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      ))}
                      <tr className="bg-slate-50 font-semibold">
                        <td colSpan={5} className="px-4 py-3 text-right text-slate-700">總計</td>
                        <td className="px-4 py-3 text-right text-lg text-purple-600">
                          ${totalAmount.toLocaleString()}
                        </td>
                        {isOrganizer && groupBuy.status !== 'open' && (
                          <td></td>
                        )}
                        {((isOrganizer || items.some(i => i.created_by === currentUser?.email)) && isOpen) && (
                          <td></td>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
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
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-7xl max-h-[90vh] w-full">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <img
              src={groupBuy.image_url}
              alt={groupBuy.title}
              className="w-full h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
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
    </div>
  );
}