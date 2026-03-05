import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatTaiwanTime } from '@/components/utils/dateUtils';
import { toast } from 'sonner';

const RC_ADMIN_EMAIL = 'bv2hh128@gmail.com';

export default function PendingApproval() {
  const { user: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: pendingTransactions = [], isLoading } = useQuery({
    queryKey: ['transactions', 'pending'],
    queryFn: async () => {
      const all = await base44.entities.Transaction.list('-created_date');
      return all.filter(t => t.status === 'pending');
    },
    refetchInterval: 30 * 1000,
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list(),
  });

  const memberMap = useMemo(() => new Map(allMembers.map(m => [m.id, m])), [allMembers]);

  const updateTransaction = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Transaction.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  const createNotification = useMutation({
    mutationFn: (data) => base44.entities.Notification.create(data),
  });

  const handleApprove = async (transaction) => {
    toast.loading('處理中...', { id: 'approve' });
    try {
      const { type, amount, from_member_id, to_member_id, wallet_type } = transaction;
      const balanceField = wallet_type === 'cash' ? 'cash_balance' : 'balance';

      // Execute balance changes
      if (type === 'deposit' && to_member_id) {
        const m = memberMap.get(to_member_id);
        if (m) await updateMember.mutateAsync({ id: to_member_id, data: { [balanceField]: (m[balanceField] || 0) + amount } });
      } else if (type === 'withdraw' && from_member_id) {
        const m = memberMap.get(from_member_id);
        if (m) await updateMember.mutateAsync({ id: from_member_id, data: { [balanceField]: (m[balanceField] || 0) - amount } });
      } else if (type === 'transfer' && from_member_id && to_member_id) {
        const fromM = memberMap.get(from_member_id);
        const toM = memberMap.get(to_member_id);
        if (fromM) await updateMember.mutateAsync({ id: from_member_id, data: { [balanceField]: (fromM[balanceField] || 0) - amount } });
        if (toM) await updateMember.mutateAsync({ id: to_member_id, data: { [balanceField]: (toM[balanceField] || 0) + amount } });
      }

      // Update status
      await updateTransaction.mutateAsync({ id: transaction.id, data: { status: 'approved' } });

      // Notify submitter
      if (transaction.submitted_by_email) {
        await createNotification.mutateAsync({
          recipient_email: transaction.submitted_by_email,
          type: 'approved',
          transaction_id: transaction.id,
          message: `你提交的 $${amount} ${getTypeLabel(type)}申請已核准`,
          actor_name: 'RC',
          is_read: false,
        });
      }

      toast.dismiss('approve');
      toast.success('已核准，餘額已更新');
    } catch (err) {
      toast.dismiss('approve');
      toast.error(`核准失敗：${err.message}`);
    }
  };

  const handleReject = async (transaction) => {
    toast.loading('處理中...', { id: 'reject' });
    try {
      await updateTransaction.mutateAsync({ id: transaction.id, data: { status: 'rejected' } });

      if (transaction.submitted_by_email) {
        await createNotification.mutateAsync({
          recipient_email: transaction.submitted_by_email,
          type: 'rejected',
          transaction_id: transaction.id,
          message: `你提交的 $${transaction.amount} ${getTypeLabel(transaction.type)}申請已拒絕`,
          actor_name: 'RC',
          is_read: false,
        });
      }

      toast.dismiss('reject');
      toast.success('已拒絕');
    } catch (err) {
      toast.dismiss('reject');
      toast.error(`拒絕失敗：${err.message}`);
    }
  };

  const getTypeLabel = (type) => {
    if (type === 'deposit') return '入帳';
    if (type === 'withdraw') return '出帳';
    if (type === 'transfer') return '轉帳';
    return '';
  };

  const getTypeColor = (type) => {
    if (type === 'deposit') return 'bg-emerald-500';
    if (type === 'withdraw') return 'bg-red-500';
    return 'bg-blue-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-slate-800 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Clock className="w-7 h-7 text-yellow-400" />
            <div>
              <h1 className="text-2xl font-bold">待審核交易</h1>
              <p className="text-slate-400 text-sm">共 {pendingTransactions.length} 筆待處理</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">載入中...</div>
        ) : pendingTransactions.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">沒有待審核交易</p>
            <p className="text-slate-400 text-sm mt-1">所有申請都已處理完畢</p>
          </Card>
        ) : (
          pendingTransactions.map(t => (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={getTypeColor(t.type)}>{getTypeLabel(t.type)}</Badge>
                    <Badge variant="outline" className={t.wallet_type === 'cash' ? 'border-amber-500 text-amber-700' : 'border-blue-500 text-blue-700'}>
                      {t.wallet_type === 'cash' ? '現金' : '錢包'}
                    </Badge>
                    <span className="text-xl font-bold text-slate-800">${t.amount?.toLocaleString()}</span>
                  </div>

                  <div className="text-sm text-slate-600 space-y-0.5">
                    {t.type === 'deposit' && <p>入帳對象：{t.to_member_name}</p>}
                    {t.type === 'withdraw' && <p>出帳對象：{t.from_member_name}</p>}
                    {t.type === 'transfer' && <p>轉帳：{t.from_member_name} → {t.to_member_name}</p>}
                    {t.note && <p className="text-slate-500">備註：{t.note}</p>}
                  </div>

                  <div className="text-xs text-slate-400">
                    <span>提交者：{t.submitted_by_name || t.submitted_by_email || '未知'}</span>
                    <span className="mx-2">·</span>
                    <span>{formatTaiwanTime(t.created_date, 'MM/dd HH:mm')}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(t)}
                    className="bg-green-600 hover:bg-green-700 text-white gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    核准
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(t)}
                    className="text-red-600 border-red-300 hover:bg-red-50 gap-1"
                  >
                    <XCircle className="w-4 h-4" />
                    拒絕
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}