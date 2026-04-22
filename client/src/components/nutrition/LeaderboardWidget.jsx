import { useState, useEffect } from 'react';
import { leaderboardAPI } from '../../api';
import { HiOutlineStar, HiOutlineViewList, HiOutlineFire } from 'react-icons/hi';
import { motion } from 'framer-motion';

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
      case 'Elite': return 'from-purple-500 to-indigo-500 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)] text-white';
      case 'Gold': return 'from-yellow-400 to-yellow-600 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.4)] text-yellow-100';
      case 'Silver': return 'from-gray-300 to-gray-500 border-gray-400/50 text-gray-100';
      case 'Bronze': return 'from-orange-700 to-orange-900 border-orange-800/50 text-orange-200';
      default: return 'from-surface-700 to-surface-800 border-surface-600 text-surface-300';
    }
  };

  if (loading) {
    return <div className="glass-card-static p-6 rounded-2xl animate-pulse h-64 border border-surface-800/50 flex flex-col justify-between">
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

  return (
    <div className="glass-card-static p-0 rounded-2xl overflow-hidden border border-surface-800/50 flex flex-col shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
      <div className="p-5 border-b border-surface-800 flex items-center justify-between bg-surface-900/40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg">
            <HiOutlineStar className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-bold text-surface-100 tracking-wider">Top Adherence</h3>
        </div>
        <button 
          onClick={onOpenFull}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-800/60 hover:bg-surface-700 text-primary-400 hover:text-white transition-colors flex items-center gap-2 border border-primary-500/20"
        >
          <HiOutlineViewList className="w-4 h-4" /> Full Rankings
        </button>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-center">
        {userStats && (
          <div className="mb-6 pb-6 border-b border-surface-800 border-dashed relative">
            <div className={`absolute -left-5 top-0 bottom-0 w-1 bg-gradient-to-b ${getTierColor(userStats.tier).split(' ')[0]} ${getTierColor(userStats.tier).split(' ')[1]}`}></div>
            <div className="flex justify-between items-center px-2">
              <div>
                <p className="text-xs text-surface-500 font-semibold mb-1 uppercase tracking-widest">Your Rank</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">#{userStats.rank}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-gradient-to-r ${getTierColor(userStats.tier)}`}>
                    {userStats.tier} Max {!userStats.tier && 'Bronze'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-surface-500 font-semibold mb-1 uppercase tracking-widest">Score</p>
                <p className="text-2xl font-black text-primary-500">{userStats.score.toFixed(1)} <span className="text-sm font-medium text-surface-400">pts</span></p>
                {userStats.streak > 0 && <p className="text-[10px] text-orange-400 font-bold flex items-center justify-end gap-1"><HiOutlineFire className="w-3 h-3"/> {userStats.streak} Day Streak</p>}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {top5.map((user, i) => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={user.userId} 
              className="flex items-center justify-between p-3 rounded-xl bg-surface-900/30 hover:bg-surface-800/50 transition-colors border border-transparent hover:border-surface-700/50 group"
            >
              <div className="flex items-center gap-4">
                <span className={`w-6 text-center font-black ${i === 0 ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-600' : 'text-surface-600'} text-lg`}>
                  {i + 1}
                </span>
                <div className="flex items-center gap-3">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover border border-surface-700" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-400 border border-surface-700">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-surface-200 group-hover:text-white transition-colors">{user.name}</p>
                    <div className="flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${getTierColor(user.tier).split(' ').slice(0, 2).join(' ')}`}></span>
                       <p className="text-[10px] text-surface-500 font-medium">{user.tier}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-white">{user.score.toFixed(1)}</p>
                {user.streak >= 3 && <HiOutlineFire className="w-3.5 h-3.5 text-orange-500 inline-block ml-1" title={`${user.streak} day streak`} />}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
