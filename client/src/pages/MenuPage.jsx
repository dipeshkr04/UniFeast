import { useState, useEffect, useCallback } from 'react';
import { menuAPI } from '../api';
import { useCart } from '../contexts/CartContext';
import { HiOutlineSearch, HiOutlineClock, HiOutlineFire, HiPlus, HiMinus, HiOutlineInformationCircle, HiOutlineX } from 'react-icons/hi';
import { MdOutlineLocalDining } from 'react-icons/md';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../contexts/AuthContext';

const Motion = motion;

const COLORS = ['#e06449', '#facc15', '#3b82f6', '#10b981'];

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
  const { addItem, items: cartItems } = useCart();
  const { user } = useAuth();

  const fetchMenu = useCallback(async () => {
    try {
      const params = { available: 'true' };
      if (category) params.category = category;
      if (search) params.search = search;
      const { data } = await menuAPI.getAll(params);
      setItems(data.data);
    } catch {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const handleAddToCart = (item) => {
    addItem(item);
    toast.success(`${item.name} added to cart`, { icon: '🛒' });
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
          <Motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tight text-white drop-shadow-2xl">
              Discover <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-accent-500">Flavors</span>
            </h1>
            <p className="text-surface-400 font-medium tracking-wide uppercase text-xs sm:text-sm mt-3">Elite Culinary Experience • IIIT Nagpur</p>
          </Motion.div>
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

                  </div>

                    <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-black text-white leading-tight mb-2 group-hover:text-primary-400 transition-colors line-clamp-1">{item.name}</h3>
                      <p className="text-xs text-surface-400 leading-relaxed line-clamp-2 min-h-[2.5rem] font-medium">{item.description}</p>

                      <div 
                        onClick={() => setSelectedItem(item)}
                        className="flex items-center gap-3 mt-4 mb-5 cursor-pointer group/nutri hover:bg-white/5 p-1 -ml-1 rounded-lg transition-colors"
                        title="View detailed nutrition breakdown"
                      >
                        <div className="flex items-center gap-1.5 text-xs text-white font-bold bg-white/5 py-1 px-2.5 rounded-md border border-white/5 group-hover/nutri:border-primary-500/30 transition-colors">
                          <HiOutlineFire className="w-4 h-4 text-orange-500 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" />
                          <span>{item.nutrition?.calories || 0} kcal</span>
                        </div>
                        <div className="text-[10px] text-surface-500 font-bold uppercase tracking-widest flex gap-2 items-center group-hover/nutri:text-surface-300 transition-colors">
                          <span>P:{item.nutrition?.protein || 0}</span>
                          <span>C:{item.nutrition?.carbs || 0}</span>
                          <span>F:{item.nutrition?.fat || 0}</span>
                          <HiOutlineInformationCircle className="w-3.5 h-3.5 ml-1 text-primary-400 opacity-0 group-hover/nutri:opacity-100 transition-opacity" />
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

      {/* Nutrition Details Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="glass-card-static w-full max-w-md p-6 relative border border-surface-700/50 shadow-2xl overflow-hidden"
            >
              {/* Background gradient blur */}
              <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />

              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-surface-800/50 hover:bg-surface-700 transition-colors text-surface-400 hover:text-white"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-surface-900 flex-shrink-0 border border-white/5">
                  {selectedItem.imageUrl ? (
                    <img src={selectedItem.imageUrl} alt={selectedItem.name} className="w-full h-full object-cover" />
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
                <h4 className="text-[10px] font-bold text-surface-400 uppercase tracking-widest absolute top-4 left-4 z-10">Calories</h4>
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
                    <p className="text-[9px] font-bold text-surface-500 uppercase tracking-widest mt-1">kcal</p>
                  </div>
                </div>
              </div>

              {/* Macro Bars */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-1">Macronutrients vs Daily Goals</h4>
                
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
                          <span className="text-[10px] font-semibold text-surface-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/5">{Math.round(pct)}%</span>
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

              <div className="mt-8 pt-5 border-t border-surface-800 flex gap-3">
                <button onClick={() => setSelectedItem(null)} className="btn-secondary flex-1 font-bold py-3 text-sm border border-surface-700/50">Close</button>
                <button 
                  onClick={() => {
                    handleAddToCart(selectedItem);
                    setSelectedItem(null);
                  }} 
                  className="btn-primary flex-1 flex justify-center items-center gap-2 font-bold py-3 text-sm shadow-[0_0_15px_rgba(255,71,20,0.3)] hover:shadow-[0_0_25px_rgba(255,71,20,0.5)] transition-shadow"
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
