import { useState, useEffect } from 'react';
import { leaderboardAPI } from '../../api';
import { HiOutlineX, HiOutlineStar, HiOutlineFire, HiOutlineChartBar, HiOutlineCheckCircle } from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';

export default function LeaderboardModal({ onClose }) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [category, setCategory] = useState('adherence');
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: 'adherence', name: 'Overall Adherence', icon: HiOutlineStar },
    { id: 'protein', name: 'Protein Master', icon: HiOutlineFire },
    { id: 'calories', name: 'Calorie Accuracy', icon: HiOutlineChartBar },
    { id: 'consistency', name: 'Most Consistent', icon: HiOutlineCheckCircle },
  ];

  useEffect(() => {
    fetchData();
  }, [category, currentPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await leaderboardAPI.getFull(category, currentPage, 20);
      setData(res.data.data.data);
      setTotal(res.data.data.total);
      setPages(res.data.data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier) => {
    switch(tier) {
      case 'Elite': return 'from-purple-500 to-indigo-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]';
      case 'Gold': return 'from-yellow-400 to-yellow-600 text-yellow-100 shadow-[0_0_10px_rgba(234,179,8,0.3)]';
      case 'Silver': return 'from-gray-300 to-gray-500 text-gray-100';
      case 'Bronze': return 'from-orange-700 to-orange-900 text-orange-200';
      default: return 'from-surface-700 to-surface-800 text-surface-300';
    }
  };

  const getScoreDisplay = (user) => {
    switch (category) {
      case 'protein': return `${user.proteinScore.toFixed(1)} / ${user.daysLogged} days`;
      case 'calories': return `${user.calorieScore.toFixed(1)} / ${user.daysLogged} days`;
      case 'consistency': return `${user.consistency}% logged`;
      default: return `${user.score.toFixed(1)} pts`;
    }
  };
  const displayTier = (tier) => tier || 'Bronze';

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="glass-card-static w-full max-w-4xl max-h-[calc(100vh-32px)] h-[85vh] flex flex-col relative border border-surface-700/50 shadow-2xl overflow-hidden rounded-2xl lg:rounded-[20px] z-[2001]"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-11 h-11 rounded-full bg-surface-800/50 hover:bg-surface-700 transition-colors text-surface-400 hover:text-white z-10 flex items-center justify-center"
        >
          <HiOutlineX className="w-5 h-5" />
        </button>

        <div className="p-4 md:p-6 pr-14 md:pr-16 border-b border-surface-800 bg-surface-900/40 shrink-0">
          <h2 className="text-2xl font-black text-white mb-1"><span className="text-primary-500">Hall</span> of Fame</h2>
          <p className="text-sm text-surface-400 mb-6">Compete based on discipline and adherence to your goals, not raw consumption.</p>

          <div className="flex flex-wrap gap-2">
            {categories.map(c => {
               const Icon = c.icon;
               const isActive = category === c.id;
               return (
                 <button
                   key={c.id}
                   onClick={() => { setCategory(c.id); setCurrentPage(1); }}
                   className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-semibold transition-all duration-300 border min-h-[44px] ${isActive ? 'bg-primary-500 text-white border-primary-400 shadow-[0_0_15px_rgba(255,71,20,0.3)]' : 'bg-surface-800/50 text-surface-400 border-surface-700/50 hover:bg-surface-800 hover:text-surface-200'}`}
                 >
                   <Icon className="w-4 h-4" /> {c.name}
                 </button>
               );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#09090b]/60">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <div className="full-rankings-list">
              <div className="full-rankings-head text-surface-500">
                <span>Rank / Student</span>
                <span>Score</span>
              </div>
              {data.map((user, i) => (
                <div key={user.userId} className="full-ranking-row glass-card border border-transparent hover:border-surface-700/50 transition-colors group">
                  <div className="full-ranking-main">
                    <div className="full-ranking-rank">
                      <span className={`font-black ${user.rank === 1 ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : user.rank === 2 ? 'text-gray-300' : user.rank === 3 ? 'text-orange-600' : 'text-surface-500'}`}>
                        #{user.rank}
                      </span>
                    </div>
                    
                    <div className="full-ranking-student">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border-2 border-surface-700 group-hover:border-primary-500/50 transition-colors" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-surface-800 flex items-center justify-center font-bold text-surface-300 border-2 border-surface-700">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-base font-bold text-surface-100 group-hover:text-primary-400 transition-colors truncate">{user.name}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-gradient-to-r ${getTierColor(user.tier)}`}>
                            {displayTier(user.tier)}
                          </span>
                          {user.streak > 2 && (
                            <span className="text-xs font-bold text-orange-400 flex items-center gap-1 bg-orange-900/20 px-2 py-0.5 rounded-full border border-orange-500/20">
                              <HiOutlineFire className="w-3 h-3" /> {user.streak}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="full-ranking-score">
                    <p className="text-lg font-black text-white">{getScoreDisplay(user)}</p>
                    <p className="text-xs text-surface-500 uppercase tracking-widest mt-0.5">{category === 'adherence' ? 'Normalized Score' : category}</p>
                  </div>
                </div>
              ))}
              
              {data.length === 0 && (
                <div className="text-center py-20 text-surface-500">
                  No data available for this category yet.
                </div>
              )}
            </div>
          )}
        </div>

        {pages > 1 && (
          <div className="p-4 border-t border-surface-800 bg-surface-900/80 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="btn-secondary px-4 py-2 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] w-full md:w-auto"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-surface-400">Page <span className="text-white">{currentPage}</span> of {pages}</span>
            <button 
              disabled={currentPage === pages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="btn-secondary px-4 py-2 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] w-full md:w-auto"
            >
              Next
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
