import { useState, useEffect, useCallback } from 'react';
import { menuAPI } from '../api';
import { useCart } from '../contexts/CartContext';
import { HiOutlineSearch, HiOutlineClock, HiOutlineFire, HiPlus, HiMinus, HiOutlineInformationCircle, HiOutlineX } from 'react-icons/hi';
import { MdOutlineLocalDining } from 'react-icons/md';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { getImageUrl } from '../utils/imageUrl';

const Motion = motion;

const COLORS = ['#e06449', '#facc15', '#3b82f6', '#10b981'];

function hasNumericStock(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && !value.trim()) return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0;
}

const categories = [
  { key: '', label: 'All', icon: '🍽️' },
  { key: 'snacks', label: 'Snacks', icon: '🥟' },
  { key: 'meals', label: 'Meals', icon: '🍛' },
  { key: 'beverages', label: 'Beverages', icon: '☕' },
  { key: 'desserts', label: 'Desserts', icon: '🍮' },
];

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingCartIds, setPendingCartIds] = useState(() => new Set());
  const { addItem, items: cartItems } = useCart();
  const { user } = useAuth();
  const { socket } = useSocket() || {};

  const getStockLeft = useCallback((item) => {
    const stock = item?.dailyStock?.quantity;
    return hasNumericStock(stock) ? Number(stock) : 0;
  }, []);

  const getMaxOrder = (item) => {
    const parsed = Number(item?.maxOrder || 15);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 15;
  };

  const fetchMenu = useCallback(async () => {
    try {
      const params = { available: 'true' };
      if (category) params.category = category;
      if (search) params.search = search;
      const { data } = await menuAPI.getAll(params);
      setItems([...(data.data || [])].sort((a, b) => {
        const aInStock = getStockLeft(a) > 0;
        const bInStock = getStockLeft(b) > 0;
        if (aInStock !== bInStock) return aInStock ? -1 : 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
      }));
    } catch {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, [category, search, getStockLeft]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on('menu:stockChanged', fetchMenu);
    return () => socket.off('menu:stockChanged', fetchMenu);
  }, [socket, fetchMenu]);

  const handleAddToCart = async (item) => {
    const stockLeft = getStockLeft(item);
    const currentQty = getCartQty(item._id);
    const maxOrder = getMaxOrder(item);
    if (pendingCartIds.has(item._id)) return;
    if (currentQty >= maxOrder) {
      toast.error(`Maximum ${maxOrder} ${item.name} can be ordered at once`);
      return;
    }
    if (stockLeft <= 0) {
      toast.error(stockLeft === 0 ? `${item.name} is currently unavailable` : `Only ${stockLeft} left today`);
      return;
    }

    setPendingCartIds((prev) => new Set(prev).add(item._id));
    try {
      await addItem(item);
      toast.success(`${item.name} added to cart`, { icon: '🛒' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to reserve this item');
    } finally {
      setPendingCartIds((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }
  };

  const handleReduceCart = async (item) => {
    if (pendingCartIds.has(item._id)) return;
    setPendingCartIds((prev) => new Set(prev).add(item._id));
    try {
      await addItem(item, -1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update cart');
    } finally {
      setPendingCartIds((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }
  };

  const getCartQty = (id) => {
    const found = cartItems.find(i => i.menuItem._id === id);
    return found?.quantity || 0;
  };

  return (
    <div className="student-menu-page">
      {/* Header section */}
      <div className="student-menu-header">
        <div className="student-menu-title-block">
          <Motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="student-menu-title text-white drop-shadow-2xl">
              Discover <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-accent-500">Flavors</span>
            </h1>
            <p className="student-menu-subtitle text-surface-400">Elite Culinary Experience • IIIT Nagpur</p>
          </Motion.div>
        </div>
      </div>

      {/* Category Tabs */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ delay: 0.1 }}
        className="student-menu-categories scrollbar-none"
      >
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`student-menu-category-tab ${category === cat.key ? 'is-active' : ''}`}
          >
            <span className="student-menu-category-icon">{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="student-menu-search group"
      >
        <div className="student-menu-search-glow" />
        <HiOutlineSearch className="student-menu-search-icon text-surface-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="student-menu-search-input text-white"
          placeholder="Search menu item by name"
          aria-label="Search menu item by name"
        />
      </motion.div>

      {/* Menu Grid */}
      {loading ? (
        <div className="student-menu-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="student-menu-skeleton-card glass-card-static">
              <div className="skeleton student-menu-skeleton-media" />
              <div className="skeleton student-menu-skeleton-title" />
              <div className="skeleton student-menu-skeleton-line" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="student-menu-empty glass-card"
        >
          <MdOutlineLocalDining className="student-menu-empty-icon text-surface-700" />
          <p className="student-menu-empty-title text-white">No items found</p>
          <p className="student-menu-empty-copy text-surface-400">We couldn't find anything matching your criteria.</p>
        </motion.div>
      ) : (
        <div className="student-menu-grid stagger-children">
          <AnimatePresence>
            {items.map(item => {
              const qty = getCartQty(item._id);
              const stockLeft = getStockLeft(item);
              const maxOrder = getMaxOrder(item);
              const isSoldOut = stockLeft === 0;
              const isAtMaxOrder = qty >= maxOrder;
              const isCartPending = pendingCartIds.has(item._id);
              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={item._id} 
                  className="student-menu-card glass-card group"
                >
                  <div className="student-menu-card-media bg-surface-900">
                    {item.imageUrl ? (
                      <img src={getImageUrl(item.imageUrl)} alt={item.name} className="student-menu-card-image" />
                    ) : (
                      <div className="student-menu-card-fallback">
                        <span>{
                          item.category === 'snacks' ? '🥟' :
                          item.category === 'meals' ? '🍛' :
                          item.category === 'beverages' ? '☕' : '🍮'
                        }</span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="student-menu-card-overlay" />

                    {/* Prep time badge */}
                    <div className="student-menu-prep-badge text-white">
                      <HiOutlineClock className="w-4 h-4 text-primary-400" />
                      <span>{item.prepTime}m</span>
                    </div>

                    <div className={`student-menu-stock-badge ${isSoldOut ? 'is-empty' : ''}`}>
                      {isSoldOut ? 'Currently unavailable' : `${stockLeft} Left`}
                    </div>

                  </div>

                  <div className="student-menu-card-body">
                    <div className="student-menu-card-copy">
                      <h3 className="student-menu-card-title text-white">{item.name}</h3>
                      <p className="student-menu-card-desc text-surface-400">{item.description}</p>

                      <div 
                        onClick={() => setSelectedItem(item)}
                        className="student-menu-nutrition group/nutri"
                        title="View detailed nutrition breakdown"
                      >
                        <div className="student-menu-calorie-pill text-white">
                          <HiOutlineFire className="w-4 h-4 text-orange-500 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" />
                          <span>{item.nutrition?.calories || 0} kcal</span>
                        </div>
                        <div className="student-menu-macros text-surface-500">
                          <span>P:{item.nutrition?.protein || 0}</span>
                          <span>C:{item.nutrition?.carbs || 0}</span>
                          <span>F:{item.nutrition?.fat || 0}</span>
                          <HiOutlineInformationCircle className="w-3.5 h-3.5 ml-1 text-primary-400 opacity-0 group-hover/nutri:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </div>

                    <div className="student-menu-card-footer">
                      <div className="student-menu-price text-white">
                        <span className="text-primary-500 text-lg mr-0.5">₹</span>{item.price}
                      </div>

                      {qty > 0 ? (
                        <div className="student-menu-qty-control">
                          <button
                            onClick={() => handleReduceCart(item)}
                            className="student-menu-qty-btn text-white"
                            disabled={isCartPending}
                          >
                            <HiMinus className="w-4 h-4" />
                          </button>
                          <span className="student-menu-qty-value text-white">{qty}</span>
                          <button
                            onClick={() => handleAddToCart(item)}
                            className="student-menu-qty-btn is-plus text-white"
                            disabled={isSoldOut || isAtMaxOrder || isCartPending}
                            title={isAtMaxOrder ? `Maximum ${maxOrder} per order` : 'Add one more'}
                          >
                            <HiPlus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(item)}
                          className={`student-menu-add-btn btn-primary ${isSoldOut ? 'is-unavailable' : ''}`}
                          disabled={isSoldOut || isCartPending}
                        >
                          <HiPlus className="w-4 h-4" />
                          <span className="font-bold tracking-wide">{isCartPending ? 'Adding...' : 'Add'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Nutrition Details Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="glass-card-static w-full max-w-[480px] p-6 lg:p-8 relative border border-surface-700/50 shadow-2xl overflow-y-auto max-h-[calc(100vh-32px)] rounded-2xl lg:rounded-[20px] z-[2001]"
            >
              {/* Background gradient blur */}
              <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />

              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-800/50 hover:bg-surface-700 transition-colors text-surface-400 hover:text-white flex items-center justify-center"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-surface-900 flex-shrink-0 border border-white/5">
                  {selectedItem.imageUrl ? (
                    <img src={getImageUrl(selectedItem.imageUrl)} alt={selectedItem.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🍲</div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white line-clamp-1">{selectedItem.name}</h3>
                  <p className="text-sm font-medium text-surface-400 capitalize">{selectedItem.category}</p>
                </div>
              </div>

              {/* Calorie Donut */}
              <div className="glass-card-static p-4 mb-5 flex flex-col items-center relative border border-transparent shadow-inner">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-widest absolute top-4 left-4 z-10">Calories</h4>
                <div className="h-36 w-36 relative mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={[{ value: selectedItem.nutrition?.calories || 0 }]} 
                        cx="50%" cy="50%" innerRadius={45} outerRadius={60} startAngle={90} endAngle={-270} 
                        dataKey="value" stroke="none"
                      >
                        <Cell fill="url(#modalColorPie)" />
                      </Pie>
                      <defs>
                        <linearGradient id="modalColorPie" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e06449" stopOpacity={1} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={1} />
                        </linearGradient>
                      </defs>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <HiOutlineFire className="w-5 h-5 text-primary-400 drop-shadow-[0_0_5px_rgba(224,100,73,0.8)]" />
                    <p className="text-2xl font-black text-white leading-none mt-1">{selectedItem.nutrition?.calories || 0}</p>
                    <p className="text-xs font-bold text-surface-500 uppercase tracking-widest mt-1">kcal</p>
                  </div>
                </div>
              </div>

              {/* Macro Bars */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-widest mb-1">Macronutrients vs Daily Goals</h4>
                
                {[
                  { label: 'Protein', key: 'protein', color: COLORS[0], goal: user?.dailyProteinGoal || 50 },
                  { label: 'Carbs', key: 'carbs', color: COLORS[1], goal: user?.dailyCarbGoal || 250 },
                  { label: 'Fat', key: 'fat', color: COLORS[2], goal: user?.dailyFatGoal || 65 },
                  { label: 'Fiber', key: 'fiber', color: COLORS[3], goal: user?.dailyFiberGoal || 30 },
                ].map((macro) => {
                  const val = selectedItem.nutrition?.[macro.key] || 0;
                  const pct = Math.min(100, (val / macro.goal) * 100);
                  
                  return (
                    <div key={macro.label}>
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-xs font-semibold text-surface-200 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.2)]" style={{ background: macro.color }} />
                           {macro.label}
                        </span>
                        <div className="text-xs font-black text-white flex items-center gap-1.5">
                          <span>{val}g</span>
                          <span className="text-xs font-semibold text-surface-500 px-2 py-0.5 rounded bg-white/5 border border-white/5">{Math.round(pct)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-surface-800 rounded-full overflow-hidden shadow-inner flex">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                          className="h-full rounded-full" 
                          style={{ background: macro.color, boxShadow: `0 0 10px ${macro.color}80` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-5 border-t border-surface-800 flex flex-col-reverse lg:flex-row gap-3">
                <button onClick={() => setSelectedItem(null)} className="btn-secondary flex-1 font-bold py-3 text-[14px] border border-surface-700/50 min-h-[44px]">Close</button>
                <button 
                  onClick={() => {
                    handleAddToCart(selectedItem);
                    setSelectedItem(null);
                  }} 
                  className="btn-primary flex-1 flex justify-center items-center gap-2 font-bold py-3 text-[14px] shadow-[0_0_15px_rgba(255,71,20,0.3)] hover:shadow-[0_0_25px_rgba(255,71,20,0.5)] transition-shadow min-h-[44px]"
                  disabled={getStockLeft(selectedItem) === 0 || pendingCartIds.has(selectedItem._id)}
                >
                  <HiPlus className="w-4 h-4" /> Add to Cart — ₹{selectedItem.price}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
