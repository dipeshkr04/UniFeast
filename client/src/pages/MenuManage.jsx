import { useState, useEffect, useCallback, useMemo } from 'react';
import { menuAPI } from '../api';
import { HiPlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSearch } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useSocket } from '../contexts/SocketContext';

const emptyForm = {
  name: '',
  price: '',
  category: 'snacks',
  prepTime: '',
  isAvailable: true,
  nutrition: { calories: '', protein: '', carbs: '', fat: '', fiber: '' },
};

const categoryLabels = {
  snacks: 'Snacks',
  meals: 'Meals',
  beverages: 'Beverages',
  desserts: 'Desserts',
};

function hasNumericStock(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && !value.trim()) return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0;
}

function sortKitchenItems(list = []) {
  return [...list].sort((a, b) => {
    if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  });
}

export default function MenuManage() {
  const { socket } = useSocket() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [analyzingNutrition, setAnalyzingNutrition] = useState(false);
  const [nutritionFetched, setNutritionFetched] = useState(false);
  const [stockDrafts, setStockDrafts] = useState({});
  const [menuSearch, setMenuSearch] = useState('');

  const availableCount = items.filter(item => item.isAvailable).length;
  const unavailableCount = items.length - availableCount;
  const visibleItems = useMemo(() => {
    const query = menuSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => String(item.name || '').toLowerCase().includes(query));
  }, [items, menuSearch]);

  const getStockDisplay = useCallback((item) => {
    const quantity = item?.dailyStock?.quantity;
    return hasNumericStock(quantity) ? String(quantity) : '0';
  }, []);

  const fetchMenu = useCallback(async () => {
    try {
      const { data } = await menuAPI.getAll();
      const sortedItems = sortKitchenItems(data.data);
      setItems(sortedItems);
      setStockDrafts(Object.fromEntries(
        sortedItems.map((item) => [item._id, getStockDisplay(item)])
      ));
    } catch {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, [getStockDisplay]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  useEffect(() => {
    if (!socket) return undefined;
    const refreshMenu = () => fetchMenu();
    socket.on('menu:stockChanged', refreshMenu);
    return () => socket.off('menu:stockChanged', refreshMenu);
  }, [socket, fetchMenu]);

  const normalizeStockInput = (value) => {
    const next = String(value || '').trim();
    if (!next) return '0';
    if (!/^\d+$/.test(next)) return null;
    return next;
  };

  const handleStockDraftChange = (id, value) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setStockDrafts(prev => ({ ...prev, [id]: cleaned }));
  };

  const handleStockCommit = async (item) => {
    const normalized = normalizeStockInput(stockDrafts[item._id]);
    if (normalized === null) {
      toast.error('Avl. Stock must be a whole number');
      setStockDrafts(prev => ({ ...prev, [item._id]: getStockDisplay(item) }));
      return;
    }

    try {
      const { data } = await menuAPI.updateStock(item._id, normalized);
      setItems(prev => sortKitchenItems(prev.map(row => row._id === item._id ? data.data : row)));
      setStockDrafts(prev => ({ ...prev, [item._id]: getStockDisplay(data.data) }));
      toast.success('Available stock updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Stock update failed');
      setStockDrafts(prev => ({ ...prev, [item._id]: getStockDisplay(item) }));
    }
  };

  const applyNutrition = (nutrition = {}) => {
    setForm(prev => ({
      ...prev,
      nutrition: {
        calories: nutrition.calories ?? '',
        protein: nutrition.protein ?? '',
        carbs: nutrition.carbs ?? '',
        fat: nutrition.fat ?? '',
        fiber: nutrition.fiber ?? '',
      },
    }));
    setNutritionFetched(true);
  };

  const fetchNutrition = async ({ name = form.name, file = imageFile, showErrors = true } = {}) => {
    const itemName = String(name || '').trim();
    if (!itemName) return null;

    setAnalyzingNutrition(true);
    try {
      const fd = new FormData();
      fd.append('name', itemName);
      if (file) fd.append('image', file);

      const { data } = await menuAPI.analyzeNutrition(fd);
      if (data.success && data.data?.nutrition) {
        applyNutrition(data.data.nutrition);
        return data.data;
      }
      return null;
    } catch (err) {
      setNutritionFetched(false);
      if (showErrors) {
        toast.error(err.response?.data?.message || 'Nutrition lookup failed');
      }
      return null;
    } finally {
      setAnalyzingNutrition(false);
    }
  };

  const handleNameChange = (value) => {
    setForm({
      ...form,
      name: value,
      nutrition: emptyForm.nutrition,
    });
    setNutritionFetched(false);
  };

  const handleImageChange = async (file) => {
    setImageFile(file || null);
    setImagePreview(file ? URL.createObjectURL(file) : '');
    setNutritionFetched(false);
    if (file && form.name.trim()) {
      await fetchNutrition({ file });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!nutritionFetched) {
        await fetchNutrition({ showErrors: false });
      }

      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('price', form.price);
      fd.append('category', form.category);
      fd.append('prepTime', form.prepTime);
      fd.append('isAvailable', form.isAvailable);
      if (imageFile) fd.append('image', imageFile);

      if (editId) {
        await menuAPI.update(editId, fd);
        toast.success('Item updated');
      } else {
        await menuAPI.create(fd);
        toast.success('Item created');
      }
      resetForm();
      fetchMenu();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleEdit = (item) => {
    setEditId(item._id);
    setForm({
      name: item.name,
      price: item.price,
      category: item.category,
      prepTime: item.prepTime,
      isAvailable: item.isAvailable,
      nutrition: { ...emptyForm.nutrition, ...item.nutrition },
    });
    setImageFile(null);
    setImagePreview(item.imageUrl || '');
    setNutritionFetched(true);
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await menuAPI.delete(id);
      toast.success('Deleted');
      fetchMenu();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleToggle = async (id) => {
    try {
      await menuAPI.toggle(id);
      fetchMenu();
    } catch {
      toast.error('Toggle failed');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview('');
    setAnalyzingNutrition(false);
    setNutritionFetched(false);
  };

  return (
    <div className="menu-manage-page animate-fadeIn">
      <div className="menu-manage-header">
        <div className="min-w-0">
          <p className="text-xs text-surface-500 uppercase tracking-[0.2em] font-bold mb-2">Kitchen Tools</p>
          <h1 className="text-[clamp(22px,5vw,32px)] font-semibold leading-tight tracking-normal">
            <span className="text-primary-400">Menu</span> Management
          </h1>
          <p className="text-surface-400 mt-2 text-[14px]">Create, edit, and control live availability for kitchen items.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary menu-add-btn text-[14px]" id="add-menu-item">
          <HiPlus className="w-4 h-4" /> Add Item
        </button>
      </div>

      <div className="menu-summary-grid">
        <div className="menu-summary-card glass-card-static">
          <p className="text-xs text-surface-500 uppercase tracking-wider font-bold">Total Items</p>
          <p className="text-2xl font-black text-white mt-1">{items.length}</p>
        </div>
        <div className="menu-summary-card glass-card-static">
          <p className="text-xs text-surface-500 uppercase tracking-wider font-bold">Available</p>
          <p className="text-2xl font-black text-success mt-1">{availableCount}</p>
        </div>
        <div className="menu-summary-card glass-card-static">
          <p className="text-xs text-surface-500 uppercase tracking-wider font-bold">Hide</p>
          <p className="text-2xl font-black text-surface-300 mt-1">{unavailableCount}</p>
        </div>
      </div>

      {showForm && (
        <div className="menu-form-card glass-card-static animate-slideUp">
          <div className="menu-form-header">
            <div>
              <h3 className="font-semibold text-lg">{editId ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
              <p className="text-[14px] text-surface-400 mt-1">Keep names short and use realistic prep times for better kitchen flow.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="menu-manage-form">
            <div className="menu-form-grid menu-form-grid-two">
              <div className="menu-field">
                <label className="text-surface-300">Item name</label>
                <input
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  onBlur={() => fetchNutrition()}
                  className="input-field"
                  placeholder="Paneer sandwich"
                  required
                  id="form-name"
                />
              </div>
              <div className="menu-field">
                <label className="text-surface-300">Image</label>
                <div className="menu-image-input-row">
                  <input type="file" accept="image/*" onChange={e => handleImageChange(e.target.files[0])} className="input-field" />
                  {imagePreview && <img src={imagePreview} alt={form.name || 'Menu item preview'} className="menu-image-preview" />}
                </div>
              </div>
            </div>

            <div className="menu-form-grid menu-form-grid-three">
              <div className="menu-field">
                <label className="text-surface-300">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field" id="form-category">
                  <option value="snacks">Snacks</option>
                  <option value="meals">Meals</option>
                  <option value="beverages">Beverages</option>
                  <option value="desserts">Desserts</option>
                </select>
              </div>
              <div className="menu-field">
                <label className="text-surface-300">Price</label>
                <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="input-field" placeholder="Rs." required id="form-price" />
              </div>
              <div className="menu-field">
                <label className="text-surface-300">Prep time</label>
                <input type="number" value={form.prepTime} onChange={e => setForm({ ...form, prepTime: e.target.value })} className="input-field" placeholder="Minutes" required id="form-prep" />
              </div>
              <label className="menu-availability-toggle glass-card-static text-surface-300">
                <input type="checkbox" checked={form.isAvailable} onChange={e => setForm({ ...form, isAvailable: e.target.checked })} className="rounded" />
                <span>Available on menu</span>
              </label>
            </div>

            <div>
              <div className="menu-nutrition-heading">
                <p className="text-xs text-surface-500 uppercase tracking-wider font-semibold">Nutrition per serving</p>
                <span className={`menu-ai-status ${nutritionFetched ? 'is-ready' : ''}`}>
                  {analyzingNutrition ? 'Analyzing with Ollama...' : nutritionFetched ? 'AI locked' : 'Auto fetched'}
                </span>
              </div>
              <div className="menu-nutrition-grid">
                {['calories', 'protein', 'carbs', 'fat', 'fiber'].map(n => (
                  <div className="menu-field" key={n}>
                    <label className="text-surface-300 capitalize">{n}</label>
                    <input
                      type="number"
                      value={form.nutrition[n]}
                      readOnly
                      className="input-field menu-nutrition-input-locked"
                      placeholder={analyzingNutrition ? '...' : '0'}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="menu-form-actions">
              <button type="button" onClick={resetForm} className="btn-secondary text-[14px] min-h-[44px] px-5 py-2.5">Cancel</button>
              <button type="submit" className="btn-primary text-[14px] min-h-[48px] px-5 py-2.5" id="form-submit" disabled={analyzingNutrition}>
                {analyzingNutrition ? 'Analyzing...' : editId ? 'Update Item' : 'Create Item'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="menu-list-card glass-card-static">
        <div className="menu-list-header border-b border-surface-800">
          <div>
            <h3 className="font-semibold text-lg text-white">Menu Items</h3>
            <p className="text-[14px] text-surface-400 mt-1">Toggle availability or edit item details from this list.</p>
          </div>
          {!loading && items.length > 0 && (
            <div className="menu-list-search">
              <HiOutlineSearch className="menu-list-search-icon" />
              <input
                type="text"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="menu-list-search-input"
                placeholder="Search menu item by name"
                aria-label="Search menu item by name"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="menu-empty-state text-surface-500">Loading menu items...</div>
        ) : items.length === 0 ? (
          <div className="menu-empty-state text-surface-500">No menu items yet. Add your first item to get started.</div>
        ) : visibleItems.length === 0 ? (
          <div className="menu-empty-state text-surface-500">No menu items match your search.</div>
        ) : (
          <div className="menu-table">
            <div className="menu-table-head text-surface-500">
              <span>Item</span>
              <span>Price</span>
              <span>Status</span>
              <span>Avl. Stock</span>
              <span>Actions</span>
            </div>

            {visibleItems.map(item => (
              <div key={item._id} className="menu-manage-row" id={`manage-item-${item._id}`}>
                <div className="menu-item-main">
                  <div className="menu-category-mark bg-surface-800 text-primary-400 border border-surface-700">
                    {(categoryLabels[item.category] || item.category || 'Item').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold truncate text-surface-100">{item.name}</p>
                      {!item.isAvailable && <span className="badge badge-danger text-xs shrink-0">Unavailable</span>}
                    </div>
                    <p className="text-xs text-surface-500 mt-1 truncate">
                      {item.prepTime} min prep - {item.nutrition?.calories || 0} cal
                    </p>
                  </div>
                </div>

                <div className="menu-row-price text-surface-100">Rs. {item.price}</div>
                <div className="menu-row-status">
                  <button
                    type="button"
                    onClick={() => handleToggle(item._id)}
                    className={`badge text-xs menu-status-toggle ${item.isAvailable ? 'badge-success' : 'badge-danger'}`}
                    title={item.isAvailable ? 'Click to hide item' : 'Click to make item live'}
                  >
                    {item.isAvailable ? 'Live' : 'Hide'}
                  </button>
                </div>

                <div className="menu-row-stock">
                  <input
                    value={stockDrafts[item._id] ?? getStockDisplay(item)}
                    onChange={e => handleStockDraftChange(item._id, e.target.value)}
                    onBlur={() => handleStockCommit(item)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        setStockDrafts(prev => ({ ...prev, [item._id]: getStockDisplay(item) }));
                        e.currentTarget.blur();
                      }
                    }}
                    className="menu-stock-input"
                    disabled={!item.isAvailable}
                    aria-label={`${item.name} available stock`}
                    title={item.isAvailable ? 'Enter a whole number' : 'Make item live to edit stock'}
                  />
                </div>

                <div className="menu-row-actions">
                  <button onClick={() => handleEdit(item)} className="menu-icon-btn hover:bg-white/5 text-surface-400" title="Edit">
                    <HiOutlinePencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(item._id, item.name)} className="menu-icon-btn hover:bg-red-500/10 text-red-400" title="Delete">
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
