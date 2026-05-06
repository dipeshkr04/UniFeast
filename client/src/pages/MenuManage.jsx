import { useState, useEffect } from 'react';
import { menuAPI } from '../api';
import { HiPlus, HiOutlinePencil, HiOutlineTrash, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '',
  description: '',
  price: '',
  category: 'snacks',
  prepTime: '',
  isAvailable: true,
  nutrition: { calories: '', protein: '', carbs: '', fat: '', fiber: '' },
  tags: '',
};

const categoryLabels = {
  snacks: 'Snacks',
  meals: 'Meals',
  beverages: 'Beverages',
  desserts: 'Desserts',
};

export default function MenuManage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);

  const availableCount = items.filter(item => item.isAvailable).length;
  const unavailableCount = items.length - availableCount;

  useEffect(() => { fetchMenu(); }, []);

  const fetchMenu = async () => {
    try {
      const { data } = await menuAPI.getAll();
      setItems(data.data);
    } catch {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('price', form.price);
      fd.append('category', form.category);
      fd.append('prepTime', form.prepTime);
      fd.append('isAvailable', form.isAvailable);

      fd.append('nutrition', JSON.stringify({
        calories: Number(form.nutrition.calories) || 0,
        protein: Number(form.nutrition.protein) || 0,
        carbs: Number(form.nutrition.carbs) || 0,
        fat: Number(form.nutrition.fat) || 0,
        fiber: Number(form.nutrition.fiber) || 0,
      }));
      fd.append('tags', JSON.stringify(form.tags.split(',').map(t => t.trim()).filter(Boolean)));
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
      description: item.description || '',
      price: item.price,
      category: item.category,
      prepTime: item.prepTime,
      isAvailable: item.isAvailable,
      nutrition: { ...emptyForm.nutrition, ...item.nutrition },
      tags: item.tags?.join(', ') || '',
    });
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
          <p className="text-xs text-surface-500 uppercase tracking-wider font-bold">Hidden</p>
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
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Paneer sandwich" required id="form-name" />
              </div>
              <div className="menu-field">
                <label className="text-surface-300">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field" id="form-category">
                  <option value="snacks">Snacks</option>
                  <option value="meals">Meals</option>
                  <option value="beverages">Beverages</option>
                  <option value="desserts">Desserts</option>
                </select>
              </div>
            </div>

            <div className="menu-field">
              <label className="text-surface-300">Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Short description for students" rows={3} id="form-desc" />
            </div>

            <div className="menu-form-grid menu-form-grid-three">
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
              <p className="text-xs text-surface-500 uppercase tracking-wider font-semibold mb-3">Nutrition per serving</p>
              <div className="menu-nutrition-grid">
                {['calories', 'protein', 'carbs', 'fat', 'fiber'].map(n => (
                  <div className="menu-field" key={n}>
                    <label className="text-surface-300 capitalize">{n}</label>
                    <input type="number" value={form.nutrition[n]} onChange={e => setForm({ ...form, nutrition: { ...form.nutrition, [n]: e.target.value } })} className="input-field" placeholder="0" />
                  </div>
                ))}
              </div>
            </div>

            <div className="menu-form-grid menu-form-grid-two">
              <div className="menu-field">
                <label className="text-surface-300">Tags</label>
                <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="input-field" placeholder="spicy, vegan, popular" />
              </div>
              <div className="menu-field">
                <label className="text-surface-300">Image</label>
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="input-field" />
              </div>
            </div>

            <div className="menu-form-actions">
              <button type="button" onClick={resetForm} className="btn-secondary text-[14px] min-h-[44px] px-5 py-2.5">Cancel</button>
              <button type="submit" className="btn-primary text-[14px] min-h-[48px] px-5 py-2.5" id="form-submit">
                {editId ? 'Update Item' : 'Create Item'}
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
        </div>

        {loading ? (
          <div className="menu-empty-state text-surface-500">Loading menu items...</div>
        ) : items.length === 0 ? (
          <div className="menu-empty-state text-surface-500">No menu items yet. Add your first item to get started.</div>
        ) : (
          <div className="menu-table">
            <div className="menu-table-head text-surface-500">
              <span>Item</span>
              <span>Category</span>
              <span>Price</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {items.map(item => (
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

                <div className="menu-row-category text-surface-300">{categoryLabels[item.category] || item.category}</div>
                <div className="menu-row-price text-surface-100">Rs. {item.price}</div>
                <div className="menu-row-status">
                  <span className={`badge text-xs ${item.isAvailable ? 'badge-success' : 'badge-danger'}`}>
                    {item.isAvailable ? 'Live' : 'Hidden'}
                  </span>
                </div>

                <div className="menu-row-actions">
                  <button onClick={() => handleToggle(item._id)} className="menu-icon-btn hover:bg-white/5 text-surface-400" title="Toggle availability">
                    {item.isAvailable ? <HiOutlineEye className="w-4 h-4" /> : <HiOutlineEyeOff className="w-4 h-4" />}
                  </button>
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
