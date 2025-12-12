import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Bell, User, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Profile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [settings, setSettings] = useState({
    email_groupbuy_created: true,
    email_groupbuy_closed: true,
    email_groupbuy_completed: true
  });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        if (user.notification_settings) {
          setSettings(user.notification_settings);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        notification_settings: settings
      });
      alert('設定已儲存！');
    } catch (error) {
      alert('儲存失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-slate-800 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首頁
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">個人設定</h1>
              <p className="text-slate-400 text-sm">管理您的通知偏好</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* User Info */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {currentUser.full_name?.charAt(0) || currentUser.email?.charAt(0) || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                {currentUser.full_name || currentUser.email}
              </h2>
              <p className="text-sm text-slate-500">{currentUser.email}</p>
              {currentUser.role === 'admin' && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                  管理員
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">通知設定</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email_groupbuy_created" className="text-base">
                  新團購開立通知
                </Label>
                <p className="text-sm text-slate-500">
                  當有新的團購開立時，發送Email通知
                </p>
              </div>
              <Switch
                id="email_groupbuy_created"
                checked={settings.email_groupbuy_created}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, email_groupbuy_created: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email_groupbuy_closed" className="text-base">
                  團購截止通知
                </Label>
                <p className="text-sm text-slate-500">
                  當您參與的團購截止時，發送Email通知
                </p>
              </div>
              <Switch
                id="email_groupbuy_closed"
                checked={settings.email_groupbuy_closed}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, email_groupbuy_closed: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email_groupbuy_completed" className="text-base">
                  團購結單通知
                </Label>
                <p className="text-sm text-slate-500">
                  當您參與的團購結單時，發送訂購明細Email
                </p>
              </div>
              <Switch
                id="email_groupbuy_completed"
                checked={settings.email_groupbuy_completed}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, email_groupbuy_completed: checked })
                }
              />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-slate-900 hover:bg-slate-800"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? '儲存中...' : '儲存設定'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}