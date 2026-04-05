import { useState, useEffect } from 'react';
import { menuAPI } from '../api';
import { HiPlus, HiOutlinePencil, HiOutlineTrash, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '', description: '', price: '', category: 'snacks', prepTime: '',
  isAvailable: true, isPoolable: true,
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
      fd.append('isPoolable', form.isPoolable);
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
      isPoolable: item.isPoolable,
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">📋 <span className="text-primary-400">Menu</span> Management</h1>
          <p className="text-surface-400 mt-1">{items.length} items</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-2 text-sm" id="add-menu-item">
          <HiPlus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass-card-static p-6 mb-6 animate-slideUp">
          <h3 className="font-semibold mb-4">{editId ? 'Edit' : 'Add'} Menu Item</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Item name" required id="form-name" />
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field" id="form-category">
                <option value="snacks">Snacks</option>
                <option value="meals">Meals</option>
                <option value="beverages">Beverages</option>
                <option value="desserts">Desserts</option>
              </select>
            </div>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Description" rows={2} id="form-desc" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="input-field" placeholder="Price ₹" required id="form-price" />
              <input type="number" value={form.prepTime} onChange={e => setForm({ ...form, prepTime: e.target.value })} className="input-field" placeholder="Prep time (min)" required id="form-prep" />
              <label className="flex items-center gap-2 text-sm text-surface-300">
                <input type="checkbox" checked={form.isAvailable} onChange={e => setForm({ ...form, isAvailable: e.target.checked })} className="rounded" /> Available
              </label>
              <label className="flex items-center gap-2 text-sm text-surface-300">
                <input type="checkbox" checked={form.isPoolable} onChange={e => setForm({ ...form, isPoolable: e.target.checked })} className="rounded" /> Poolable
              </label>
            </div>
            <p className="text-xs text-surface-500 uppercase tracking-wider font-semibold">Nutrition (per serving)</p>
            <div className="grid grid-cols-5 gap-2">
              {['calories', 'protein', 'carbs', 'fat', 'fiber'].map(n => (
                <input key={n} type="number" value={form.nutrition[n]} onChange={e => setForm({ ...form, nutrition: { ...form.nutrition, [n]: e.target.value } })} className="input-field text-xs" placeholder={n} />
              ))}
            </div>
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="input-field" placeholder="Tags (comma-separated)" />
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="input-field" />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm" id="form-submit">{editId ? 'Update' : 'Create'} Item</button>
              <button type="button" onClick={resetForm} className="btn-secondary text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item._id} className="glass-card-static p-4 flex items-center justify-between" id={`manage-item-${item._id}`}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center text-xl flex-shrink-0">
                {item.category === 'snacks' ? '🥟' : item.category === 'meals' ? '🍛' : item.category === 'beverages' ? '☕' : '🍮'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate text-surface-200">{item.name}</p>
                  {!item.isAvailable && <span className="badge badge-danger text-[9px]">Unavailable</span>}
                </div>
                <p className="text-xs text-surface-500">₹{item.price} • {item.prepTime}min • {item.nutrition?.calories}cal</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <button onClick={() => handleToggle(item._id)} className="p-2 rounded-lg hover:bg-white/5 text-surface-400" title="Toggle availability">
                {item.isAvailable ? <HiOutlineEye className="w-4 h-4" /> : <HiOutlineEyeOff className="w-4 h-4" />}
              </button>
              <button onClick={() => handleEdit(item)} className="p-2 rounded-lg hover:bg-white/5 text-surface-400" title="Edit">
                <HiOutlinePencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(item._id, item.name)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400" title="Delete">
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

