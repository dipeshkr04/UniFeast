import { useCallback, useEffect, useState } from 'react';
import { outsideFoodAPI } from '../api';
import {
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineTrash,
  HiOutlineX,
} from 'react-icons/hi';
import { MdOutlineRestaurant } from 'react-icons/md';
import toast from 'react-hot-toast';

const emptyRestaurant = {
  name: '',
  minPoolAmount: '700',
  orderWindow: '1:00 PM - 7:30 PM',
  location: '',
  contactNumber: '',
  menuLink: '',
  active: true,
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function compactTimeLabel(value) {
  return String(value || '')
    .trim()
    .replace(/:00\b/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function formatOrderWindow(value) {
  const text = String(value || '').trim();
  if (!text) return 'Window not set';
  const [from, to] = text.split(/\s*-\s*/);
  if (!from || !to) return text;
  return `${compactTimeLabel(from)} to ${compactTimeLabel(to)}`;
}

function restaurantToForm(restaurant = {}) {
  return {
    name: restaurant.name || '',
    minPoolAmount: String(restaurant.minPoolAmount || '700'),
    orderWindow: restaurant.orderWindow || '1:00 PM - 7:30 PM',
    location: restaurant.location || '',
    contactNumber: restaurant.contactNumber || '',
    menuLink: restaurant.menuLink || '',
    active: restaurant.active !== false,
  };
}

function RestaurantThumb({ restaurant }) {
  const [failed, setFailed] = useState(false);
  if (!restaurant.image || failed) return <MdOutlineRestaurant />;

  return (
    <img
      src={restaurant.image}
      alt={restaurant.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function RestaurantFormModal({
  form,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div className="outside-food-modal-backdrop" onClick={onClose}>
      <form
        className="outside-food-join-modal restaurant-form-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="outside-food-modal-header">
          <div>
            <span>{editing ? 'Edit Restaurant' : 'Add Restaurant'}</span>
            <h2>{editing ? 'Update feast highlight' : 'New feast highlight'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close restaurant form">
            <HiOutlineX />
          </button>
        </div>

        <div className="restaurant-form-grid">
          <label className="outside-food-field">
            <span>Name</span>
            <input value={form.name} onChange={(event) => onChange('name', event.target.value)} required />
          </label>
          <label className="outside-food-field">
            <span>Location</span>
            <input value={form.location} onChange={(event) => onChange('location', event.target.value)} placeholder="Sitabuldi, Nagpur" required />
          </label>
          <label className="outside-food-field">
            <span>Order window</span>
            <input value={form.orderWindow} onChange={(event) => onChange('orderWindow', event.target.value)} placeholder="1:00 PM - 7:30 PM" required />
          </label>
          <label className="outside-food-field">
            <span>Contact number</span>
            <input value={form.contactNumber} onChange={(event) => onChange('contactNumber', event.target.value)} required />
          </label>
          <label className="outside-food-field">
            <span>Menu link</span>
            <input value={form.menuLink} onChange={(event) => onChange('menuLink', event.target.value)} placeholder="https://..." />
          </label>
          <label className="outside-food-field">
            <span>Minimum order</span>
            <input type="number" min="1" value={form.minPoolAmount} onChange={(event) => onChange('minPoolAmount', event.target.value)} required />
          </label>
        </div>

        <div className="restaurant-form-footer">
          <label className="outside-food-admin-check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => onChange('active', event.target.checked)}
            />
            Show in Find Your Feast
          </label>
          <button type="submit" className="outside-food-primary-btn restaurant-submit-btn" disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Restaurant'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminOutsideFoodPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantForm, setRestaurantForm] = useState(emptyRestaurant);
  const [loading, setLoading] = useState(true);
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [actioningRestaurant, setActioningRestaurant] = useState('');
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const restaurantResponse = await outsideFoodAPI.restaurants.getAll({ includeInactive: true });
      setRestaurants(restaurantResponse.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load restaurants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateRestaurantForm = (field, value) => {
    setRestaurantForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleRestaurantSubmit = async (event) => {
    event.preventDefault();
    setSavingRestaurant(true);
    try {
      const payload = {
        ...restaurantForm,
        minPoolAmount: Number(restaurantForm.minPoolAmount),
        image: '',
        cuisineTags: '',
        estimatedDeliveryTime: '',
        whatsappLink: '',
        pickupPoints: '',
      };
      const { data } = editingRestaurant
        ? await outsideFoodAPI.restaurants.update(editingRestaurant._id, payload)
        : await outsideFoodAPI.restaurants.create(payload);

      setRestaurants((previous) => (
        editingRestaurant
          ? previous.map((item) => (item._id === editingRestaurant._id ? data.data : item))
          : [data.data, ...previous]
      ));
      setRestaurantForm(emptyRestaurant);
      setEditingRestaurant(null);
      setFormOpen(false);
      toast.success(editingRestaurant ? 'Restaurant updated' : 'Restaurant highlight added');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save restaurant');
    } finally {
      setSavingRestaurant(false);
    }
  };

  const toggleRestaurant = async (restaurant) => {
    setActioningRestaurant(`toggle-${restaurant._id}`);
    try {
      const { data } = await outsideFoodAPI.restaurants.update(restaurant._id, {
        active: !restaurant.active,
      });
      setRestaurants((previous) => previous.map((item) => (
        item._id === restaurant._id ? data.data : item
      )));
      toast.success(data.data.active ? 'Restaurant activated' : 'Restaurant hidden');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update restaurant');
    } finally {
      setActioningRestaurant('');
    }
  };

  const openCreateForm = () => {
    setRestaurantForm(emptyRestaurant);
    setEditingRestaurant(null);
    setFormOpen(true);
  };

  const openEditForm = (restaurant) => {
    setRestaurantForm(restaurantToForm(restaurant));
    setEditingRestaurant(restaurant);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (savingRestaurant) return;
    setFormOpen(false);
    setEditingRestaurant(null);
    setRestaurantForm(emptyRestaurant);
  };

  const deleteRestaurant = async (restaurant) => {
    const ok = window.confirm(`Delete ${restaurant.name}? This will remove it from Find Your Feast.`);
    if (!ok) return;

    setActioningRestaurant(`delete-${restaurant._id}`);
    try {
      await outsideFoodAPI.restaurants.delete(restaurant._id);
      setRestaurants((previous) => previous.filter((item) => item._id !== restaurant._id));
      toast.success('Restaurant deleted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete restaurant');
    } finally {
      setActioningRestaurant('');
    }
  };

  return (
    <div className="outside-food-admin-page">
      <header className="outside-food-admin-header">
        <div>
          <span>Restaurant Highlights</span>
          <h1>Find Your Feast data</h1>
          <p>Add restaurants students can browse from the Find Your Feast section. Pool creation stays fully student-managed.</p>
        </div>
        <div className="outside-food-header-actions">
          <button type="button" className="outside-food-secondary-btn" onClick={() => loadData({ quiet: true })}>
            <HiOutlineRefresh />
            Refresh
          </button>
          <button type="button" className="outside-food-primary-btn outside-food-create-btn" onClick={openCreateForm}>
            <HiOutlinePlus />
            Add
          </button>
        </div>
      </header>

      <section className="outside-food-admin-section">
        <div className="outside-food-admin-section-head">
          <div>
            <h2>Restaurants</h2>
            <p className="restaurant-section-copy">Existing entries shown to students in Find Your Feast.</p>
          </div>
          <span className="restaurant-count-pill"><strong>{restaurants.length}</strong> configured</span>
        </div>

        {loading ? (
          <div className="outside-food-skeleton" />
        ) : restaurants.length === 0 ? (
          <div className="outside-food-empty">
            <MdOutlineRestaurant />
            <h2>No restaurants added</h2>
            <p>Add restaurant highlights so students can browse them from Find Your Feast.</p>
            <button type="button" className="outside-food-primary-btn outside-food-create-btn" onClick={openCreateForm}>
              <HiOutlinePlus />
              Add Restaurant
            </button>
          </div>
        ) : (
          <div className="outside-food-admin-list restaurant-admin-list">
            {restaurants.map((restaurant) => (
              <article key={restaurant._id} className="outside-food-admin-restaurant">
                <div className="outside-food-admin-thumb">
                  <RestaurantThumb restaurant={restaurant} />
                </div>
                <div>
                  <strong>{restaurant.name}</strong>
                  <p>{restaurant.location || 'Location not added'} - {formatOrderWindow(restaurant.orderWindow)}</p>
                  <p>{restaurant.cuisineTags?.join(', ') || 'No cuisine tags'} - Minimum {formatCurrency(restaurant.minPoolAmount)}</p>
                </div>
                <div className="restaurant-card-actions">
                  <button
                    type="button"
                    className="restaurant-action-btn"
                    onClick={() => toggleRestaurant(restaurant)}
                    disabled={actioningRestaurant === `toggle-${restaurant._id}`}
                  >
                    {restaurant.active ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                    {restaurant.active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className="restaurant-action-btn"
                    onClick={() => openEditForm(restaurant)}
                  >
                    <HiOutlinePencil />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="restaurant-action-btn danger"
                    onClick={() => deleteRestaurant(restaurant)}
                    disabled={actioningRestaurant === `delete-${restaurant._id}`}
                  >
                    <HiOutlineTrash />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {formOpen && (
        <RestaurantFormModal
          form={restaurantForm}
          editing={Boolean(editingRestaurant)}
          saving={savingRestaurant}
          onChange={updateRestaurantForm}
          onClose={closeForm}
          onSubmit={handleRestaurantSubmit}
        />
      )}
    </div>
  );
}
