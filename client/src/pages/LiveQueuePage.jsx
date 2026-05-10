import { useEffect, useMemo, useState } from 'react';
import { HiOutlineRefresh, HiOutlineSearch } from 'react-icons/hi';
import { orderAPI } from '../api';
import toast from 'react-hot-toast';

export default function LiveQueuePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadQueue = async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await orderAPI.getLiveQueue();
      setItems(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load live queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(() => loadQueue({ quiet: true }), 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => String(item.name || '').toLowerCase().includes(query));
  }, [items, search]);

  return (
    <div className="live-queue-page animate-fadeIn">
      <section className="live-queue-hero glass-card-static">
        <div>
          <p className="live-queue-kicker">Live Queue</p>
          <h1>Plan before you walk in</h1>
          <p>See which items are currently delayed in the kitchen queue.</p>
        </div>
        <button
          type="button"
          className="live-queue-refresh btn-secondary"
          onClick={() => loadQueue({ quiet: true })}
          disabled={refreshing}
        >
          <HiOutlineRefresh className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </section>

      <section className="live-queue-search glass-card-static">
        <HiOutlineSearch />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search item in live queue"
          aria-label="Search live queue by item name"
        />
      </section>

      <section className="live-queue-panel glass-card-static">
        <div className="live-queue-panel-header">
          <div>
            <h2>Queue details</h2>
            <p>Items with no queue delay are hidden automatically.</p>
          </div>
          <span>{filteredItems.length} active</span>
        </div>

        {loading ? (
          <div className="live-queue-page-empty">Checking current queue...</div>
        ) : items.length === 0 ? (
          <div className="live-queue-page-empty">No item delays right now.</div>
        ) : filteredItems.length === 0 ? (
          <div className="live-queue-page-empty">No delayed item matches your search.</div>
        ) : (
          <div className="live-queue-page-list">
            {filteredItems.map((item) => (
              <article className="live-queue-page-row" key={item.menuItemId || item.name}>
                <div className="live-queue-page-thumb">
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : item.name?.charAt(0)}
                </div>
                <div className="live-queue-page-main">
                  <h3>{item.name}</h3>
                  <p>{item.quantity} qty waiting - {item.orders} order{item.orders === 1 ? '' : 's'}</p>
                </div>
                <div className="live-queue-page-delay">
                  <strong>{Math.round(item.delayMinutes)}</strong>
                  <span>min</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
