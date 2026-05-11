import { useCallback, useEffect, useMemo, useState } from 'react';
import { outsideFoodAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { HiOutlineRefresh, HiOutlineUserGroup } from 'react-icons/hi';
import { MdOutlineRestaurant } from 'react-icons/md';
import toast from 'react-hot-toast';

const emptyRestaurant = {
  name: '',
  image: '',
  cuisineTags: '',
  minPoolAmount: '700',
  estimatedDeliveryTime: '45-60 min',
  contactNumber: '',
  menuLink: '',
  whatsappLink: '',
  pickupPoints: '',
  active: true,
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function toLocalInputValue(value = Date.now() + 10 * 60 * 1000) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function getEmptyPool() {
  return {
    restaurantId: '',
    title: '',
    targetAmount: '',
    opensAt: toLocalInputValue(),
    durationMinutes: '20',
    pickupPoint: '',
  };
}

function mergePoolById(list, update) {
  if (!update?._id && !update?.poolId) return list;
  const id = (update._id || update.poolId).toString();
  const exists = list.some((pool) => pool._id?.toString() === id);
  if (!exists && update._id) return [update, ...list];
  return list.map((pool) => (
    pool._id?.toString() === id
      ? {
        ...pool,
        ...update,
        restaurant: update.restaurant || pool.restaurant,
        participants: update.participants || pool.participants,
      }
      : pool
  ));
}

function formatWindow(pool) {
  const opensAt = pool.opensAt ? new Date(pool.opensAt) : null;
  const closesAt = pool.closesAt ? new Date(pool.closesAt) : null;
  if (!opensAt || !closesAt) return 'Window not set';
  return `${opensAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} - ${closesAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}

export default function AdminOutsideFoodPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [pools, setPools] = useState([]);
  const [restaurantForm, setRestaurantForm] = useState(emptyRestaurant);
  const [poolForm, setPoolForm] = useState(getEmptyPool);
  const [loading, setLoading] = useState(true);
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [savingPool, setSavingPool] = useState(false);
  const { socket } = useSocket() || {};

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [restaurantResponse, poolResponse] = await Promise.all([
        outsideFoodAPI.restaurants.getAll({ includeInactive: true }),
        outsideFoodAPI.pools.getAll({ scope: 'admin', includeArchived: false }),
      ]);
      setRestaurants(restaurantResponse.data.data || []);
      setPools(poolResponse.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load outside food admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket) return undefined;

    const handlePoolUpdate = (pool) => setPools((previous) => mergePoolById(previous, pool));
    const handleParticipantUpdate = (update) => setPools((previous) => mergePoolById(previous, update));

    socket.on('pool:update', handlePoolUpdate);
    socket.on('pool:unlock', handlePoolUpdate);
    socket.on('pool:lock', handlePoolUpdate);
    socket.on('pool:coordinator-update', handlePoolUpdate);
    socket.on('pool:status-update', handlePoolUpdate);
    socket.on('pool:participant-update', handleParticipantUpdate);

    return () => {
      socket.off('pool:update', handlePoolUpdate);
      socket.off('pool:unlock', handlePoolUpdate);
      socket.off('pool:lock', handlePoolUpdate);
      socket.off('pool:coordinator-update', handlePoolUpdate);
      socket.off('pool:status-update', handlePoolUpdate);
      socket.off('pool:participant-update', handleParticipantUpdate);
    };
  }, [socket]);

  const selectedRestaurant = useMemo(() => (
    restaurants.find((restaurant) => restaurant._id === poolForm.restaurantId)
  ), [poolForm.restaurantId, restaurants]);

  useEffect(() => {
    if (!selectedRestaurant) return;
    setPoolForm((previous) => ({
      ...previous,
      title: previous.title || `${selectedRestaurant.name} Pool`,
      targetAmount: previous.targetAmount || String(selectedRestaurant.minPoolAmount || ''),
      pickupPoint: previous.pickupPoint || selectedRestaurant.pickupPoints?.[0] || '',
    }));
  }, [selectedRestaurant]);

  const activePools = useMemo(() => (
    pools
      .filter((pool) => !pool.archived)
      .sort((a, b) => new Date(a.opensAt) - new Date(b.opensAt))
  ), [pools]);

  const updateRestaurantForm = (field, value) => {
    setRestaurantForm((previous) => ({ ...previous, [field]: value }));
  };

  const updatePoolForm = (field, value) => {
    setPoolForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleRestaurantSubmit = async (event) => {
    event.preventDefault();
    setSavingRestaurant(true);
    try {
      const { data } = await outsideFoodAPI.restaurants.create({
        ...restaurantForm,
        minPoolAmount: Number(restaurantForm.minPoolAmount),
      });
      setRestaurants((previous) => [data.data, ...previous]);
      setRestaurantForm(emptyRestaurant);
      toast.success('Restaurant added for outside food pooling');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create restaurant');
    } finally {
      setSavingRestaurant(false);
    }
  };

  const toggleRestaurant = async (restaurant) => {
    try {
      const { data } = await outsideFoodAPI.restaurants.update(restaurant._id, {
        active: !restaurant.active,
      });
      setRestaurants((previous) => previous.map((item) => (
        item._id === restaurant._id ? data.data : item
      )));
      toast.success(data.data.active ? 'Restaurant activated' : 'Restaurant deactivated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update restaurant');
    }
  };

  const handlePoolSubmit = async (event) => {
    event.preventDefault();
    setSavingPool(true);
    try {
      const { data } = await outsideFoodAPI.pools.create({
        ...poolForm,
        targetAmount: Number(poolForm.targetAmount),
        durationMinutes: Number(poolForm.durationMinutes),
        opensAt: new Date(poolForm.opensAt).toISOString(),
      });
      setPools((previous) => [data.data, ...previous]);
      setPoolForm(getEmptyPool());
      toast.success('Scheduled outside food pool created');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create pool');
    } finally {
      setSavingPool(false);
    }
  };

  const updatePoolStatus = async (pool, status, statusMessage) => {
    try {
      const { data } = await outsideFoodAPI.pools.updateStatus(pool._id, {
        status,
        statusMessage,
      });
      setPools((previous) => mergePoolById(previous, data.data));
      toast.success(`Pool marked ${status.toLowerCase()}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update pool');
    }
  };

  const archivePool = async (pool) => {
    try {
      const { data } = await outsideFoodAPI.pools.archive(pool._id);
      setPools((previous) => mergePoolById(previous, data.data));
      toast.success('Pool archived');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to archive pool');
    }
  };

  return (
    <div className="outside-food-admin-page">
      <header className="outside-food-admin-header">
        <div>
          <span>Admin Outside Food</span>
          <h1>Restaurant pools and realtime rooms</h1>
          <p>Create scheduled windows, configure unlock amounts, and monitor the temporary rooms without touching the hostel canteen system.</p>
        </div>
        <button type="button" className="outside-food-secondary-btn" onClick={() => loadData({ quiet: true })}>
          <HiOutlineRefresh />
          Refresh
        </button>
      </header>

      <div className="outside-food-admin-grid">
        <form className="outside-food-admin-panel" onSubmit={handleRestaurantSubmit}>
          <h2>Add Restaurant</h2>
          <label className="outside-food-field">
            <span>Name</span>
            <input value={restaurantForm.name} onChange={(event) => updateRestaurantForm('name', event.target.value)} required />
          </label>
          <label className="outside-food-field">
            <span>Image URL</span>
            <input value={restaurantForm.image} onChange={(event) => updateRestaurantForm('image', event.target.value)} placeholder="https://..." />
          </label>
          <div className="outside-food-admin-two">
            <label className="outside-food-field">
              <span>Cuisine tags</span>
              <input value={restaurantForm.cuisineTags} onChange={(event) => updateRestaurantForm('cuisineTags', event.target.value)} placeholder="Pizza, Burgers" />
            </label>
            <label className="outside-food-field">
              <span>Minimum pool amount</span>
              <input type="number" min="1" value={restaurantForm.minPoolAmount} onChange={(event) => updateRestaurantForm('minPoolAmount', event.target.value)} required />
            </label>
          </div>
          <div className="outside-food-admin-two">
            <label className="outside-food-field">
              <span>Delivery estimate</span>
              <input value={restaurantForm.estimatedDeliveryTime} onChange={(event) => updateRestaurantForm('estimatedDeliveryTime', event.target.value)} />
            </label>
            <label className="outside-food-field">
              <span>Contact number</span>
              <input value={restaurantForm.contactNumber} onChange={(event) => updateRestaurantForm('contactNumber', event.target.value)} />
            </label>
          </div>
          <label className="outside-food-field">
            <span>Menu link</span>
            <input value={restaurantForm.menuLink} onChange={(event) => updateRestaurantForm('menuLink', event.target.value)} placeholder="Optional" />
          </label>
          <label className="outside-food-field">
            <span>WhatsApp link</span>
            <input value={restaurantForm.whatsappLink} onChange={(event) => updateRestaurantForm('whatsappLink', event.target.value)} placeholder="Optional post-unlock link" />
          </label>
          <label className="outside-food-field">
            <span>Pickup points</span>
            <input value={restaurantForm.pickupPoints} onChange={(event) => updateRestaurantForm('pickupPoints', event.target.value)} placeholder="Hostel A Gate, Main Circle" required />
          </label>
          <label className="outside-food-admin-check">
            <input
              type="checkbox"
              checked={restaurantForm.active}
              onChange={(event) => updateRestaurantForm('active', event.target.checked)}
            />
            Active restaurant
          </label>
          <button type="submit" className="outside-food-primary-btn" disabled={savingRestaurant}>
            {savingRestaurant ? 'Saving...' : 'Create Restaurant'}
          </button>
        </form>

        <form className="outside-food-admin-panel" onSubmit={handlePoolSubmit}>
          <h2>Schedule Pool</h2>
          <label className="outside-food-field">
            <span>Restaurant</span>
            <select
              value={poolForm.restaurantId}
              onChange={(event) => updatePoolForm('restaurantId', event.target.value)}
              required
            >
              <option value="">Select restaurant</option>
              {restaurants.filter((restaurant) => restaurant.active).map((restaurant) => (
                <option key={restaurant._id} value={restaurant._id}>{restaurant.name}</option>
              ))}
            </select>
          </label>
          <label className="outside-food-field">
            <span>Pool title</span>
            <input value={poolForm.title} onChange={(event) => updatePoolForm('title', event.target.value)} required />
          </label>
          <div className="outside-food-admin-two">
            <label className="outside-food-field">
              <span>Target amount</span>
              <input type="number" min="1" value={poolForm.targetAmount} onChange={(event) => updatePoolForm('targetAmount', event.target.value)} required />
            </label>
            <label className="outside-food-field">
              <span>Duration minutes</span>
              <input type="number" min="5" value={poolForm.durationMinutes} onChange={(event) => updatePoolForm('durationMinutes', event.target.value)} required />
            </label>
          </div>
          <label className="outside-food-field">
            <span>Opens at</span>
            <input
              type="datetime-local"
              value={poolForm.opensAt}
              onChange={(event) => updatePoolForm('opensAt', event.target.value)}
              required
            />
          </label>
          <label className="outside-food-field">
            <span>Pickup point</span>
            <input value={poolForm.pickupPoint} onChange={(event) => updatePoolForm('pickupPoint', event.target.value)} required />
          </label>
          <button type="submit" className="outside-food-primary-btn" disabled={savingPool}>
            {savingPool ? 'Scheduling...' : 'Create Scheduled Pool'}
          </button>
        </form>
      </div>

      <section className="outside-food-admin-section">
        <div className="outside-food-admin-section-head">
          <h2>Restaurants</h2>
          <span>{restaurants.length} configured</span>
        </div>
        <div className="outside-food-admin-list">
          {restaurants.map((restaurant) => (
            <article key={restaurant._id} className="outside-food-admin-restaurant">
              <div className="outside-food-admin-thumb">
                {restaurant.image ? <img src={restaurant.image} alt={restaurant.name} /> : <MdOutlineRestaurant />}
              </div>
              <div>
                <strong>{restaurant.name}</strong>
                <p>{restaurant.cuisineTags?.join(', ') || 'No cuisine tags'} · Minimum {formatCurrency(restaurant.minPoolAmount)}</p>
              </div>
              <button type="button" className="outside-food-secondary-btn" onClick={() => toggleRestaurant(restaurant)}>
                {restaurant.active ? 'Deactivate' : 'Activate'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="outside-food-admin-section">
        <div className="outside-food-admin-section-head">
          <h2>Active Room Monitor</h2>
          <span>{activePools.length} rooms</span>
        </div>

        {loading ? (
          <div className="outside-food-skeleton" />
        ) : activePools.length === 0 ? (
          <div className="outside-food-empty">
            <MdOutlineRestaurant />
            <h2>No outside food rooms</h2>
            <p>Create a scheduled pool to start the realtime room lifecycle.</p>
          </div>
        ) : (
          <div className="outside-food-admin-pool-grid">
            {activePools.map((pool) => (
              <article key={pool._id} className="outside-food-admin-pool">
                <div className="outside-food-admin-pool-head">
                  <div>
                    <span>{pool.status}</span>
                    <h3>{pool.title}</h3>
                    <p>{pool.restaurant?.name}</p>
                  </div>
                  <strong>{pool.progressPercent || 0}%</strong>
                </div>

                <div className="outside-food-progress-track">
                  <div className="outside-food-progress-fill" style={{ width: `${Math.min(100, Number(pool.progressPercent || 0))}%` }} />
                </div>

                <div className="outside-food-admin-pool-meta">
                  <span><HiOutlineUserGroup /> {pool.participantCount} joined</span>
                  <span>{formatCurrency(pool.currentAmount)} / {formatCurrency(pool.targetAmount)}</span>
                </div>
                <div className="outside-food-admin-pool-meta">
                  <span>{formatWindow(pool)}</span>
                  <span>{pool.onlineCount || 0} online</span>
                </div>
                <p className="outside-food-admin-pool-meta">{pool.pickupPoint}</p>

                <div className="outside-food-admin-participants">
                  {(pool.participants || []).length === 0 ? (
                    <span>No participants yet</span>
                  ) : pool.participants.map((participant) => (
                    <span key={participant._id}>
                      {(pool.coordinators || []).some((coordinator) => coordinator.userId?.toString?.() === participant.userId?.toString?.())
                        ? 'Coordinator: '
                        : ''}
                      {participant.name}
                    </span>
                  ))}
                </div>

                <div className="outside-food-admin-actions">
                  {pool.status === 'OPEN' && (
                    <button type="button" className="outside-food-secondary-btn" onClick={() => updatePoolStatus(pool, 'UNLOCKED', 'Pool unlocked - grace window started')}>
                      Unlock
                    </button>
                  )}
                  {['OPEN', 'UNLOCKED'].includes(pool.status) && (
                    <button type="button" className="outside-food-secondary-btn" onClick={() => updatePoolStatus(pool, 'LOCKED', 'Pool locked')}>
                      Lock
                    </button>
                  )}
                  {['UNLOCKED', 'LOCKED'].includes(pool.status) && (
                    <button type="button" className="outside-food-secondary-btn" onClick={() => updatePoolStatus(pool, 'COORDINATING', 'Restaurant communication confirmed')}>
                      Coordinating
                    </button>
                  )}
                  {pool.status !== 'COMPLETED' && pool.status !== 'ARCHIVED' && (
                    <button type="button" className="outside-food-secondary-btn" onClick={() => updatePoolStatus(pool, 'COMPLETED', 'Delivery completed')}>
                      Complete
                    </button>
                  )}
                  <button type="button" className="outside-food-secondary-btn" onClick={() => archivePool(pool)}>
                    Archive
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
