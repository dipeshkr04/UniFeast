import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { leaderboardAPI } from '../../api';
import { getBadgeAsset } from '../../constants/nutritionBadges';
import { HiOutlineX } from 'react-icons/hi';

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function getInitial(name = 'U') {
  return name.charAt(0).toUpperCase();
}

function getRankBadge(rank) {
  if (rank === 1) return 'rank-medal rank-medal-gold';
  if (rank === 2) return 'rank-medal rank-medal-silver';
  if (rank === 3) return 'rank-medal rank-medal-bronze';
  return 'rank-number';
}

const PAGE_SIZE = 50;

export default function LeaderboardModal({ onClose }) {
  const [rows, setRows] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const modalBodyRef = useRef(null);

  const fetchPage = useCallback(async (nextPage = 1, replace = false) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await leaderboardAPI.getFull('rank', nextPage, PAGE_SIZE, 'allTime');
      const payload = res.data.data;
      const nextRows = payload.data || [];

      setRows((prev) => {
        if (replace) return nextRows;
        const seen = new Set(prev.map((item) => String(item.userId)));
        return [...prev, ...nextRows.filter((item) => !seen.has(String(item.userId)))];
      });
      setCurrentUser(payload.currentUser || null);
      setTotal(payload.total || 0);
      setPage(nextPage);
      setHasMore(nextPage < (payload.pages || 1));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const handleBodyScroll = useCallback((event) => {
    const node = event.currentTarget;
    if (!node || loading || loadingMore || !hasMore) return;

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (distanceFromBottom < 360) {
      fetchPage(page + 1);
    }
  }, [fetchPage, hasMore, loading, loadingMore, page]);

  const modal = (
    <div className="leaderboard-modal-overlay fixed inset-0 z-[2000] flex items-center justify-center p-3 md:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="leaderboard-modal-shell glass-card-static w-full flex flex-col relative border border-surface-700/50 shadow-2xl overflow-hidden rounded-2xl z-[2001]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-11 h-11 rounded-full bg-surface-900/80 hover:bg-surface-800 transition-colors text-surface-400 hover:text-white z-20 flex items-center justify-center border border-surface-700/70"
          aria-label="Close leaderboard"
        >
          <HiOutlineX className="w-5 h-5" />
        </button>

        <div className="leaderboard-modal-body" ref={modalBodyRef} onScroll={handleBodyScroll}>
          {loading ? (
            <div className="leaderboard-loading">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <>
              <section className="leaderboard-table-panel">
                <div className="leaderboard-table-header">
                  <div>
                    <p className="section-kicker">Leaderboard</p>
                    <h3>Nutrition Rank</h3>
                  </div>
                  <p>{total} students</p>
                </div>

                <div className="leaderboard-rank-table">
                  <div className="leaderboard-rank-head">
                    <span>Rank</span>
                    <span>User</span>
                    <span>Consistency</span>
                    <span>XP</span>
                    <span>Adherence</span>
                    <span>Points & Badge</span>
                  </div>

                  {rows.map((user) => (
                    <div
                      key={user.userId}
                      className={`leaderboard-rank-row ${currentUser?.userId === user.userId ? 'is-current-user' : ''}`}
                    >
                      <div className="leaderboard-rank-cell">
                        <span className={getRankBadge(user.rank)}>{user.rank <= 3 ? user.rank : user.rank}</span>
                      </div>

                      <div className="leaderboard-user-cell">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.name} loading="lazy" decoding="async" />
                        ) : (
                          <div className="leaderboard-avatar-fallback">{getInitial(user.name)}</div>
                        )}
                        <div className="min-w-0">
                          <p>{user.name}</p>
                          <span>{user.totalConsistentDays} consistent days</span>
                        </div>
                      </div>

                      <span className="leaderboard-metric-cell">{user.consistency}%</span>
                      <span className="leaderboard-metric-cell">{formatNumber(user.totalXP)}</span>
                      <span className="leaderboard-metric-cell">{user.adherence}%</span>

                      <div className="leaderboard-points-badge-cell">
                        <strong className="leaderboard-score-cell">{formatNumber(user.rankScore)}</strong>
                        <div className="leaderboard-badge-cell">
                          <img src={getBadgeAsset(user.badge)} alt={`${user.badge?.name || 'Badge'} badge`} />
                          <span>{user.badge?.name || 'Begin'}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {rows.length === 0 && (
                    <div className="leaderboard-empty">No students are available yet.</div>
                  )}

                  {hasMore && (
                    <div className="leaderboard-load-more" aria-live="polite">
                      {loadingMore ? 'Loading more rankings...' : 'Scroll for more rankings'}
                    </div>
                  )}
                </div>

                <p className="leaderboard-footnote">Rankings use badge tier first. Progress Score is a bounded next-badge progress indicator, not a raw point total.</p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
