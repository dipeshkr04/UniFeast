import { Suspense, lazy, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { leaderboardAPI, nutritionAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { HiOutlineFire, HiOutlineChevronLeft, HiOutlineChevronRight, HiPlus, HiMinus, HiOutlineTrash, HiOutlineCog, HiOutlineSparkles, HiOutlineLockClosed, HiOutlineX, HiOutlineMenuAlt2, HiOutlineCalendar, HiOutlineChartBar, HiOutlineStar } from 'react-icons/hi';
import toast from 'react-hot-toast';
import LeaderboardWidget from '../components/nutrition/LeaderboardWidget';
import RankProgressSummary from '../components/nutrition/RankProgressSummary';
import { NUTRITION_BADGES } from '../constants/nutritionBadges';
import { getImageUrl } from '../utils/imageUrl';

const COLORS = ['#e06449', '#facc15', '#3b82f6', '#10b981'];
const NUTRITION_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];
const LeaderboardModal = lazy(() => import('../components/nutrition/LeaderboardModal'));
const DEFAULT_LOG_FORM = {
  customName: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  quantity: '1',
  mealType: 'snack',
  imageFile: null,
  imageUrl: '',
  uploadedImageUrl: '',
};

const nutritionViews = [
  { id: 'daily', label: 'Daily Updates' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'instructions', label: 'Instructions' },
];

const rankingInstructionGroups = [
  {
    title: 'Core Terms',
    icon: HiOutlineStar,
    items: [
      {
        question: 'What is consistency?',
        answer: 'A day is consistent only when meal data exists and that day reaches at least 50% adherence.',
      },
      {
        question: 'What is XP?',
        answer: 'XP is earned from logging meals, strong adherence, macro targets, fiber goals, and calorie accuracy.',
      },
      {
        question: 'What is adherence?',
        answer: 'Adherence shows how closely calories, protein, fiber, carbs, and fat match the user’s personal goals.',
      },
    ],
  },
  {
    title: 'Adherence',
    icon: HiOutlineCalendar,
    items: [
      {
        question: 'How is daily adherence calculated?',
        answer: 'Calories 35%, protein 25%, fiber 15%, carbs 15%, and fat 10%. Each logged day gets a 0-100% score.',
      },
      {
        question: 'Which adherence is used for badges?',
        answer: 'Badges and rankings use average adherence across all logged days that contain meal data.',
      },
    ],
  },
  {
    title: 'XP',
    icon: HiOutlineFire,
    items: [
      {
        question: 'How does a day earn XP?',
        answer: 'Meal logged +20, meaningful log +30, 70% adherence +40, 85% adherence +70, protein +20, fiber +20, calories within 10% +20.',
      },
      {
        question: 'Is there a daily XP limit?',
        answer: 'Yes. Daily XP is capped at 200 XP, and total XP is the sum of all logged days.',
      },
    ],
  },
  {
    title: 'Badges',
    icon: HiOutlineChartBar,
    items: [
      {
        question: 'How does a badge unlock?',
        answer: 'A badge unlocks only when consistent days, total XP, and average adherence all meet that badge’s threshold.',
      },
      {
        question: 'What are the badge thresholds?',
        answer: 'Build: 14 days, 1K XP, 60%. Balance: 28, 2.5K, 65%. Steady: 50, 5K, 70%. Aligned: 100, 12K, 75%. Sustain: 200, 28K, 80%. Thrive: 365, 60K, 85%.',
      },
    ],
  },
  {
    title: 'Ranking',
    icon: HiOutlineChartBar,
    items: [
      {
        question: 'How is leaderboard rank decided?',
        answer: 'Ranking order is highest badge tier, higher total XP, more consistent days, then higher average adherence.',
      },
      {
        question: 'What is Progress Score?',
        answer: 'Progress Score is a 0-100 next-badge progress indicator: consistency 40%, adherence 35%, and XP 25%. It does not directly decide rank.',
      },
      {
        question: 'How is current streak counted?',
        answer: 'The app checks consecutive valid days from today, or from yesterday when today is not valid yet.',
      },
    ],
  },
];

function getDetectedQuantity(result, fallback = '1') {
  const value = result?.quantity ?? result?.detectedItems?.[0]?.quantity;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback || '1';
  return String(Math.max(1, Math.min(20, Math.round(parsed * 10) / 10)));
}

function formatNutritionNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 10) / 10;
}

function getRemainingNutrition(goals = {}, totals = {}) {
  return NUTRITION_KEYS.reduce((acc, key) => {
    acc[key] = Math.max(0, Number(goals[key] || 0) - Number(totals[key] || 0));
    return acc;
  }, {});
}

function hasMetDailyGoal(goals = {}, totals = {}) {
  return NUTRITION_KEYS.every((key) => Number(totals[key] || 0) >= Number(goals[key] || 0));
}

function formatDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKeyToLocalDate(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDaysToDateKey(dateKey, delta) {
  const next = dateKeyToLocalDate(dateKey);
  next.setDate(next.getDate() + delta);
  return formatDateKey(next);
}

export default function NutritionPage() {
  const { user, updateUser } = useAuth();
  const todayKey = formatDateKey();
  const [date, setDate] = useState(todayKey);
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);
  const [activeView, setActiveView] = useState('daily');
  const [showMobileSections, setShowMobileSections] = useState(false);
  const [chartView, setChartView] = useState('weekly');
  const [rankProgress, setRankProgress] = useState(null);
  const [rankBadgeTiers, setRankBadgeTiers] = useState(NUTRITION_BADGES);
  const fileInputRef = useRef(null);

  const [logForm, setLogForm] = useState(DEFAULT_LOG_FORM);
  const [goalsForm, setGoalsForm] = useState({
    dailyCalorieGoal: user?.dailyCalorieGoal || 2200,
    dailyProteinGoal: user?.dailyProteinGoal || 55,
    dailyCarbGoal: user?.dailyCarbGoal || 275,
    dailyFatGoal: user?.dailyFatGoal || 70,
    dailyFiberGoal: user?.dailyFiberGoal || 30,
  });

  const [loading, setLoading] = useState(true);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [dietPreference, setDietPreference] = useState('veg');
  const [foodRecommendation, setFoodRecommendation] = useState(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (date > todayKey) {
      setDate(todayKey);
      return;
    }

    setLoading(true);
    try {
      const [dailyRes, weeklyRes, monthlyRes, leaderboardRes] = await Promise.all([
        nutritionAPI.getDaily(date),
        nutritionAPI.getWeekly(),
        nutritionAPI.getMonthly(),
        leaderboardAPI.getWidget('allTime').catch(() => null),
      ]);
      setDaily(dailyRes.data.data);
      setWeekly(weeklyRes.data.data);
      setMonthly(monthlyRes.data.data);
      setRankProgress(leaderboardRes?.data?.data?.userStats || null);
      setRankBadgeTiers(leaderboardRes?.data?.data?.badgeTiers || NUTRITION_BADGES);
      setFoodRecommendation(null);
    } catch {
      toast.error('Failed to load nutrition data');
    } finally {
      setLoading(false);
    }
  }, [date, todayKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLogForm(prev => ({ ...prev, imageFile: file, imageUrl: URL.createObjectURL(file), uploadedImageUrl: '' }));
    setAnalyzingImage(true);
    setAiResult(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const { data } = await nutritionAPI.analyzeImage(formData);
      
      if (data.success && data.data) {
        setAiResult(data.data);
        const { nutrition, foodName } = data.data;
        
        setLogForm(prev => ({
          ...prev,
          customName: foodName || prev.customName,
          quantity: getDetectedQuantity(data.data, prev.quantity),
          calories: nutrition?.calories || prev.calories,
          protein: nutrition?.protein || prev.protein,
          carbs: nutrition?.carbs || prev.carbs,
          fat: nutrition?.fat || prev.fat,
          fiber: nutrition?.fiber || prev.fiber,
          imageFile: data.data.imageUrl ? null : prev.imageFile,
          imageUrl: data.data.imageUrl || prev.imageUrl,
          uploadedImageUrl: data.data.imageUrl || '',
        }));
        
        toast.success(`Detected: ${foodName}`, { icon: '🎯' });
      }
    } catch {
      toast.error('AI Analysis failed. Please enter details manually.');
      setAiResult({ error: true });
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleLogMeal = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(logForm).forEach(([key, val]) => {
        if (key === 'imageFile' && val && !logForm.uploadedImageUrl) formData.append('image', val);
        else if (key === 'uploadedImageUrl' && val) formData.append('imageUrl', val);
        else if (!['imageFile', 'imageUrl', 'uploadedImageUrl'].includes(key)) formData.append(key, val);
      });
      
      await nutritionAPI.logMeal(formData);
      toast.success('Meal logged!', { icon: '🥗' });
      setShowLogForm(false);
      setLogForm(DEFAULT_LOG_FORM);
      setAiResult(null);
      fetchData();
    } catch {
      toast.error('Failed to log meal');
    }
  };

  const handleDeleteMeal = async (logId, mealId) => {
    if (!window.confirm("Are you sure you want to delete this meal?")) return;
    try {
      await nutritionAPI.deleteMeal(logId, mealId);
      toast.success('Meal deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete meal');
    }
  };

  const handleUpdateQuantity = async (logId, mealId, newQty) => {
    if (newQty < 1) return;
    try {
      await nutritionAPI.updateMealQuantity(logId, mealId, newQty);
      fetchData();
    } catch {
      toast.error('Failed to update quantity');
    }
  };

  const handleSaveGoals = async (e) => {
    e.preventDefault();
    try {
      const { data } = await nutritionAPI.updateGoals(goalsForm);
      if (updateUser && data.user) updateUser(data.user);
      toast.success('Goals updated successfully!');
      setShowGoalsModal(false);
      fetchData();
    } catch {
      toast.error('Failed to update goals');
    }
  };

  const changeDate = (delta) => {
    const nextDate = addDaysToDateKey(date, delta);
    if (nextDate > todayKey) return;
    setDate(nextDate);
  };

  const selectView = (viewId) => {
    setActiveView(viewId);
    setShowMobileSections(false);
  };

  const handleDietPreferenceChange = (nextPreference) => {
    setDietPreference(nextPreference);
    setFoodRecommendation(null);
  };

  const fetchFoodRecommendation = useCallback(async () => {
    const currentTotals = daily?.dailyTotals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    const currentGoals = {
      calories: user?.dailyCalorieGoal || 2200,
      protein: user?.dailyProteinGoal || 55,
      carbs: user?.dailyCarbGoal || 275,
      fat: user?.dailyFatGoal || 70,
      fiber: user?.dailyFiberGoal || 30,
    };

    if (hasMetDailyGoal(currentGoals, currentTotals)) {
      setFoodRecommendation({
        mode: 'goal_complete',
        title: 'Daily Goal Complete',
        summary: 'Yay! You have already met your daily nutrition goal. No extra food recommendation is needed right now.',
        dietPreference,
        remaining: getRemainingNutrition(currentGoals, currentTotals),
        recommendations: [],
        notes: ['Drink water and keep the streak steady.'],
        source: 'goal_complete',
      });
      toast.success('Yay! Daily goal already achieved.');
      return;
    }

    setRecommendationLoading(true);
    try {
      const { data } = await nutritionAPI.getRecommendations({ date, dietPreference });
      if (data.success && data.data) {
        setFoodRecommendation(data.data);
      }
    } catch {
      toast.error('Failed to generate food recommendations');
    } finally {
      setRecommendationLoading(false);
    }
  }, [daily, date, dietPreference, user]);

  const openLogForm = () => {
    const shouldToggle = activeView === 'daily';
    if (date !== todayKey) setDate(todayKey);
    setActiveView('daily');
    setShowMobileSections(false);
    setShowLogForm(prev => shouldToggle ? !prev : true);
  };

  const totals = daily?.dailyTotals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const goals = {
    calories: user?.dailyCalorieGoal || 2200,
    protein: user?.dailyProteinGoal || 55,
    carbs: user?.dailyCarbGoal || 275,
    fat: user?.dailyFatGoal || 70,
    fiber: user?.dailyFiberGoal || 30,
  };
  const isGoalsLocked = daily?.meals?.length > 0;
  const remainingGoals = getRemainingNutrition(goals, totals);
  const dailyGoalAchieved = hasMetDailyGoal(goals, totals);

  const macroData = [
    { name: 'Protein', value: Math.round((totals.protein || 0) * 100) / 100, goal: goals.protein, unit: 'g', color: COLORS[0] },
    { name: 'Carbs', value: Math.round((totals.carbs || 0) * 100) / 100, goal: goals.carbs, unit: 'g', color: COLORS[1] },
    { name: 'Fat', value: Math.round((totals.fat || 0) * 100) / 100, goal: goals.fat, unit: 'g', color: COLORS[2] },
  ];

  const pieData = macroData.filter(m => m.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="nutrition-page animate-fadeIn">
      {/* Page Header */}
      <div className="nutrition-header">
        <div className="min-w-0">
          <h1 className="text-[clamp(22px,5vw,32px)] font-semibold tracking-normal text-white drop-shadow-sm">
            <span className="text-primary-400">Smart</span> Nutrition
          </h1>
          <p className="text-surface-400 mt-1 capitalize text-[14px] md:text-base">Track, analyze, and conquer your goals automatically.</p>
        </div>
      </div>

      <div className="nutrition-subnav glass-card-static">
        <button
          type="button"
          onClick={() => setShowMobileSections(true)}
          className="nutrition-section-menu-btn"
          aria-label="Open nutrition sections"
        >
          <HiOutlineMenuAlt2 className="w-5 h-5" />
        </button>

        <div className="nutrition-view-tabs" aria-label="Nutrition sections">
          {nutritionViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => selectView(view.id)}
              className={`nutrition-view-tab ${activeView === view.id ? 'is-active' : ''}`}
            >
              {view.label}
            </button>
          ))}
        </div>

        <div className="nutrition-actions">
          <button onClick={() => setShowGoalsModal(true)} className="btn-secondary flex items-center justify-center gap-2 px-4 py-2 text-[14px] bg-surface-800/80 hover:bg-surface-700/80 text-surface-200 border border-surface-700/50 rounded-xl transition-all min-h-[44px]">
            <HiOutlineCog className="w-4 h-4" /> Goals
          </button>
          <button onClick={openLogForm} className="btn-primary flex items-center justify-center gap-2 px-5 py-2 shadow-[0_0_15px_rgba(255,71,20,0.3)] hover:shadow-[0_0_25px_rgba(255,71,20,0.5)] transition-shadow min-h-[44px]">
            <HiPlus className="w-4 h-4" /> {daily?.meals?.length > 0 ? "Add Meal" : "Log Meal"}
          </button>
        </div>
      </div>

      {showMobileSections && (
        <div className="nutrition-mobile-menu-layer" onClick={() => setShowMobileSections(false)}>
          <div className="nutrition-mobile-menu glass-card-static" onClick={(event) => event.stopPropagation()}>
            <div className="nutrition-mobile-menu-head">
              <div>
                <p className="text-xs font-bold text-primary-400 uppercase tracking-widest">Nutrition</p>
                <h2 className="text-lg font-black text-white">Sections</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileSections(false)}
                className="nutrition-mobile-menu-close"
                aria-label="Close nutrition sections"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>
            <div className="nutrition-mobile-menu-list">
              {nutritionViews.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => selectView(view.id)}
                  className={`nutrition-mobile-menu-item ${activeView === view.id ? 'is-active' : ''}`}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeView === 'daily' && (
        <>
          {/* Date Navigation */}
          <div className="nutrition-date-nav glass-card-static rounded-2xl flex items-center justify-between shadow-lg border border-surface-800/50">
            <button onClick={() => changeDate(-1)} className="p-3 bg-surface-800/50 rounded-xl hover:bg-surface-700 transition-colors text-surface-300 hover:text-white">
              <HiOutlineChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="font-bold text-surface-100 text-[15px]">{dateKeyToLocalDate(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
              {date === todayKey && (
                 <p className="text-xs font-semibold text-primary-400 uppercase tracking-widest mt-0.5 shadow-primary-400/20">Today</p>
              )}
            </div>
            <button
              onClick={() => changeDate(1)}
              disabled={date >= todayKey}
              className="p-3 bg-surface-800/50 rounded-xl hover:bg-surface-700 transition-colors text-surface-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-800/50"
              aria-label="Next nutrition day"
            >
              <HiOutlineChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* AI Log Form Section */}
          {showLogForm && (
        <div className="nutrition-card glass-card-static animate-slideDown border border-primary-500/20 shadow-[0_0_30px_rgba(255,71,20,0.05)]">
          <div className="nutrition-card-header">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 shadow-lg">
               <HiOutlineSparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">AI Food Scanner</h3>
              <p className="text-xs text-surface-400">Upload a picture and let AI calculate the macros.</p>
            </div>
          </div>

          <div className="nutrition-form-grid">
            {/* Image Upload Area */}
            <div className="flex flex-col gap-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative h-48 md:h-56 w-full rounded-2xl border-2 border-dashed ${logForm.imageUrl ? 'border-primary-500/50' : 'border-surface-600 hover:border-primary-500/50'} flex items-center justify-center cursor-pointer overflow-hidden transition-colors bg-surface-900/50 group`}
              >
                {logForm.imageUrl ? (
                  <>
                    <img src={logForm.imageUrl} alt="Food preview" className="w-full h-full object-cover transition-transform group-hover:scale-105" decoding="async" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-medium text-sm backdrop-blur-md px-3 py-1.5 rounded-full bg-white/10">Change Image</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center px-4">
                     <div className="w-12 h-12 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-3 shadow-inner group-hover:bg-primary-500/20 transition-colors">
                       <HiPlus className="w-6 h-6 text-surface-400 group-hover:text-primary-400 transition-colors" />
                     </div>
                     <p className="text-sm font-medium text-surface-300">Tap to upload food image</p>
                     <p className="text-xs text-surface-500 mt-1">JPEG, PNG, WebP</p>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
              </div>
              
              {analyzingImage && (
                <div className="p-4 rounded-xl bg-primary-900/20 border border-primary-500/20 flex flex-col items-center justify-center gap-3 animate-pulse">
                   <div className="flex gap-1.5">
                     <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                     <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                     <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                   </div>
                   <p className="text-xs font-semibold text-primary-400">Analyzing nutrition...</p>
                </div>
              )}
            </div>

            {/* Manual Edit Area */}
            <div className="flex flex-col justify-end">
              <form onSubmit={handleLogMeal} className="flex flex-col gap-5">
                <div className="nutrition-field-grid">
                  <div>
                    <label className="block text-xs font-semibold text-surface-400 mb-1 uppercase tracking-wider">Food Name</label>
                    <input value={logForm.customName} onChange={e => setLogForm({ ...logForm, customName: e.target.value })} 
                      className={`input-field w-full ${aiResult?.foodName ? 'border-primary-500/50 bg-primary-900/10 text-primary-100' : ''}`} 
                      placeholder="e.g., Grilled Chicken Salad" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-400 mb-1 uppercase tracking-wider">Meal Type</label>
                    <select value={logForm.mealType} onChange={e => setLogForm({ ...logForm, mealType: e.target.value })} className="input-field w-full">
                      <option value="breakfast">Breakfast</option>
                      <option value="lunch">Lunch</option>
                      <option value="snack">Snack</option>
                      <option value="dinner">Dinner</option>
                    </select>
                  </div>
                </div>

                <div className="glass-card-static p-4 md:p-5 bg-surface-900/50 border border-surface-800">
                  <div className="nutrition-macro-grid">
                    <div>
                      <label className="block text-xs font-semibold text-surface-400 mb-1 uppercase text-center">Qty</label>
                      <input type="number" value={logForm.quantity} onChange={e => setLogForm({ ...logForm, quantity: e.target.value })} 
                        className={`input-field w-full text-center px-1 font-bold ${aiResult?.quantity ? 'border-primary-500/50 text-white' : ''}`} placeholder="1" min="1" step="0.1" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-surface-400 mb-1 uppercase text-center leading-tight">Kcal / Unit</label>
                      <input type="number" value={logForm.calories} onChange={e => setLogForm({ ...logForm, calories: e.target.value })} 
                        className={`input-field w-full text-center px-1 ${aiResult ? 'border-primary-500/50 text-white font-bold' : ''}`} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-surface-400 mb-1 uppercase text-center leading-tight">Protein / Unit</label>
                      <input type="number" value={logForm.protein} onChange={e => setLogForm({ ...logForm, protein: e.target.value })} 
                        className={`input-field w-full text-center px-1 ${aiResult ? 'border-primary-500/50' : ''}`} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-surface-400 mb-1 uppercase text-center leading-tight">Carb / Unit</label>
                      <input type="number" value={logForm.carbs} onChange={e => setLogForm({ ...logForm, carbs: e.target.value })} 
                        className={`input-field w-full text-center px-1 ${aiResult ? 'border-primary-500/50' : ''}`} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-surface-400 mb-1 uppercase text-center leading-tight">Fibre / Unit</label>
                      <input type="number" value={logForm.fiber} onChange={e => setLogForm({ ...logForm, fiber: e.target.value })} 
                        className={`input-field w-full text-center px-1 ${aiResult ? 'border-primary-500/50' : ''}`} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-surface-400 mb-1 uppercase text-center leading-tight">Fat / Unit</label>
                      <input type="number" value={logForm.fat} onChange={e => setLogForm({ ...logForm, fat: e.target.value })} 
                        className={`input-field w-full text-center px-1 ${aiResult ? 'border-primary-500/50' : ''}`} placeholder="0" />
                    </div>
                  </div>
                </div>

                <div className="nutrition-form-actions">
                  <button type="button" onClick={() => setShowLogForm(false)} className="btn-secondary w-full md:w-auto px-6 py-2 min-h-[44px]">Cancel</button>
                  <button type="submit" className="btn-primary w-full shadow-lg shadow-primary-500/20 tracking-wide font-bold py-2.5" disabled={analyzingImage || loading}>
                    Save Meal Entry
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
          )}

          {/* Main Dashboard Grid */}
          <div className="nutrition-summary-grid">
        
        {/* Calorie Ring summary */}
        <div className="nutrition-card nutrition-stat-card glass-card-static items-center justify-center relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl group-hover:bg-primary-500/20 transition-colors" />
          
          <h3 className="text-sm font-semibold text-surface-400 mb-2 uppercase tracking-wider relative z-10 text-center w-full">Daily Intake</h3>
          
          <div className="relative w-44 h-44 my-4 z-10 transition-transform group-hover:scale-105 duration-500">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ value: Math.min(totals.calories, goals.calories) }, { value: Math.max(0, goals.calories - totals.calories) }]}
                  cx="50%" cy="50%" innerRadius={65} outerRadius={80} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                  <Cell fill="url(#colorCalories)" style={{ filter: 'drop-shadow(0px 0px 8px rgba(224,100,73,0.6))' }} />
                  <Cell fill="rgba(148,163,184,0.05)" />
                </Pie>
                <defs>
                  <linearGradient id="colorCalories" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e06449" stopOpacity={1} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={1} />
                  </linearGradient>
                </defs>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <HiOutlineFire className="w-5 h-5 text-primary-400 mb-0.5 drop-shadow-[0_0_5px_rgba(224,100,73,0.8)]" />
              <p className="text-3xl font-black text-white">{totals.calories}</p>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-widest mt-0.5">/ {goals.calories} kcal</p>
            </div>
          </div>
          
          <div className="relative z-10 flex gap-6 text-sm">
            <div className="text-center">
               <p className="font-bold text-surface-100">{totals.calories}</p>
               <p className="text-xs text-surface-500 uppercase">Eaten</p>
            </div>
            <div className="w-px bg-surface-700/50" />
            <div className="text-center">
               <p className="font-bold text-surface-100">{Math.max(0, goals.calories - totals.calories)}</p>
               <p className="text-xs text-surface-500 uppercase">Left</p>
            </div>
          </div>
        </div>

        {/* Macro Breakdown */}
        <div className="nutrition-card nutrition-stat-card glass-card-static justify-center">
          <h3 className="text-sm font-semibold text-surface-400 mb-5 uppercase tracking-wider">Macros vs Goals</h3>
          <div className="space-y-6">
            {macroData.map(m => (
              <div key={m.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-surface-200">{m.name}</span>
                  <span className="font-semibold text-surface-100">
                    {m.value} <span className="text-surface-500 font-normal">/ {m.goal}{m.unit}</span>
                    <span className="ml-2 text-xs text-surface-400">({Math.round((m.value / m.goal) * 100)}%)</span>
                  </span>
                </div>
                <div className="w-full h-2.5 bg-surface-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(100, (m.value / m.goal) * 100)}%`, background: m.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Macro Pie distribution */}
        <div className="nutrition-card nutrition-stat-card glass-card-static flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-surface-400 mb-4 uppercase tracking-wider">Caloric Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={60} dataKey="value" stroke="#1e293b" paddingAngle={2}
                  labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => `${Math.round(value)} kcal`} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-surface-500 text-sm">Log a meal to see distribution</p>
            </div>
          )}
          <div className="flex gap-4 mt-2 text-xs text-surface-300">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: COLORS[0] }} /> Protein</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: COLORS[1] }} /> Carbs</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: COLORS[2] }} /> Fat</span>
          </div>
        </div>
          </div>

          <div className="nutrition-card nutrition-recommendation-card glass-card-static">
            <div className="nutrition-recommendation-head">
              <div className="nutrition-recommendation-title">
                <p className="text-xs font-bold text-primary-400 uppercase">Food Recommendation</p>
                <h3 className="text-lg font-bold text-white">
                  {daily?.meals?.length > 0 ? 'Complete Remaining Goals' : 'Suggested Diet For Today'}
                </h3>
              </div>

              <div className="nutrition-preference-controls" aria-label="Diet preference">
                {[
                  { value: 'veg', label: 'Veg' },
                  { value: 'non-veg', label: 'Non-Veg' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleDietPreferenceChange(option.value)}
                    className={`nutrition-preference-btn ${dietPreference === option.value ? 'is-active' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="nutrition-recommendation-body">
              <div className="nutrition-recommendation-metrics">
                {[
                  { key: 'calories', label: 'Kcal', unit: '' },
                  { key: 'protein', label: 'Protein', unit: 'g' },
                  { key: 'carbs', label: 'Carbs', unit: 'g' },
                  { key: 'fat', label: 'Fat', unit: 'g' },
                  { key: 'fiber', label: 'Fiber', unit: 'g' },
                ].map((metric) => {
                  return (
                    <div className="nutrition-recommendation-metric" key={metric.key}>
                      <span>{metric.label}</span>
                      <strong>{formatNutritionNumber(remainingGoals[metric.key])}{metric.unit}</strong>
                    </div>
                  );
                })}
              </div>

              {foodRecommendation?.summary && (
                <p className="nutrition-recommendation-summary">{foodRecommendation.summary}</p>
              )}

              {foodRecommendation?.currentMealWindow && foodRecommendation.mode !== 'day_plan' && foodRecommendation.mode !== 'goal_complete' && (
                <p className="nutrition-recommendation-source">
                  Local window: {foodRecommendation.currentMealWindow.label} {foodRecommendation.currentMealWindow.startsAt}-{foodRecommendation.currentMealWindow.endsAt}
                </p>
              )}

              {recommendationLoading ? (
                <div className="nutrition-recommendation-loading">
                  <span />
                  <span />
                  <span />
                  <p>Generating recommendations...</p>
                </div>
              ) : foodRecommendation?.recommendations?.length > 0 ? (
                <div className="nutrition-recommendation-list">
                  {foodRecommendation.recommendations.map((item, index) => (
                    <article className="nutrition-recommendation-item" key={`${item.itemName}-${index}`}>
                      <div className="nutrition-recommendation-main">
                        <div>
                          <p className="nutrition-recommendation-name">{item.itemName}</p>
                          <p className="nutrition-recommendation-reason">{item.reason}</p>
                        </div>
                        <div className="nutrition-recommendation-tags">
                          <span>{item.mealType}</span>
                          <span>{item.quantity}x</span>
                          {item.fromMenu && <span>Menu</span>}
                        </div>
                      </div>
                      <div className="nutrition-recommendation-macros">
                        <span>{formatNutritionNumber(item.estimatedNutrition?.calories)} kcal</span>
                        <span>P {formatNutritionNumber(item.estimatedNutrition?.protein)}g</span>
                        <span>C {formatNutritionNumber(item.estimatedNutrition?.carbs)}g</span>
                        <span>F {formatNutritionNumber(item.estimatedNutrition?.fat)}g</span>
                        <span>Fi {formatNutritionNumber(item.estimatedNutrition?.fiber)}g</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nutrition-recommendation-empty">
                  <p>
                    {foodRecommendation?.mode === 'goal_complete'
                      ? 'You are done for today. Keep it light unless you genuinely need another meal.'
                      : daily?.meals?.length > 0 ? 'Find the best items for the remaining macro gaps.' : 'Generate a balanced plan before your first meal.'}
                  </p>
                </div>
              )}

              <div className="nutrition-recommendation-actions">
                <button
                  type="button"
                  onClick={fetchFoodRecommendation}
                  className="btn-primary min-h-[44px] px-5"
                  disabled={recommendationLoading}
                >
                  {dailyGoalAchieved || foodRecommendation?.mode === 'goal_complete'
                    ? 'Goal Achieved'
                    : foodRecommendation ? 'Refresh Recommendation' : 'Get Recommendation'}
                </button>
              </div>
            </div>
          </div>

          {/* Today's Meals List */}
          <div className="nutrition-card glass-card-static overflow-hidden p-0">
        <div className="nutrition-meals-header border-b border-surface-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Meals Logged ({daily?.meals?.length || 0})</h3>
        </div>

        {daily?.meals?.length > 0 ? (
          <div className="divide-y divide-surface-800">
            {daily.meals.map((meal, i) => {
              const qty = meal.quantity || 1;
              return (
                <div key={meal._id || i} className="nutrition-meal-row hover:bg-surface-800/30 transition-colors group">
                  <div className="nutrition-meal-main">
                    {meal.imageUrl ? (
                      <img src={getImageUrl(meal.imageUrl)} alt={meal.customName} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-surface-800 flex items-center justify-center text-xl flex-shrink-0">
                        {meal.mealType === 'breakfast' ? '🌅' : meal.mealType === 'lunch' ? '☀️' : meal.mealType === 'dinner' ? '🌙' : '🍿'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[14px] md:text-base font-medium text-surface-100 truncate">{meal.customName || meal.menuItem?.name}</p>
                      <p className="text-xs text-surface-500 capitalize">{meal.mealType} {meal.isAutoLogged ? '• Auto' : ''}</p>
                    </div>
                  </div>

                  <div className="nutrition-meal-footer">
                    {/* Quantity Controls */}
                    <div className="nutrition-meal-controls">
                      <button
                        onClick={() => qty > 1 ? handleUpdateQuantity(daily._id, meal._id, qty - 1) : handleDeleteMeal(daily._id, meal._id)}
                        className="min-w-[44px] min-h-[44px] rounded-lg bg-surface-700/60 flex items-center justify-center hover:bg-surface-600/60 text-surface-300 hover:text-white transition-colors"
                        title={qty <= 1 ? 'Remove meal' : 'Decrease quantity'}
                      >
                        {qty <= 1 ? <HiOutlineTrash className="w-3.5 h-3.5 text-red-400" /> : <HiMinus className="w-3.5 h-3.5" />}
                      </button>
                      <span className="min-w-5 text-center font-semibold text-[14px] text-surface-100">{qty}</span>
                      <button
                        onClick={() => handleUpdateQuantity(daily._id, meal._id, qty + 1)}
                        className="min-w-[44px] min-h-[44px] rounded-lg bg-surface-700/60 flex items-center justify-center hover:bg-surface-600/60 text-surface-300 hover:text-white transition-colors"
                        title="Increase quantity"
                      >
                        <HiPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Calories & Macros */}
                    <div className="nutrition-meal-macros flex-shrink-0">
                      <p className="font-bold text-surface-100">{meal.calories * qty} <span className="text-xs text-surface-400 font-normal">kcal</span></p>
                      <p className="text-xs text-surface-400 mt-1">P:{Math.round(meal.protein * qty * 100) / 100}g C:{Math.round(meal.carbs * qty * 100) / 100}g F:{Math.round(meal.fat * qty * 100) / 100}g</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 px-5 text-center">
            <p className="text-surface-500">No meals logged for this day</p>
          </div>
        )}

          </div>
        </>
      )}

      {activeView === 'analysis' && (
        <div className="nutrition-card nutrition-analysis-panel glass-card-static">
        <div className="nutrition-analysis-top">
          <div className="nutrition-analysis-title">
            <p className="text-xs font-bold text-primary-400 uppercase tracking-widest mb-1">Analysis</p>
            <h3 className="text-lg font-black text-white">Your Rank Progress</h3>
          </div>

          <RankProgressSummary userStats={rankProgress} badgeTiers={rankBadgeTiers} />
        </div>

        <div className="nutrition-chart-header nutrition-analysis-header">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Calorie Trend</h3>
          </div>
          <div className="nutrition-chart-toggle">
            <button type="button" onClick={() => setChartView('weekly')}
              className={`nutrition-chart-toggle-btn ${chartView === 'weekly' ? 'is-active' : ''}`}>
              Weekly
            </button>
            <button type="button" onClick={() => setChartView('monthly')}
              className={`nutrition-chart-toggle-btn ${chartView === 'monthly' ? 'is-active' : ''}`}>
              Monthly
            </button>
          </div>
        </div>

        {chartView === 'weekly' ? (
          weekly.length > 0 ? (
            <div className="nutrition-chart-frame">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })} />
                  <YAxis
                    width={30}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 'dataMax + 50']}
                  />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, color: '#f1f5f9' }} />
                  <Bar dataKey="calories" fill="#e06449" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-surface-500 text-center py-10">No weekly data</p>
        ) : (
          monthly.length > 0 ? (
            <div className="nutrition-chart-frame">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
                  <YAxis
                    width={30}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 'dataMax + 50']}
                  />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, color: '#f1f5f9' }} />
                  <Line type="monotone" dataKey="calories" stroke="#e06449" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#e06449', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-surface-500 text-center py-10">No monthly data</p>
        )}
        </div>
      )}

      {activeView === 'leaderboard' && (
        <div className="nutrition-leaderboard">
          <LeaderboardWidget onOpenFull={() => setShowFullLeaderboard(true)} />
        </div>
      )}

      {activeView === 'instructions' && (
        <section className="nutrition-instructions-page animate-fadeIn">
          <section className="faq-hero nutrition-instructions-hero glass-card-static">
            <div>
              <p className="faq-kicker">Ranking Guide</p>
              <h1>How Nutrition Rank Works</h1>
              <p>Short answers for consistency, XP, adherence, badges, progress score, and leaderboard order.</p>
            </div>
            <div className="faq-hero-icon gradient-primary">
              <HiOutlineStar className="text-white" />
            </div>
          </section>

          <section className="faq-grid nutrition-instructions-grid">
            {rankingInstructionGroups.map((group) => {
              const Icon = group.icon;
              return (
                <article className="faq-group nutrition-instructions-group glass-card-static" key={group.title}>
                  <div className="faq-group-head">
                    <span>
                      <Icon className="w-5 h-5" />
                    </span>
                    <h2>{group.title}</h2>
                  </div>

                  <div className="faq-list">
                    {group.items.map((item) => (
                      <details className="faq-item nutrition-instructions-item" key={item.question}>
                        <summary>{item.question}</summary>
                        <p>{item.answer}</p>
                      </details>
                    ))}
                  </div>
                </article>
              );
            })}
          </section>
        </section>
      )}

      {/* Goals Editor Modal */}
      {showGoalsModal && createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="goals-modal-panel glass-card-static animate-slideUp border border-surface-700 z-[2001]">
            <div className="goals-modal-header border-b border-surface-800">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white">Edit Nutrition Goals</h2>
                <p className="text-[14px] text-surface-400 mt-1">Set your daily targets for calories, macros, and fiber.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGoalsModal(false)}
                className="goals-close-btn bg-surface-800/50 hover:bg-surface-700 text-surface-400 hover:text-white transition-colors"
                aria-label="Close goals editor"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>
            
            <div className="goals-modal-body">
              {isGoalsLocked && (
                <div className="goals-lock-alert bg-orange-900/20 border border-orange-500/20 text-orange-200">
                  <HiOutlineLockClosed className="w-5 h-5 flex-shrink-0 text-orange-400" />
                  <div>
                    <p className="font-semibold">Goals are locked for today.</p>
                    <p className="text-[14px] mt-1">You have already logged a meal, so goals can be adjusted tomorrow morning before eating to keep leaderboard scoring fair.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveGoals} className="goals-form">
                <div className="goals-field-grid goals-field-grid-primary">
                  <div className="goals-field">
                    <label className="text-surface-300">Daily Calories</label>
                    <input type="number" className="input-field" value={goalsForm.dailyCalorieGoal} onChange={e => setGoalsForm({ ...goalsForm, dailyCalorieGoal: e.target.value })} required disabled={isGoalsLocked} />
                  </div>
                  <div className="goals-field">
                    <label className="text-surface-300">Fiber (g)</label>
                    <input type="number" className="input-field" value={goalsForm.dailyFiberGoal} onChange={e => setGoalsForm({ ...goalsForm, dailyFiberGoal: e.target.value })} required disabled={isGoalsLocked} />
                  </div>
                  <div className="goals-field">
                    <label className="text-surface-300">Protein (g)</label>
                    <input type="number" className="input-field" value={goalsForm.dailyProteinGoal} onChange={e => setGoalsForm({ ...goalsForm, dailyProteinGoal: e.target.value })} required disabled={isGoalsLocked} />
                  </div>
                </div>

                <div className="goals-field-grid goals-field-grid-macros">
                  <div className="goals-field">
                    <label className="text-surface-300">Carbs (g)</label>
                    <input type="number" className="input-field" value={goalsForm.dailyCarbGoal} onChange={e => setGoalsForm({ ...goalsForm, dailyCarbGoal: e.target.value })} required disabled={isGoalsLocked} />
                  </div>
                  <div className="goals-field">
                    <label className="text-surface-300">Fat (g)</label>
                    <input type="number" className="input-field" value={goalsForm.dailyFatGoal} onChange={e => setGoalsForm({ ...goalsForm, dailyFatGoal: e.target.value })} required disabled={isGoalsLocked} />
                  </div>
                </div>

                <div className="goals-actions">
                  <button type="button" onClick={() => setShowGoalsModal(false)} className="btn-secondary min-h-[48px]">Cancel</button>
                  <button type="submit" className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]" disabled={isGoalsLocked}>
                    {isGoalsLocked ? 'Goals locked today' : 'Save Goals'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Full Leaderboard Modal */}
      {showFullLeaderboard && (
        <Suspense fallback={null}>
          <LeaderboardModal onClose={() => setShowFullLeaderboard(false)} />
        </Suspense>
      )}
    </div>
  );
}
