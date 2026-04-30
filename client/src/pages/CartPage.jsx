import { useNavigate, useOutletContext } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { orderAPI, paymentAPI } from '../api';
import { HiOutlineTrash, HiPlus, HiMinus, HiArrowLeft } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const MotionItem = motion.div;

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canteenLive } = useOutletContext() || {};

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setLoading(true);
    try {
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

            const { data } = await orderAPI.create({ items: orderItems, specialInstructions: instructions });
            clearCart();
            toast.success(`Payment successful. Order placed! ETA: ${data.eta?.eta || data.data?.estimatedTime} min`, { icon: '🎉', duration: 5000 });
            navigate('/orders');
          } catch (error) {
            toast.error(error.response?.data?.message || 'Payment verified, but order placement failed');
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
      <div className="animate-fadeIn text-center py-16 md:py-24">
        <div className="text-6xl mb-6">🛒</div>
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-surface-400 mb-8 max-w-xs mx-auto">Add some delicious items from the menu!</p>
        <button onClick={() => navigate('/')} className="btn-primary min-h-[44px] px-6 py-3" id="go-to-menu">
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-6 md:mb-8">
        <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors bg-white/5 border border-white/10 shrink-0">
          <HiArrowLeft className="w-5 h-5 text-surface-200" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">Your Cart</h1>
          <p className="text-surface-400 mt-1 text-sm">{totalItems} item{totalItems > 1 ? 's' : ''} • Review your order below</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        {/* Left Column: Cart Items & Instructions */}
        <div className="flex-1 w-full space-y-6 md:space-y-8">
          {/* Cart items */}
          <div className="space-y-3 md:space-y-4">
            <AnimatePresence mode="popLayout">
              {items.map(({ menuItem, quantity }) => (
                <MotionItem
                  key={menuItem._id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: -20 }}
                  className="glass-card-static p-4 md:p-5 flex items-center gap-3 sm:gap-4 relative group" 
                  id={`cart-item-${menuItem._id}`}
                >                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-surface-800/80 flex items-center justify-center text-2xl sm:text-3xl shrink-0 border border-surface-700/50">
                    {menuItem.category === 'snacks' ? '🥟' :
                     menuItem.category === 'meals' ? '🍛' :
                     menuItem.category === 'beverages' ? '☕' : '🍮'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-surface-50 truncate">{menuItem.name}</h3>
                    <p className="text-xs sm:text-sm font-medium text-primary-400">₹{menuItem.price} <span className="text-surface-500 font-normal">each</span></p>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1 p-1 bg-surface-800/60 rounded-xl border border-surface-700/50">
                      <button
                        onClick={() => updateQuantity(menuItem._id, quantity - 1)}
                        className="w-8 h-8 rounded-lg bg-surface-700/50 flex items-center justify-center hover:bg-surface-600 text-surface-300 transition-all"
                      >
                        <HiMinus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-bold text-surface-100 text-sm">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(menuItem._id, quantity + 1)}
                        className="w-8 h-8 rounded-lg bg-surface-700/50 flex items-center justify-center hover:bg-surface-600 text-surface-300 transition-all"
                      >
                        <HiPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Price & Remove */}
                    <div className="text-right hidden sm:block min-w-[70px]">
                      <p className="text-base font-bold text-white">₹{(menuItem.price * quantity).toFixed(0)}</p>
                      <button
                        onClick={() => removeItem(menuItem._id)}
                        className="text-xs text-surface-500 hover:text-red-400 flex items-center gap-1 transition-colors mt-0.5"
                      >
                        <HiOutlineTrash className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>

                  {/* Mobile remove button */}
                  <button
                    onClick={() => removeItem(menuItem._id)}
                    className="sm:hidden w-8 h-8 flex items-center justify-center text-surface-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </MotionItem>
              ))}
            </AnimatePresence>
          </div>

          {/* Special instructions */}
          <div className="glass-card-static p-4 md:p-6">
            <h3 className="text-sm font-semibold text-surface-300 mb-3 flex items-center gap-2">
              <span className="text-base">📝</span>
              Special Instructions
            </h3>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="input-field resize-none bg-surface-900/50 border-surface-700/50 focus:border-primary-500/50 rounded-xl px-4 py-3"
              rows={3}
              placeholder="E.g., No onions, extra spicy, etc."
              maxLength={300}
              id="special-instructions"
            />
            <p className="text-right text-xs text-surface-500 mt-2">{instructions.length}/300</p>
          </div>
        </div>

        {/* Right Column: Order Summary (Sticky) */}
        <div className="w-full lg:w-[360px] lg:sticky lg:top-20">
          <div className="glass-card-static p-5 md:p-6 border border-surface-700/50">
            <h3 className="font-bold text-lg mb-5 text-white">Order Summary</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-surface-300">
                <span>Subtotal ({totalItems} items)</span>
                <span className="text-surface-100">₹{totalAmount}</span>
              </div>
              <div className="flex justify-between text-surface-300">
                <span>Platform Fee</span>
                <span className="text-success text-xs font-semibold">FREE</span>
              </div>
              
              <div className="border-t border-surface-700/50 pt-4 mt-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-surface-200 font-medium">Total</span>
                  <span className="text-2xl font-black text-primary-400">₹{totalAmount}</span>
                </div>
              </div>
            </div>

            {!canteenLive && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-center font-semibold">
                🔴 Canteen is currently closed. You cannot place orders right now.
              </div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={loading || !canteenLive}
              className={`w-full mt-4 py-3.5 text-base rounded-xl relative overflow-hidden group min-h-[48px] ${!canteenLive ? 'bg-surface-800 text-surface-500 cursor-not-allowed border border-surface-700' : 'btn-primary'}`}
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
