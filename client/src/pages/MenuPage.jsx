import { useState, useEffect } from 'react';
import { menuAPI, poolAPI } from '../api';
import { useCart } from '../contexts/CartContext';
import { HiOutlineSearch, HiOutlineClock, HiOutlineFire, HiPlus, HiMinus } from 'react-icons/hi';
import { MdOutlineLocalDining } from 'react-icons/md';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [pools, setPools] = useState({});
  const { addItem, items: cartItems } = useCart();

  useEffect(() => {
    fetchMenu();
  }, [category, search]);

  const fetchMenu = async () => {
    try {
      const params = { available: 'true' };
      if (category) params.category = category;
      if (search) params.search = search;
      const { data } = await menuAPI.getAll(params);
      setItems(data.data);
      // Fetch pool status for all items incrementally
      data.data.forEach(item => checkPool(item._id));
    } catch (err) {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const checkPool = async (menuItemId) => {
    try {
      const { data } = await poolAPI.checkForItem(menuItemId);
      if (data.hasPool) {
        setPools(prev => ({ ...prev, [menuItemId]: data.data }));
      }
    } catch { /* silent */ }
  };

  const handleAddToCart = (item) => {
    addItem(item);
    toast.success(`${item.name} added to cart`, { icon: '🛒' });
    checkPool(item._id);
  };

  const getCartQty = (id) => {
    const found = cartItems.find(i => i.menuItem._id === id);
    return found?.quantity || 0;
  };

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-2">
        <div>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tight text-white drop-shadow-2xl">
              Discover <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-accent-500">Flavors</span>
            </h1>
            <p className="text-surface-400 font-medium tracking-wide uppercase text-xs sm:text-sm mt-3">Elite Culinary Experience • IIIT Nagpur</p>
          </motion.div>
        </div>
        
        {/* Search */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full md:w-96 group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-surface-400 z-10" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#09090b]/80 border border-white/10 text-white rounded-2xl py-4 pl-14 pr-6 focus:outline-none focus:ring-2 focus:ring-primary-500/50 backdrop-blur-xl relative z-10 text-sm font-medium transition-all"
            placeholder="Search for amazing food..."
          />
        </motion.div>
      </div>

      {/* Category Tabs */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ delay: 0.1 }}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-none"
      >
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`flex items-center gap-3 px-6 py-3.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300
              ${category === cat.key ? 'bg-primary-500 text-white shadow-[0_0_20px_rgba(255,71,20,0.4)] scale-105' : 'bg-white/5 text-surface-400 hover:text-white hover:bg-white/10 border border-white/5'}`}
          >
            <span className='text-lg'>{cat.icon}</span>
            <span className="tracking-wide">{cat.label}</span>
          </button>
        ))}
      </motion.div>

      {/* Menu Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass-card-static p-4 border border-white/5">
              <div className="skeleton h-48 mb-4 rounded-2xl" />
              <div className="skeleton h-6 w-3/4 mb-3" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center py-24 glass-card max-w-2xl mx-auto border border-white/5 bg-[#09090b]/40"
        >
          <MdOutlineLocalDining className="w-24 h-24 text-surface-700 mx-auto mb-6" />
          <p className="text-white text-2xl font-black">No items found</p>
          <p className="text-surface-400 text-base font-medium mt-3">We couldn't find anything matching your criteria.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 stagger-children">
          <AnimatePresence>
            {items.map(item => {
              const qty = getCartQty(item._id);
              const pool = pools[item._id];
              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={item._id} 
                  className="glass-card group flex flex-col justify-between border border-white/5 hover:border-primary-500/30 bg-[#09090b]/60"
                >
                  <div className="relative h-48 sm:h-56 mb-5 overflow-hidden rounded-2xl bg-surface-900 border border-white/5 isolation-auto">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-800 to-surface-900 transition-transform duration-700 group-hover:scale-110">
                        <span className="text-6xl drop-shadow-2xl">{
                          item.category === 'snacks' ? '🥟' :
                          item.category === 'meals' ? '🍛' :
                          item.category === 'beverages' ? '☕' : '🍮'
                        }</span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent opacity-80" />

                    {/* Prep time badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-xs font-bold text-white shadow-lg">
                      <HiOutlineClock className="w-4 h-4 text-primary-400" />
                      <span>{item.prepTime}m</span>
                    </div>

                    {/* Pools active badge */}
                    {pool && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-info/20 backdrop-blur-md rounded-full border border-info/30 text-[10px] font-black text-blue-300 uppercase tracking-wider animate-pulse-glow shadow-lg">
                        🤝 Pool {pool.savingsPercent}% OFF
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-black text-white leading-tight mb-2 group-hover:text-primary-400 transition-colors line-clamp-1">{item.name}</h3>
                      <p className="text-xs text-surface-400 leading-relaxed line-clamp-2 min-h-[2.5rem] font-medium">{item.description}</p>

                      <div className="flex items-center gap-3 mt-4 mb-5">
                        <div className="flex items-center gap-1.5 text-xs text-white font-bold bg-white/5 py-1 px-2.5 rounded-md border border-white/5">
                          <HiOutlineFire className="w-4 h-4 text-orange-500 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" />
                          <span>{item.nutrition?.calories || 0} kcal</span>
                        </div>
                        <div className="text-[10px] text-surface-500 font-bold uppercase tracking-widest flex gap-2">
                          <span>P:{item.nutrition?.protein || 0}</span>
                          <span>C:{item.nutrition?.carbs || 0}</span>
                          <span>F:{item.nutrition?.fat || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      <div className="text-2xl font-black text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.1)]">
                        <span className="text-primary-500 text-lg mr-0.5">₹</span>{item.price}
                      </div>

                      {qty > 0 ? (
                        <div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/10 p-1 backdrop-blur-sm">
                          <button
                            onClick={() => addItem(item, -1)}
                            className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center hover:bg-surface-700 transition-colors text-white hover:text-red-400"
                          >
                            <HiMinus className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center font-black text-white">{qty}</span>
                          <button
                            onClick={() => handleAddToCart(item)}
                            className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center hover:opacity-90 transition-opacity text-white shadow-[0_0_10px_rgba(255,71,20,0.5)]"
                          >
                            <HiPlus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="btn-primary py-2.5 px-5 text-sm flex items-center gap-2 group-hover:shadow-[0_0_20px_rgba(255,71,20,0.5)] transition-all overflow-hidden relative"
                        >
                          <HiPlus className="w-4 h-4" />
                          <span className="font-bold tracking-wide">Add</span>
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
    </div>
  );
}
