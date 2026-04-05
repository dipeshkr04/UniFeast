import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { orderAPI } from '../api';
import { HiOutlineTrash, HiPlus, HiMinus, HiArrowLeft } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, totalAmount, totalItems } = useCart();
  const [loading, setLoading] = useState(false);
  const [instructions, setInstructions] = useState('');
  const navigate = useNavigate();

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setLoading(true);
    try {
      const orderItems = items.map(i => ({
        menuItem: i.menuItem._id,
        quantity: i.quantity,
      }));
      const { data } = await orderAPI.create({ items: orderItems, specialInstructions: instructions });
      clearCart();
      toast.success(`Order placed! ETA: ${data.eta?.eta || data.data?.estimatedTime} min`, { icon: '🎉', duration: 5000 });
      navigate('/orders');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="animate-fadeIn text-center py-20">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-surface-400 mb-6">Add some delicious items from the menu!</p>
        <button onClick={() => navigate('/')} className="btn-primary" id="go-to-menu">
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-white/5">
          <HiArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Your Cart</h1>
          <p className="text-surface-400 text-sm">{totalItems} item{totalItems > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Cart items */}
      <div className="space-y-3 mb-6">
        {items.map(({ menuItem, quantity }) => (
          <div key={menuItem._id} className="glass-card-static p-4 flex items-center gap-4" id={`cart-item-${menuItem._id}`}>
            <div className="w-16 h-16 rounded-xl bg-surface-800 flex items-center justify-center text-2xl flex-shrink-0">
              {menuItem.category === 'snacks' ? '🥟' :
               menuItem.category === 'meals' ? '🍛' :
               menuItem.category === 'beverages' ? '☕' : '🍮'}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-surface-100 truncate">{menuItem.name}</h3>
              <p className="text-sm text-surface-400">₹{menuItem.price} × {quantity}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(menuItem._id, quantity - 1)}
                className="w-8 h-8 rounded-lg bg-surface-700/50 flex items-center justify-center hover:bg-surface-600/50"
              >
                <HiMinus className="w-4 h-4" />
              </button>
              <span className="w-6 text-center font-semibold">{quantity}</span>
              <button
                onClick={() => updateQuantity(menuItem._id, quantity + 1)}
                className="w-8 h-8 rounded-lg bg-surface-700/50 flex items-center justify-center hover:bg-surface-600/50"
              >
                <HiPlus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-right ml-2">
              <p className="font-bold text-primary-400">₹{menuItem.price * quantity}</p>
              <button
                onClick={() => removeItem(menuItem._id)}
                className="text-xs text-red-400 hover:text-red-300 mt-1 flex items-center gap-1"
              >
                <HiOutlineTrash className="w-3 h-3" /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Special instructions */}
      <div className="glass-card-static p-4 mb-4">
        <label className="block text-sm text-surface-400 mb-1.5">Special Instructions (optional)</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className="input-field resize-none"
          rows={2}
          placeholder="Any special requests..."
          maxLength={300}
          id="special-instructions"
        />
      </div>

      {/* Order Summary */}
      <div className="glass-card-static p-5">
        <h3 className="font-semibold mb-3 text-surface-300 text-sm uppercase tracking-wider">Order Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-surface-300">
            <span>Subtotal</span>
            <span>₹{totalAmount}</span>
          </div>
          <div className="flex justify-between text-surface-400">
            <span>Platform fee</span>
            <span className="text-green-400">Free</span>
          </div>
          <div className="border-t border-surface-700 pt-2 flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-primary-400">₹{totalAmount}</span>
          </div>
        </div>
        <button
          onClick={handlePlaceOrder}
          disabled={loading}
          className="btn-primary w-full mt-4 py-3 text-base"
          id="place-order-btn"
        >
          {loading ? '⏳ Placing Order...' : `🍽️ Place Order — ₹${totalAmount}`}
        </button>
      </div>
    </div>
  );
}

