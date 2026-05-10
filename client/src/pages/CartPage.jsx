import { useNavigate, useOutletContext } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { orderAPI, paymentAPI } from '../api';
import { HiOutlineTrash, HiPlus, HiMinus, HiArrowLeft } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const MotionItem = motion.div;

function formatHoldTime(expiresAt) {
  const remainingMs = Math.max(0, Number(expiresAt || 0) - Date.now());
  const seconds = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, totalAmount, totalItems } = useCart();
  const [loading, setLoading] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [, setTimerTick] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canteenLive } = useOutletContext() || {};

  useEffect(() => {
    const interval = setInterval(() => setTimerTick((tick) => tick + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setLoading(true);
    try {
      for (const { menuItem, quantity } of items) {
        if (!menuItem?._id || quantity <= 0) {
          toast.error('Your cart has an invalid item. Please refresh and try again.');
          return;
        }
      }

      const orderItems = items.map((i) => ({
        menuItem: i.menuItem._id,
        quantity: i.quantity,
      }));
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Razorpay checkout failed to load');
        return;
      }

      const { data: paymentData } = await paymentAPI.createOrder({
        amount: totalAmount,
        currency: 'INR',
        receipt: `unifeast_${Date.now()}`,
      });

      const options = {
        key: paymentData.keyId,
        amount: paymentData.order.amount,
        currency: paymentData.order.currency,
        name: 'UniFeast',
        description: 'UniFeast cart checkout',
        order_id: paymentData.order.id,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#ff4714',
        },
        handler: async (response) => {
          try {
            await paymentAPI.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });

            const submitOrder = async (payload, retries = 3) => {
              let lastError;
              for (let i = 0; i < retries; i++) {
                try {
                  return await orderAPI.create(payload);
                } catch (e) {
                  lastError = e;
                  if (i < retries - 1) {
                    await new Promise((res) => setTimeout(res, 1000));
                  }
                }
              }
              throw lastError;
            };

            try {
              const createPayload = {
                items: orderItems,
                totalAmount,
                specialInstructions: instructions,
                razorpayPaymentId: response.razorpay_payment_id,
              };
              const { data } = await submitOrder(createPayload);
              clearCart({ releaseHolds: false });
              localStorage.removeItem('unifeast_pending_order');
              toast.success(`Payment successful. Order placed! ETA: ${data.eta?.eta || data.data?.estimatedTime || '?'} min`, { icon: '🎉', duration: 5000 });
              navigate('/orders');
            } catch {
              const pendingPayload = {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpayPaymentId: response.razorpay_payment_id,
                userId: user?._id || user?.id || '',
                items: orderItems,
                totalAmount,
                specialInstructions: instructions,
                timestamp: Date.now()
              };
              localStorage.setItem('unifeast_pending_order', JSON.stringify(pendingPayload));
              toast.custom((t) => (
                <div className={`bg-[#18181b] border border-[#3f3f46] text-white rounded-xl p-3 ${t.visible ? 'animate-enter' : 'animate-leave'}`}>
                  <p className="text-sm">Payment verified, but order placement failed. Your payment is safe.</p>
                  <button
                    className="mt-2 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-semibold"
                    onClick={() => {
                      toast.dismiss(t.id);
                      navigate('/orders');
                    }}
                  >
                    Retry
                  </button>
                </div>
              ), { duration: 9000, id: 'pending-order-create-failed' });
            }
          } catch (error) {
            toast.error(error.response?.data?.message || 'Payment verification failed.');
          }
        },
        modal: {
          ondismiss: () => {
            toast('Payment cancelled');
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start payment');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="cart-page cart-empty-page animate-fadeIn">
        <div className="text-6xl mb-6">🛒</div>
        <h2 className="cart-empty-title">Your cart is empty</h2>
        <p className="cart-empty-copy">Add some delicious items from the menu!</p>
        <button onClick={() => navigate('/')} className="cart-primary-btn btn-primary" id="go-to-menu">
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="cart-page animate-fadeIn">
      {/* Header */}
      <div className="cart-header">
        <button onClick={() => navigate('/')} className="cart-back-btn">
          <HiArrowLeft className="w-5 h-5 text-surface-200" />
        </button>
        <div className="cart-title-block">
          <h1 className="cart-title">Your Cart</h1>
          <p className="text-surface-400 mt-1 text-sm">{totalItems} item{totalItems > 1 ? 's' : ''} • Review your order below</p>
        </div>
      </div>

      <div className="cart-layout">
        {/* Left Column: Cart Items & Instructions */}
        <div className="cart-main">
          {/* Cart items */}
          <div className="cart-items-list">
            <AnimatePresence mode="popLayout">
              {items.map(({ menuItem, quantity, holdExpiresAt }) => (
                <MotionItem
                  key={menuItem._id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: -20 }}
                  className="cart-item-card glass-card-static group"
                  id={`cart-item-${menuItem._id}`}
                >
                  <div className="cart-item-media">
                    {menuItem.imageUrl ? (
                      <img src={menuItem.imageUrl} alt={menuItem.name} className="cart-item-image" />
                    ) : (
                      menuItem.category === 'snacks' ? '🥟' :
                      menuItem.category === 'meals' ? '🍛' :
                      menuItem.category === 'beverages' ? '☕' : '🍮'
                    )}
                  </div>
                  
                  <div className="cart-item-copy">
                    <h3 className="cart-item-title">{menuItem.name}</h3>
                    <p className="text-[13px] font-medium text-primary-400">₹{menuItem.price} <span className="text-surface-500 font-normal">each</span></p>
                    <p className="cart-hold-timer">Hold expires in {formatHoldTime(holdExpiresAt)}</p>
                  </div>

                  <div className="cart-item-actions">
                    {/* Quantity Controls */}
                    <div className="cart-qty-control">
                      <button
                        onClick={() => updateQuantity(menuItem._id, quantity - 1).catch((err) => toast.error(err.response?.data?.message || 'Unable to update cart'))}
                        className="cart-qty-btn"
                      >
                        <HiMinus className="w-3.5 h-3.5" />
                      </button>
                      <span className="cart-qty-value">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(menuItem._id, quantity + 1).catch((err) => toast.error(err.response?.data?.message || 'Unable to update cart'))}
                        className="cart-qty-btn"
                      >
                        <HiPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Price & Remove */}
                    <div className="cart-item-total">
                      <p className="text-base font-bold text-white">₹{(menuItem.price * quantity).toFixed(0)}</p>
                      <button
                        onClick={() => removeItem(menuItem._id)}
                        className="cart-remove-btn cart-remove-desktop"
                      >
                        <HiOutlineTrash className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>

                  {/* Mobile remove button */}
                  <button
                    onClick={() => removeItem(menuItem._id)}
                    className="cart-remove-btn cart-remove-mobile"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </MotionItem>
              ))}
            </AnimatePresence>
          </div>

          {/* Special instructions */}
          <div className="cart-instructions-card glass-card-static">
            <h3 className="cart-section-title">
              <span className="text-base">📝</span>
              Special Instructions
            </h3>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="cart-instructions-input input-field resize-none"
              rows={3}
              placeholder="E.g., No onions, extra spicy, etc."
              maxLength={300}
              id="special-instructions"
            />
            <p className="cart-input-count">{instructions.length}/300</p>
          </div>
        </div>

        {/* Right Column: Order Summary (Sticky) */}
        <div className="cart-summary-wrap">
          <div className="cart-summary-card glass-card-static">
            <h3 className="cart-summary-title">Order Summary</h3>
            
            <div className="cart-summary-lines">
              <div className="cart-summary-line">
                <span>Subtotal ({totalItems} items)</span>
                <span className="text-surface-100">₹{totalAmount}</span>
              </div>
              <div className="cart-summary-line">
                <span>Platform Fee</span>
                <span className="cart-free-label">FREE</span>
              </div>
              
              <div className="cart-total-divider">
                <div className="cart-total-row">
                  <span>Total</span>
                  <span className="text-2xl font-black text-primary-400">₹{totalAmount}</span>
                </div>
              </div>
            </div>

            {!canteenLive && (
              <div className="cart-closed-notice">
                🔴 Canteen is currently closed. You cannot place orders right now.
              </div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={loading || !canteenLive}
              className={`cart-primary-btn cart-place-order-btn ${!canteenLive ? 'cart-place-order-btn-disabled' : 'btn-primary'}`}
              id="place-order-btn"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Placing Order...
                  </>
                ) : !canteenLive ? (
                  'Canteen Closed'
                ) : (
                  `Place Order — ₹${totalAmount}`
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
