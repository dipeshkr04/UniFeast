import { useState, useEffect } from 'react';
import { menuAPI } from '../api';
import { HiPlus, HiOutlinePencil, HiOutlineTrash, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '', description: '', price: '', category: 'snacks', prepTime: '',
  isAvailable: true,
  nutrition: { calories: '', protein: '', carbs: '', fat: '', fiber: '' },
  tags: '',
};

export default function MenuManage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => { fetchMenu(); }, []);

  const fetchMenu = async () => {
    try {
      const { data } = await menuAPI.getAll();
      setItems(data.data);
    } catch { toast.error('Failed to load menu'); }
    finally { setLoading(false); }
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

      nutrition: { ...item.nutrition },
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
    } catch { toast.error('Delete failed'); }
  };

  const handleToggle = async (id) => {
    try {
      await menuAPI.toggle(id);
      fetchMenu();
    } catch { toast.error('Toggle failed'); }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setImageFile(null);
  };

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight">📋 <span className="text-primary-400">Menu</span> Management</h1>
          <p className="text-surface-400 mt-2 text-sm">{items.length} items</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-2 text-sm min-h-[44px] px-5 py-2.5 self-start" id="add-menu-item">
          <HiPlus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass-card-static p-4 md:p-6 mb-6 md:mb-8 animate-slideUp">
          <h3 className="font-semibold mb-4 text-lg">{editId ? 'Edit' : 'Add'} Menu Item</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field py-3 px-4 rounded-xl" placeholder="Item name" required id="form-name" />
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field py-3 px-4 rounded-xl" id="form-category">
                <option value="snacks">Snacks</option>
                <option value="meals">Meals</option>
                <option value="beverages">Beverages</option>
                <option value="desserts">Desserts</option>
              </select>
            </div>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field py-3 px-4 rounded-xl" placeholder="Description" rows={2} id="form-desc" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="input-field py-3 px-4 rounded-xl" placeholder="Price ₹" required id="form-price" />
              <input type="number" value={form.prepTime} onChange={e => setForm({ ...form, prepTime: e.target.value })} className="input-field py-3 px-4 rounded-xl" placeholder="Prep (min)" required id="form-prep" />
              <label className="flex items-center gap-2 text-sm text-surface-300 min-h-[44px]">
                <input type="checkbox" checked={form.isAvailable} onChange={e => setForm({ ...form, isAvailable: e.target.checked })} className="rounded" /> Available
              </label>
            </div>
            <p className="text-xs text-surface-500 uppercase tracking-wider font-semibold pt-2">Nutrition (per serving)</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {['calories', 'protein', 'carbs', 'fat', 'fiber'].map(n => (
                <input key={n} type="number" value={form.nutrition[n]} onChange={e => setForm({ ...form, nutrition: { ...form.nutrition, [n]: e.target.value } })} className="input-field text-xs py-2.5 px-3 rounded-lg" placeholder={n} />
              ))}
            </div>
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="input-field py-3 px-4 rounded-xl" placeholder="Tags (comma-separated)" />
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="input-field py-2.5 px-4 rounded-xl" />
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary text-sm min-h-[44px] px-5 py-2.5" id="form-submit">{editId ? 'Update' : 'Create'} Item</button>
              <button type="button" onClick={resetForm} className="btn-secondary text-sm min-h-[44px] px-5 py-2.5">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-3">
        {items.map(item => (
          <div key={item._id} className="glass-card-static p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" id={`manage-item-${item._id}`}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center text-xl shrink-0">
                {item.category === 'snacks' ? '🥟' : item.category === 'meals' ? '🍛' : item.category === 'beverages' ? '☕' : '🍮'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate text-surface-200">{item.name}</p>
                  {!item.isAvailable && <span className="badge badge-danger text-[9px] shrink-0">Unavailable</span>}
                </div>
                <p className="text-xs text-surface-500 mt-0.5">₹{item.price} • {item.prepTime}min • {item.nutrition?.calories}cal</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 ml-15 sm:ml-0">
              <button onClick={() => handleToggle(item._id)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 text-surface-400" title="Toggle availability">
                {item.isAvailable ? <HiOutlineEye className="w-4 h-4" /> : <HiOutlineEyeOff className="w-4 h-4" />}
              </button>
              <button onClick={() => handleEdit(item)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 text-surface-400" title="Edit">
                <HiOutlinePencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(item._id, item.name)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-red-400" title="Delete">
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
