import { useState, useEffect } from 'react';
import { leaderboardAPI } from '../../api';
import { HiOutlineStar, HiOutlineViewList, HiOutlineFire } from 'react-icons/hi';
import { motion } from 'framer-motion';

const MotionDiv = motion.div;

function formatRankScore(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

export default function LeaderboardWidget({ onOpenFull }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWidgetData();
  }, []);

  const fetchWidgetData = async () => {
    try {
      const res = await leaderboardAPI.getWidget();
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier) => {
    switch(tier) {
      case 'Sustain': return 'from-purple-500 to-indigo-500 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)] text-white';
      case 'Thrive': return 'from-fuchsia-500 to-rose-500 border-fuchsia-500/50 shadow-[0_0_15px_rgba(217,70,239,0.4)] text-white';
      case 'Aligned': return 'from-indigo-300 to-violet-500 border-indigo-400/50 text-white';
      case 'Steady': return 'from-cyan-300 to-blue-500 border-cyan-400/50 text-white';
      case 'Balance': return 'from-yellow-400 to-yellow-600 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.4)] text-yellow-100';
      case 'Build': return 'from-gray-300 to-gray-500 border-gray-400/50 text-gray-100';
      case 'Begin': return 'from-orange-700 to-orange-900 border-orange-800/50 text-orange-200';
      default: return 'from-surface-700 to-surface-800 border-surface-600 text-surface-300';
    }
  };

  if (loading) {
    return <div className="glass-card-static p-6 rounded-2xl animate-pulse min-h-[256px] border border-surface-800/50 flex flex-col justify-between">
      <div className="h-4 w-1/3 bg-surface-800 rounded"></div>
      <div className="space-y-3">
        <div className="h-10 bg-surface-800 rounded"></div>
        <div className="h-10 bg-surface-800 rounded"></div>
        <div className="h-10 bg-surface-800 rounded"></div>
      </div>
    </div>;
  }

  if (!data || !data.top5) return null;

  const { top5, userStats } = data;
  const displayTier = (tier) => tier || 'Begin';

  return (
    <div className="leaderboard-widget glass-card-static p-0 rounded-2xl overflow-hidden border border-surface-800/50 flex flex-col shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
      <div className="leaderboard-widget-header border-b border-surface-800 bg-surface-900/40">
        <div className="leaderboard-widget-title">
          <div className="leaderboard-widget-title-icon bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg">
            <HiOutlineStar className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-surface-100 tracking-wider truncate">Nutrition Rank</h3>
            <p className="text-[14px] text-surface-400 mt-1">Ranks students by consistency, XP, and adherence.</p>
          </div>
        </div>
        <button 
          onClick={onOpenFull}
          className="leaderboard-widget-action text-xs font-semibold px-4 py-2 rounded-lg bg-surface-800/60 hover:bg-surface-700 text-primary-400 hover:text-white transition-colors flex items-center justify-center gap-2 border border-primary-500/20 min-h-[44px]"
        >
          <HiOutlineViewList className="w-4 h-4" /> Full Rankings
        </button>
      </div>

      <div className="leaderboard-widget-body">
        {userStats && (
          <div className="adherence-summary border border-surface-800">
            <div className="adherence-stat">
              <p className="adherence-label text-surface-500">Your Rank</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-3xl font-black text-white">#{userStats.rank}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-gradient-to-r ${getTierColor(userStats.tier)}`}>
                  {displayTier(userStats.tier)}
                </span>
              </div>
            </div>

            <div className="adherence-stat">
              <p className="adherence-label text-surface-500">Progress Score</p>
              <p className="text-2xl font-black text-primary-500">{formatRankScore(userStats.score)} <span className="text-sm font-medium text-surface-400">pts</span></p>
            </div>

            <div className="adherence-stat">
              <p className="adherence-label text-surface-500">Current Streak</p>
              {userStats.streak > 0 ? (
                <p className="text-base text-orange-400 font-bold flex items-center gap-2">
                  <HiOutlineFire className="w-4 h-4"/> {userStats.streak} Day{userStats.streak === 1 ? '' : 's'}
                </p>
              ) : (
                <p className="text-base font-bold text-surface-300">No streak yet</p>
              )}
            </div>
          </div>
        )}

        <div className="adherence-list">
          <div className="adherence-list-head text-surface-500">
            <span>Rank</span>
            <span>Student</span>
            <span>Tier</span>
            <span>Score</span>
          </div>

          {top5.map((user, i) => (
            <MotionDiv 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={user.userId} 
              className="adherence-row bg-surface-900/30 hover:bg-surface-800/50 transition-colors border border-transparent hover:border-surface-700/50 group"
            >
              <div className="adherence-rank">
                <span className={`font-black ${i === 0 ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-600' : 'text-surface-600'}`}>
                  #{i + 1}
                </span>
              </div>

              <div className="adherence-student">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-surface-700" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-surface-800 flex items-center justify-center text-sm font-bold text-surface-400 border border-surface-700">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-surface-200 group-hover:text-white transition-colors truncate">{user.name}</p>
                  {user.streak >= 3 && (
                    <p className="text-xs text-orange-400 font-bold flex items-center gap-1 mt-1">
                      <HiOutlineFire className="w-3 h-3" /> {user.streak} day streak
                    </p>
                  )}
                </div>
              </div>

              <div className="adherence-tier">
                <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${getTierColor(user.tier).split(' ').slice(0, 2).join(' ')}`}></span>
                <span className="text-[14px] text-surface-400 font-medium">{displayTier(user.tier)}</span>
              </div>

              <div className="adherence-score">
                <p className="text-base font-black text-white">{formatRankScore(user.score)}</p>
                <p className="text-xs text-surface-500">pts</p>
              </div>
            </MotionDiv>
          ))}
        </div>
      </div>
    </div>
  );
}
