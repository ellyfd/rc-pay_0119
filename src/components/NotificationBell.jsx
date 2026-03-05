import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { Bell, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { createPageUrl } from '@/utils';
import { formatTaiwanTime } from '@/components/utils/dateUtils';

export default function NotificationBell() {
  const { user: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const all = await base44.entities.Notification.list('-created_date');
      return all.filter(n => n.recipient_email === currentUser.email);
    },
    enabled: !!currentUser?.email,
    refetchInterval: 30 * 1000,
  });

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const markRead = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
    if (notification.type === 'pending_approval') {
      window.location.href = createPageUrl('PendingApproval');
    }
  };

  const getIcon = (type) => {
    if (type === 'pending_approval') return <Clock className="w-4 h-4 text-yellow-500" />;
    if (type === 'approved') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (type === 'rejected') return <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative text-white hover:bg-slate-800 p-2">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b font-semibold text-slate-800 text-sm">通知</div>
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">沒有通知</div>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-blue-50' : ''}`}
              >
                <div className="mt-0.5">{getIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.is_read ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatTaiwanTime(n.created_date, 'MM/dd HH:mm')}
                  </p>
                </div>
                {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}