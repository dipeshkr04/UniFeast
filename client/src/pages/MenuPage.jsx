import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense, memo, startTransition } from 'react';
import { menuAPI } from '../api';
import { useCart } from '../contexts/CartContext';
import { HiOutlineSearch, HiOutlineClock, HiOutlineFire, HiPlus, HiMinus, HiOutlineInformationCircle, HiOutlineX } from 'react-icons/hi';
import { MdOutlineLocalDining } from 'react-icons/md';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const COLORS = ['#e06449', '#facc15', '#3b82f6', '#10b981'];
const MENU_CACHE_KEY = 'unifeast_student_menu_items';
const MENU_PAGE_INCREMENT = 6;
const NutritionDonut = lazy(() => import('../components/menu/NutritionDonut.jsx'));
let menuItemsCache = null;

function getInitialVisibleCount() {
  if (typeof window === 'undefined') return 8;
  if (window.innerWidth >= 768) return 9;
  return 8;
}

function hasNumericStock(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && !value.trim()) return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0;
}

function getStockLeft(item) {
  const stock = item?.dailyStock?.quantity;
  return hasNumericStock(stock) ? Number(stock) : 0;
}

function getMaxOrder(item) {
  const parsed = Number(item?.maxOrder || 15);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 15;
}

function sortMenuItems(items = []) {
  return [...items].sort((a, b) => {
    const aInStock = getStockLeft(a) > 0;
    const bInStock = getStockLeft(b) > 0;
    if (aInStock !== bInStock) return aInStock ? -1 : 1;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function readCachedMenuItems() {
  if (menuItemsCache) return menuItemsCache;
  if (typeof window === 'undefined') return [];
  try {
    const cached = window.sessionStorage.getItem(MENU_CACHE_KEY);
    menuItemsCache = cached ? sortMenuItems(JSON.parse(cached)) : [];
    return menuItemsCache;
  } catch {
    return [];
  }
}

function writeCachedMenuItems(items) {
  menuItemsCache = items;
  if (typeof window === 'undefined') return;

  const commit = () => {
    try {
      window.sessionStorage.setItem(MENU_CACHE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage limits; in-memory cache still helps this session.
    }
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(commit, { timeout: 1200 });
  } else {
    window.setTimeout(commit, 0);
  }
}

function menuItemsMatch(previous = [], next = []) {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    const a = previous[index];
    const b = next[index];
    if (
      a?._id !== b?._id ||
      a?.name !== b?.name ||
      a?.description !== b?.description ||
      a?.category !== b?.category ||
      Number(a?.price || 0) !== Number(b?.price || 0) ||
      Number(a?.prepTime || 0) !== Number(b?.prepTime || 0) ||
      getStockLeft(a) !== getStockLeft(b) ||
      getMaxOrder(a) !== getMaxOrder(b) ||
      Number(a?.nutrition?.calories || 0) !== Number(b?.nutrition?.calories || 0) ||
      Number(a?.nutrition?.protein || 0) !== Number(b?.nutrition?.protein || 0) ||
      Number(a?.nutrition?.carbs || 0) !== Number(b?.nutrition?.carbs || 0) ||
      Number(a?.nutrition?.fat || 0) !== Number(b?.nutrition?.fat || 0) ||
      Number(a?.nutrition?.fiber || 0) !== Number(b?.nutrition?.fiber || 0)
    ) {
      return false;
    }
  }
  return true;
}

const categories = [
  { key: '', label: 'All', icon: '🍽️' },
  { key: 'snacks', label: 'Snacks', icon: '🥟' },
  { key: 'meals', label: 'Meals', icon: '🍛' },
  { key: 'beverages', label: 'Beverages', icon: '☕' },
  { key: 'desserts', label: 'Desserts', icon: '🍮' },
];

const fallbackIcons = {
  snacks: '🥟',
  meals: '🍛',
  beverages: '☕',
  desserts: '🍮',
};

const MenuItemCard = memo(function MenuItemCard({
  item,
  qty,
  stockLeft,
  maxOrder,
  isCartPending,
  onOpenDetails,
  onAdd,
  onReduce,
}) {
  const isSoldOut = stockLeft === 0;
  const isAtMaxOrder = qty >= maxOrder;

  return (
    <article className="student-menu-card group">
      <div className="student-menu-card-media bg-surface-900">
        <div className="student-menu-card-fallback">
          <span>{fallbackIcons[item.category] || fallbackIcons.desserts}</span>
        </div>

        <div className="student-menu-card-overlay" />

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
            onClick={() => onOpenDetails(item)}
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
                onClick={() => onReduce(item)}
                className="student-menu-qty-btn text-white"
                disabled={isCartPending}
              >
                <HiMinus className="w-4 h-4" />
              </button>
              <span className="student-menu-qty-value text-white">{qty}</span>
              <button
                onClick={() => onAdd(item)}
                className="student-menu-qty-btn is-plus text-white"
                disabled={isSoldOut || isAtMaxOrder || isCartPending}
                title={isAtMaxOrder ? `Maximum ${maxOrder} per order` : 'Add one more'}
              >
                <HiPlus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAdd(item)}
              className={`student-menu-add-btn btn-primary ${isSoldOut ? 'is-unavailable' : ''}`}
              disabled={isSoldOut || isCartPending}
            >
              <HiPlus className="w-4 h-4" />
              <span className="font-bold tracking-wide">{isCartPending ? 'Adding...' : 'Add'}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

export default function MenuPage() {
  const [items, setItems] = useState(() => readCachedMenuItems());
  const [loading, setLoading] = useState(() => readCachedMenuItems().length === 0);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(getInitialVisibleCount);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingCartIds, setPendingCartIds] = useState(() => new Set());
  const { addItem, items: cartItems } = useCart();
  const { user } = useAuth();
  const { socket } = useSocket() || {};
  const pendingCartIdsRef = useRef(pendingCartIds);
  const loadMoreRef = useRef(null);

  const fetchMenu = useCallback(async () => {
    try {
      const { data } = await menuAPI.getAll({ available: 'true' });
      const nextItems = sortMenuItems(data.data || []);
      setItems((previous) => {
        if (menuItemsMatch(previous, nextItems)) return previous;
        writeCachedMenuItems(nextItems);
        return nextItems;
      });
    } catch {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(search.trim());
        setVisibleCount(getInitialVisibleCount());
      });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    if (!socket) return undefined;
    let refreshTimer = null;
    const refreshMenuStock = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(fetchMenu, 150);
    };
    socket.on('menu:stockChanged', refreshMenuStock);
    return () => {
      window.clearTimeout(refreshTimer);
      socket.off('menu:stockChanged', refreshMenuStock);
    };
  }, [socket, fetchMenu]);

  const cartQtyById = useMemo(() => {
    const map = new Map();
    cartItems.forEach((entry) => {
      const id = entry.menuItem?._id;
      if (id) map.set(id, Number(entry.quantity || 0));
    });
    return map;
  }, [cartItems]);

  const cartQtyByIdRef = useRef(cartQtyById);

  useEffect(() => {
    pendingCartIdsRef.current = pendingCartIds;
  }, [pendingCartIds]);

  useEffect(() => {
    cartQtyByIdRef.current = cartQtyById;
  }, [cartQtyById]);

  const filteredItems = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    return items.filter((item) => {
      if (category && item.category !== category) return false;
      if (!query) return true;
      return [item.name, item.description, item.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [items, category, debouncedSearch]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  );
  const hasMoreItems = visibleCount < filteredItems.length;

  const loadMoreItems = useCallback(() => {
    startTransition(() => {
      setVisibleCount((count) => Math.min(count + MENU_PAGE_INCREMENT, filteredItems.length));
    });
  }, [filteredItems.length]);

  useEffect(() => {
    if (loading || !hasMoreItems || typeof window === 'undefined') return undefined;
    const frameId = window.requestAnimationFrame(() => {
      const pageHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      if (pageHeight <= viewportHeight + 360) loadMoreItems();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [hasMoreItems, loadMoreItems, loading, visibleCount]);

  useEffect(() => {
    if (!hasMoreItems) return undefined;
    const node = loadMoreRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) loadMoreItems();
      },
      { rootMargin: '280px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreItems, loadMoreItems]);

  const setItemPending = useCallback((itemId, isPending) => {
    const next = new Set(pendingCartIdsRef.current);
    if (isPending) next.add(itemId);
    else next.delete(itemId);
    pendingCartIdsRef.current = next;
    setPendingCartIds(next);
  }, []);

  const handleOpenDetails = useCallback((item) => {
    setSelectedItem(item);
  }, []);

  const handleAddToCart = useCallback(async (item) => {
    const stockLeft = getStockLeft(item);
    const currentQty = cartQtyByIdRef.current.get(item._id) || 0;
    const maxOrder = getMaxOrder(item);
    if (pendingCartIdsRef.current.has(item._id)) return;
    if (currentQty >= maxOrder) {
      toast.error(`Maximum ${maxOrder} ${item.name} can be ordered at once`);
      return;
    }
    if (stockLeft <= 0) {
      toast.error(stockLeft === 0 ? `${item.name} is currently unavailable` : `Only ${stockLeft} left today`);
      return;
    }

    setItemPending(item._id, true);
    try {
      await addItem(item);
      toast.success(`${item.name} added to cart`, { icon: '🛒' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to reserve this item');
    } finally {
      setItemPending(item._id, false);
    }
  }, [addItem, setItemPending]);

  const handleReduceCart = useCallback(async (item) => {
    if (pendingCartIdsRef.current.has(item._id)) return;
    setItemPending(item._id, true);
    try {
      await addItem(item, -1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update cart');
    } finally {
      setItemPending(item._id, false);
    }
  }, [addItem, setItemPending]);

  return (
    <div className="student-menu-page">
      <div className="student-menu-header">
        <div className="student-menu-title-block">
          <div>
            <h1 className="student-menu-title text-white">
              Discover <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-accent-500">Flavors</span>
            </h1>
            <p className="student-menu-subtitle text-surface-400">Elite Culinary Experience • IIIT Nagpur</p>
          </div>
        </div>
      </div>

      <div className="student-menu-categories scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => {
              startTransition(() => {
                setCategory(cat.key);
                setVisibleCount(getInitialVisibleCount());
              });
            }}
            className={`student-menu-category-tab ${category === cat.key ? 'is-active' : ''}`}
          >
            <span className="student-menu-category-icon">{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      <div className="student-menu-search group">
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
      </div>

      {loading ? (
        <div className="student-menu-grid">
          {[...Array(getInitialVisibleCount())].map((_, i) => (
            <div key={i} className="student-menu-skeleton-card glass-card-static">
              <div className="skeleton student-menu-skeleton-media" />
              <div className="skeleton student-menu-skeleton-title" />
              <div className="skeleton student-menu-skeleton-line" />
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="student-menu-empty glass-card">
          <MdOutlineLocalDining className="student-menu-empty-icon text-surface-700" />
          <p className="student-menu-empty-title text-white">No items found</p>
          <p className="student-menu-empty-copy text-surface-400">We couldn't find anything matching your criteria.</p>
        </div>
      ) : (
        <>
          <div className="student-menu-grid">
            {visibleItems.map((item) => (
              <MenuItemCard
                key={item._id}
                item={item}
                qty={cartQtyById.get(item._id) || 0}
                stockLeft={getStockLeft(item)}
                maxOrder={getMaxOrder(item)}
                isCartPending={pendingCartIds.has(item._id)}
                onOpenDetails={handleOpenDetails}
                onAdd={handleAddToCart}
                onReduce={handleReduceCart}
              />
            ))}
          </div>
          {hasMoreItems && (
            <div ref={loadMoreRef} className="student-menu-load-more">
              <button type="button" className="student-menu-load-more-btn" onClick={loadMoreItems}>
                Load more items
              </button>
              <span>{visibleItems.length} of {filteredItems.length}</span>
            </div>
          )}
        </>
      )}

      {selectedItem && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setSelectedItem(null)}
        >
          <div
              onClick={e => e.stopPropagation()}
              className="glass-card-static w-full max-w-[480px] p-6 lg:p-8 relative border border-surface-700/50 shadow-2xl overflow-y-auto max-h-[calc(100vh-32px)] rounded-2xl lg:rounded-[20px] z-[2001]"
            >
              <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />

              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-800/50 hover:bg-surface-700 transition-colors text-surface-400 hover:text-white flex items-center justify-center"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-surface-900 flex-shrink-0 border border-white/5">
                  <div className="w-full h-full flex items-center justify-center text-3xl">
                    {fallbackIcons[selectedItem.category] || '🍲'}
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white line-clamp-1">{selectedItem.name}</h3>
                  <p className="text-sm font-medium text-surface-400 capitalize">{selectedItem.category}</p>
                </div>
              </div>

              <div className="glass-card-static p-4 mb-5 flex flex-col items-center relative border border-transparent shadow-inner">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-widest absolute top-4 left-4 z-10">Calories</h4>
                <div className="h-36 w-36 relative mt-2">
                  <Suspense fallback={<div className="nutrition-donut-fallback" />}>
                    <NutritionDonut calories={selectedItem.nutrition?.calories || 0} />
                  </Suspense>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <HiOutlineFire className="w-5 h-5 text-primary-400 drop-shadow-[0_0_5px_rgba(224,100,73,0.8)]" />
                    <p className="text-2xl font-black text-white leading-none mt-1">{selectedItem.nutrition?.calories || 0}</p>
                    <p className="text-xs font-bold text-surface-500 uppercase tracking-widest mt-1">kcal</p>
                  </div>
                </div>
              </div>

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
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: macro.color, boxShadow: `0 0 10px ${macro.color}80` }}
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
          </div>
        </div>
        )}
    </div>
  );
}
