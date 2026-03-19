interface StatusIndicatorProps {
  status: 'online' | 'busy' | 'offline' | 'connecting';
  showLabel?: boolean;
}

export default function StatusIndicator({ status, showLabel = true }: StatusIndicatorProps) {
  const statusConfig = {
    online: { color: 'bg-green-500', label: 'Online' },
    busy: { color: 'bg-yellow-500', label: 'Busy' },
    offline: { color: 'bg-gray-400', label: 'Offline' },
    connecting: { color: 'bg-blue-500 animate-pulse', label: 'Connecting' }
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${config.color}`} />
      {showLabel && <span className="text-sm text-gray-600">{config.label}</span>}
    </div>
  );
}
