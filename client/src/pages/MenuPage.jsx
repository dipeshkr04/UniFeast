import { useState, useEffect } from 'react';
import { menuAPI, poolAPI } from '../api';
import { useCart } from '../contexts/CartContext';
import { HiOutlineSearch, HiOutlineClock, HiOutlineFire, HiPlus, HiMinus } from 'react-icons/hi';
import { MdOutlineLocalDining } from 'react-icons/md';
import toast from 'react-hot-toast';

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
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
          <span className="text-primary-400">Campus</span> Menu
        </h1>
        <p className="text-surface-400 mt-1 text-sm">Fresh food from IIIT Nagpur canteen</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-12 py-3 px-4 rounded-xl w-full"
          placeholder="Search for food, drinks..."
          id="menu-search"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-2 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all min-h-[44px]
              ${category === cat.key ? 'tab-active' : 'bg-surface-800/40 text-surface-400 hover:bg-surface-700/40 border border-surface-700/30'}`}
            id={`cat-${cat.key || 'all'}`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card-static p-4">
              <div className="skeleton h-32 sm:h-40 mb-3 rounded-xl" />
              <div className="skeleton h-5 w-3/4 mb-2" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 glass-card-static max-w-md mx-auto">
          <MdOutlineLocalDining className="w-16 h-16 text-surface-600 mx-auto mb-4" />
          <p className="text-surface-400 text-lg font-medium">No items found</p>
          <p className="text-surface-500 text-sm mt-2">Try a different search or category</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {items.map(item => {
            const qty = getCartQty(item._id);
            const pool = pools[item._id];
            return (
              <div key={item._id} className="glass-card overflow-hidden group" id={`menu-item-${item._id}`}>
                {/* Image placeholder */}
                <div className="h-28 sm:h-36 lg:h-40 bg-gradient-to-br from-surface-800 to-surface-700 flex items-center justify-center relative overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl sm:text-5xl">{
                      item.category === 'snacks' ? '🥟' :
                      item.category === 'meals' ? '🍛' :
                      item.category === 'beverages' ? '☕' : '🍮'
                    }</span>
                  )}

                  {/* Prep time */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/60 rounded-lg text-[10px] sm:text-xs text-white backdrop-blur-sm">
                    <HiOutlineClock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>{item.prepTime} min</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3 sm:p-4">
                  <h3 className="font-semibold text-surface-100 text-sm sm:text-base leading-snug truncate">{item.name}</h3>
                  <p className="text-[11px] sm:text-xs text-surface-500 mt-1 line-clamp-2 leading-relaxed hidden sm:block">{item.description}</p>

                  {/* Nutrition mini */}
                  <div className="flex items-center gap-2 mt-2 mb-3">
                    <div className="flex items-center gap-1 text-[11px] sm:text-xs text-surface-400">
                      <HiOutlineFire className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400" />
                      <span>{item.nutrition?.calories || 0} cal</span>
                    </div>
                    <div className="text-[10px] sm:text-xs text-surface-500 hidden sm:block">
                      P:{item.nutrition?.protein || 0}g • C:{item.nutrition?.carbs || 0}g • F:{item.nutrition?.fat || 0}g
                    </div>
                  </div>

                  {/* Pool indicator */}
                  {pool && (
                    <div className="mb-3 p-2 rounded-lg bg-info/10 border border-info/20 text-[11px] sm:text-xs text-blue-300">
                      🤝 Pool active — {pool.currentSize} students, save {pool.savingsPercent}%
                    </div>
                  )}

                  {/* Price + Add */}
                  <div className="flex items-center justify-between pt-2 border-t border-surface-700/30">
                    <div className="text-lg sm:text-xl font-bold text-primary-400">₹{item.price}</div>
                    {qty > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => addItem(item, -1)}
                          className="w-8 h-8 rounded-lg bg-surface-700/50 flex items-center justify-center hover:bg-surface-600/50 transition-colors"
                        >
                          <HiMinus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center font-bold text-sm">{qty}</span>
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center hover:opacity-90 transition-opacity"
                        >
                          <HiPlus className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="btn-primary py-2 px-3 sm:px-4 text-xs sm:text-sm flex items-center gap-1 min-h-[36px] sm:min-h-[40px]"
                        id={`add-${item._id}`}
                      >
                        <HiPlus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
