import { useCallback, useEffect, useState } from 'react';
import { outsideFoodAPI } from '../api';
import {
  HiOutlineClock,
  HiOutlineExternalLink,
  HiOutlineLocationMarker,
  HiOutlinePhone,
  HiOutlineRefresh,
  HiOutlineX,
} from 'react-icons/hi';
import { MdOutlineRestaurant } from 'react-icons/md';
import toast from 'react-hot-toast';

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
  if (!text) return 'Order window not set';
  const [from, to] = text.split(/\s*-\s*/);
  if (!from || !to) return text;
  return `Order from ${compactTimeLabel(from)} to ${compactTimeLabel(to)}`;
}

function normalizeMenuUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function MenuPreviewModal({ restaurant, onClose }) {
  if (!restaurant) return null;
  const menuUrl = normalizeMenuUrl(restaurant.menuLink);

  return (
    <div className="feast-menu-backdrop" onClick={onClose}>
      <section className="feast-menu-modal" onClick={(event) => event.stopPropagation()}>
        <div className="outside-food-modal-header feast-menu-head">
          <div>
            <span>Menu Preview</span>
            <h2>{restaurant.name}</h2>
            <p>{restaurant.cuisineTags?.join(', ') || 'Campus food partner'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu preview">
            <HiOutlineX />
          </button>
        </div>

        {menuUrl ? (
          <>
            <div className="feast-menu-frame">
              <iframe src={menuUrl} title={`${restaurant.name} menu preview`} />
            </div>
            <a className="outside-food-primary-btn feast-menu-open-btn" href={menuUrl} target="_blank" rel="noreferrer">
              <HiOutlineExternalLink />
              Open Full Menu
            </a>
          </>
        ) : (
          <div className="feast-menu-empty">
            <MdOutlineRestaurant />
            <h3>No menu link added</h3>
            <p>Ask the admin to add a menu link for this restaurant.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default function FindFeastPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewRestaurant, setPreviewRestaurant] = useState(null);

  const loadRestaurants = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await outsideFoodAPI.restaurants.getAll();
      setRestaurants(data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load restaurants');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  return (
    <div className="outside-food-page feast-page">
      <header className="outside-food-hero feast-hero">
        <div className="feast-hero-content">
          <div className="feast-hero-top">
            <span>Find Your Feast</span>
            <button
              type="button"
              className="outside-food-secondary-btn feast-refresh-btn"
              onClick={() => loadRestaurants({ quiet: true })}
              disabled={refreshing}
            >
              <HiOutlineRefresh className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <h1>Restaurant highlights</h1>
          <p>Browse admin-added restaurants, timings, contacts, menu links, and order minimums before starting a pool.</p>
        </div>
      </header>

      {loading ? (
        <div className="outside-food-grid">
          {[1, 2, 3].map((item) => <div key={item} className="outside-food-skeleton" />)}
        </div>
      ) : restaurants.length === 0 ? (
        <section className="outside-food-empty">
          <MdOutlineRestaurant />
          <h2>No restaurants yet</h2>
          <p>Restaurants added by admin will appear here.</p>
        </section>
      ) : (
        <div className="outside-food-grid feast-grid">
          {restaurants.map((restaurant) => (
            <article key={restaurant._id} className="outside-food-pool-card feast-card">
              <div className="outside-food-card-media feast-card-media">
                {restaurant.image ? (
                  <img src={restaurant.image} alt={restaurant.name} />
                ) : (
                  <div className="outside-food-card-fallback">
                    <MdOutlineRestaurant />
                  </div>
                )}
              </div>
              <div className="outside-food-card-body feast-card-body">
                <div className="outside-food-card-title-row feast-card-title-row">
                  <div>
                    <h2>{restaurant.name}</h2>
                    <p>{restaurant.cuisineTags?.join(', ') || 'Campus food partner'}</p>
                  </div>
                  <div className="outside-food-amount feast-minimum">
                    <strong>{formatCurrency(restaurant.minPoolAmount)}</strong>
                    <span>min</span>
                  </div>
                </div>

                <div className="outside-food-card-stats feast-card-stats">
                  <span><HiOutlineLocationMarker /> {restaurant.location || 'Location not added'}</span>
                  <span><HiOutlineClock /> {formatOrderWindow(restaurant.orderWindow)}</span>
                  <span><HiOutlinePhone /> {restaurant.contactNumber || 'Contact not added'}</span>
                </div>

                <button type="button" className="outside-food-primary-btn feast-card-btn" onClick={() => setPreviewRestaurant(restaurant)}>
                  View Menu
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <MenuPreviewModal restaurant={previewRestaurant} onClose={() => setPreviewRestaurant(null)} />
    </div>
  );
}
