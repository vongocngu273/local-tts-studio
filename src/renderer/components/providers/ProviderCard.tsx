import React, { useState } from 'react';
import {
  Key,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Zap,
  Check
} from 'lucide-react';
import type { ProviderPublicInfo, ProviderId } from '@shared/types/provider.types';
import { StatusBadge } from '../ui/StatusBadge';

interface ProviderCardProps {
  provider: ProviderPublicInfo;
  isTesting: boolean;
  testResult?: { success: boolean; message: string };
  onTest: (id: ProviderId) => void;
  onSaveKey: (id: ProviderId, key: string) => Promise<boolean>;
  onDeleteKey: (id: ProviderId) => Promise<boolean>;
  onToggleEnabled: (id: ProviderId, enabled: boolean) => Promise<boolean>;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  isTesting,
  testResult,
  onTest,
  onSaveKey,
  onDeleteKey,
  onToggleEnabled
}) => {
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setIsSaving(true);
    const success = await onSaveKey(provider.id, apiKeyInput.trim());
    setIsSaving(false);
    if (success) {
      setIsEditingKey(false);
      setApiKeyInput('');
    }
  };

  const handleDeleteKey = async () => {
    await onDeleteKey(provider.id);
    setIsEditingKey(false);
    setApiKeyInput('');
  };

  const getStatus = () => {
    if (!provider.enabled) {
      return <StatusBadge label="Đã tắt" variant="neutral" />;
    }
    if (provider.configured || !provider.capabilities.requiresApiKey) {
      return <StatusBadge label="Sẵn sàng" variant="ready" />;
    }
    return <StatusBadge label="Chưa cấu hình API Key" variant="warning" />;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
            {provider.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{provider.name}</h3>
              {getStatus()}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
          </div>
        </div>

        {/* Enable / Disable toggle & Test Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTest(provider.id)}
            disabled={isTesting || (!provider.configured && provider.capabilities.requiresApiKey)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin text-primary' : ''}`} />
            <span>{isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
          </button>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={provider.enabled}
              onChange={(e) => onToggleEnabled(provider.id, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      {/* Capabilities & Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
        <div className="rounded-lg bg-muted/40 p-2 text-center">
          <span className="text-muted-foreground block text-[10px]">Giọng đọc sẵn có</span>
          <span className="font-semibold text-foreground">{provider.voicesCount || '0'} giọng</span>
        </div>
        <div className="rounded-lg bg-muted/40 p-2 text-center">
          <span className="text-muted-foreground block text-[10px]">Cao độ (Pitch)</span>
          <span className={provider.capabilities.supportsPitch ? 'text-primary font-semibold' : 'text-muted-foreground'}>
            {provider.capabilities.supportsPitch ? 'Hỗ trợ' : 'Không'}
          </span>
        </div>
        <div className="rounded-lg bg-muted/40 p-2 text-center">
          <span className="text-muted-foreground block text-[10px]">Tốc độ (Speed)</span>
          <span className={provider.capabilities.supportsRate ? 'text-primary font-semibold' : 'text-muted-foreground'}>
            {provider.capabilities.supportsRate ? `${provider.capabilities.minRate}x - ${provider.capabilities.maxRate}x` : 'Mặc định'}
          </span>
        </div>
        <div className="rounded-lg bg-muted/40 p-2 text-center">
          <span className="text-muted-foreground block text-[10px]">Thời gian từ (Timing)</span>
          <span className={provider.capabilities.supportsTimings ? 'text-primary font-semibold' : 'text-muted-foreground'}>
            {provider.capabilities.supportsTimings ? 'Từ & Câu' : 'Không'}
          </span>
        </div>
      </div>

      {/* API Key Credentials Section */}
      {provider.capabilities.requiresApiKey ? (
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Key className="h-3.5 w-3.5 text-primary" />
              <span>Khóa bí mật (API Key)</span>
            </div>
            {provider.hasApiKey && !isEditingKey && (
              <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                <Check className="h-3 w-3" /> Đã lưu an toàn trong safeStorage
              </span>
            )}
          </div>

          {!isEditingKey && provider.hasApiKey ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground tracking-widest">
                ••••••••••••••••••••••••
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsEditingKey(true);
                    setApiKeyInput('');
                  }}
                  className="rounded-lg bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                >
                  Thay đổi
                </button>
                <button
                  onClick={handleDeleteKey}
                  title="Xóa khóa bí mật"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder={`Nhập ${provider.name} API Key / Token...`}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background pl-3 pr-10 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2">
                {provider.hasApiKey && (
                  <button
                    onClick={() => {
                      setIsEditingKey(false);
                      setApiKeyInput('');
                    }}
                    className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Hủy
                  </button>
                )}
                <button
                  onClick={handleSaveKey}
                  disabled={isSaving || !apiKeyInput.trim()}
                  className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSaving ? 'Đang mã hóa...' : 'Lưu khóa an toàn'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 text-xs text-primary flex items-center gap-2">
          <Zap className="h-4 w-4 shrink-0" />
          <span>Nhà cung cấp này hoạt động trực tiếp miễn phí, không yêu cầu API Key.</span>
        </div>
      )}

      {/* Test Result Toast/Banner */}
      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-lg p-2.5 text-xs ${
            testResult.success
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span className="leading-tight">{testResult.message}</span>
        </div>
      )}
    </div>
  );
};
