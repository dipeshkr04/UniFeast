import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../api';
import { useSocket } from '../../contexts/SocketContext';

function splitMs(value) {
  const totalSeconds = Math.max(0, Math.round(Number(value || 0) / 1000));
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

export default function CartHoldWindowControl({ variant = 'desktop' }) {
  const { socket } = useSocket() || {};
  const [holdMs, setHoldMs] = useState(120000);
  const [minutes, setMinutes] = useState('2');
  const [seconds, setSeconds] = useState('0');
  const [saving, setSaving] = useState(false);

  const currentLabel = useMemo(() => {
    const split = splitMs(holdMs);
    return `${split.minutes}m ${String(split.seconds).padStart(2, '0')}s`;
  }, [holdMs]);

  useEffect(() => {
    let mounted = true;
    adminAPI.getCartHoldWindow()
      .then(({ data }) => {
        if (!mounted) return;
        const nextMs = Number(data.data?.holdMs || 120000);
        const split = splitMs(nextMs);
        setHoldMs(nextMs);
        setMinutes(String(split.minutes));
        setSeconds(String(split.seconds));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const handleWindowUpdate = ({ holdMs: nextMs }) => {
      const split = splitMs(nextMs);
      setHoldMs(Number(nextMs || 120000));
      setMinutes(String(split.minutes));
      setSeconds(String(split.seconds));
    };
    socket.on('cart-hold-window', handleWindowUpdate);
    return () => socket.off('cart-hold-window', handleWindowUpdate);
  }, [socket]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        minutes: Math.max(0, Number(minutes || 0)),
        seconds: Math.max(0, Number(seconds || 0)),
      };
      const { data } = await adminAPI.updateCartHoldWindow(payload);
      const nextMs = Number(data.data?.holdMs || 120000);
      const split = splitMs(nextMs);
      setHoldMs(nextMs);
      setMinutes(String(split.minutes));
      setSeconds(String(split.seconds));
      toast.success(`Cart release window set to ${split.minutes}m ${String(split.seconds).padStart(2, '0')}s`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update cart release window');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`cart-hold-control cart-hold-control-${variant}`}>
      <div className="cart-hold-copy">
        <span>Cart release</span>
        <strong>{currentLabel}</strong>
      </div>
      <div className="cart-hold-inputs">
        <label>
          <span>Min</span>
          <input
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            aria-label="Cart hold minutes"
          />
        </label>
        <label>
          <span>Sec</span>
          <input
            type="number"
            min="0"
            max="59"
            value={seconds}
            onChange={(event) => setSeconds(event.target.value)}
            aria-label="Cart hold seconds"
          />
        </label>
        <button type="button" onClick={save} disabled={saving}>
          {saving ? '...' : 'Set'}
        </button>
      </div>
    </div>
  );
}
