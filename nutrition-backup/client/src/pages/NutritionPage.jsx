import { useState, useEffect, useRef } from 'react';
import { nutritionAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { HiOutlineFire, HiOutlineChevronLeft, HiOutlineChevronRight, HiPlus, HiMinus, HiOutlineTrash, HiOutlineCog, HiOutlineSparkles } from 'react-icons/hi';
import toast from 'react-hot-toast';

const COLORS = ['#e06449', '#facc15', '#3b82f6', '#10b981'];

export default function NutritionPage() {
  const { user, updateUser } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [chartView, setChartView] = useState('weekly');
  const fileInputRef = useRef(null);

  const [logForm, setLogForm] = useState({
    customName: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', mealType: 'snack', imageFile: null, imageUrl: ''
  });
  const [goalsForm, setGoalsForm] = useState({
    dailyCalorieGoal: user?.dailyCalorieGoal || 2000,
    dailyProteinGoal: user?.dailyProteinGoal || 50,
    dailyCarbGoal: user?.dailyCarbGoal || 250,
    dailyFatGoal: user?.dailyFatGoal || 65,
  });

  const [loading, setLoading] = useState(true);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dailyRes, weeklyRes, monthlyRes] = await Promise.all([
        nutritionAPI.getDaily(date),
        nutritionAPI.getWeekly(),
        nutritionAPI.getMonthly()
      ]);
      setDaily(dailyRes.data.data);
      setWeekly(weeklyRes.data.data);
      setMonthly(monthlyRes.data.data);
    } catch (err) {
      toast.error('Failed to load nutrition data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setLogForm(prev => ({ ...prev, imageFile: file, imageUrl: objectUrl }));
    setAiResult(null);
  };

  const analyzeImageWithAI = async () => {
    if (!logForm.imageFile) {
      toast.error('Please upload an image first');
      return;
    }

    setAnalyzingImage(true);
    toast.loading('🤖 AI is analyzing your food...', { id: 'ai-toast' });

    try {
      const formData = new FormData();
      formData.append('image', logForm.imageFile);

      const res = await nutritionAPI.analyzeImage(formData);
      const data = res.data.data;

      toast.dismiss('ai-toast');
      toast.success(`Detected: ${data.foodName} (${(data.confidence * 100).toFixed(0)}%)`);

      setAiResult(data);
      setLogForm(prev => ({
        ...prev,
        customName: data.foodName,
        calories: data.nutrition.calories,
        protein: data.nutrition.protein,
        carbs: data.nutrition.carbs,
        fat: data.nutrition.fat,
        fiber: data.nutrition.fiber || 0,
        imageUrl: res.data.imageUrl || prev.imageUrl
      }));
      setAnalyzingImage(false);
    } catch (err) {
      toast.dismiss('ai-toast');
      toast.error('AI Analysis failed. Please fill manually.');
      console.error(err);
      setAnalyzingImage(false);
    }
  };

  const handleLogMeal = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(logForm).forEach(([key, val]) => {
        if (key === 'imageFile' && val) {
          formData.append('image', val);
        } else if (key !== 'imageUrl' && key !== 'imageFile') {
          formData.append(key, val);
        }
      });
      await nutritionAPI.logMeal(formData);
      toast.success('Meal logged!', { icon: '🥗' });
      setShowLogForm(false);
      setLogForm({ customName: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', mealType: 'snack', imageFile: null, imageUrl: '' });
      setAiResult(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to log meal');
    }
  };

  const handleDeleteMeal = async (logId, mealId) => {
    if (!window.confirm("Are you sure you want to delete this meal?")) return;
    try {
      await nutritionAPI.deleteMeal(logId, mealId);
      toast.success('Meal deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete meal');
    }
  };

  const handleUpdateQuantity = async (logId, mealId, newQty) => {
    if (newQty < 1) return;
    try {
      await nutritionAPI.updateMealQuantity(logId, mealId, newQty);
      fetchData();
    } catch (err) {
      toast.error('Failed to update quantity');
    }
  };

  const handleSaveGoals = async (e) => {
    e.preventDefault();
    try {
      const res = await nutritionAPI.updateGoals({
        dailyCalorieGoal: Number(goalsForm.dailyCalorieGoal),
        dailyProteinGoal: Number(goalsForm.dailyProteinGoal),
        dailyCarbGoal: Number(goalsForm.dailyCarbGoal),
        dailyFatGoal: Number(goalsForm.dailyFatGoal)
      });

      updateUser({
        dailyCalorieGoal: res.data.user.dailyCalorieGoal,
        dailyProteinGoal: res.data.user.dailyProteinGoal,
        dailyCarbGoal: res.data.user.dailyCarbGoal,
        dailyFatGoal: res.data.user.dailyFatGoal
      });

      toast.success('Goals updated!');
      setShowGoalsModal(false);
    } catch (err) {
      toast.error('Failed to update goals');
    }
  };

  const changeDate = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  };

  const totals = daily?.dailyTotals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const goals = {
    calories: user?.dailyCalorieGoal || 2000,
    protein: user?.dailyProteinGoal || 50,
    carbs: user?.dailyCarbGoal || 250,
    fat: user?.dailyFatGoal || 65,
  };

  const getProgressColor = (value, goal) => {
    const pct = (value / goal) * 100;
    if (pct < 80) return '#10b981';
    if (pct <= 100) return '#facc15';
    return '#ef4444';
  };

  const macroData = [
    { name: 'Protein', value: totals.protein, goal: goals.protein, unit: 'g', color: getProgressColor(totals.protein, goals.protein) },
    { name: 'Carbs', value: totals.carbs, goal: goals.carbs, unit: 'g', color: getProgressColor(totals.carbs, goals.carbs) },
    { name: 'Fat', value: totals.fat, goal: goals.fat, unit: 'g', color: getProgressColor(totals.fat, goals.fat) },
  ];

  const pieData = [
    { name: 'Protein', value: totals.protein * 4 },
    { name: 'Carbs', value: totals.carbs * 4 },
    { name: 'Fat', value: totals.fat * 9 }
  ].filter(m => m.value > 0);

  return (
    <div className="animate-fadeIn relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="text-primary-400">Nutrition</span> Tracker
          </h1>
          <p className="text-surface-400 mt-1">Track your daily intake and goals</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGoalsModal(true)} className="btn-secondary flex items-center gap-2 text-sm p-2">
            <HiOutlineCog className="w-5 h-5" /> <span className="hidden sm:inline">Goals</span>
          </button>
          <button onClick={() => setShowLogForm(!showLogForm)} className="btn-primary flex items-center gap-2 text-sm">
            <HiPlus className="w-5 h-5" /> <span className="hidden sm:inline">Log Meal</span>
          </button>
        </div>
      </div>

      {/* Date Picker */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={() => changeDate(-1)} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <HiOutlineChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center w-48">
          <p className="font-semibold">{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p className="text-xs text-primary-400 font-medium">{date === new Date().toISOString().split('T')[0] ? 'Today' : ''}</p>
        </div>
        <button onClick={() => changeDate(1)} className="p-2 rounded-lg hover:bg-white/5 transition-colors" disabled={date === new Date().toISOString().split('T')[0]}>
          <HiOutlineChevronRight className={`w-5 h-5 ${date === new Date().toISOString().split('T')[0] ? 'opacity-30' : ''}`} />
        </button>
      </div>

      {/* Manual Meal Log Form */}
      {showLogForm && (
        <div className="glass-card-static p-5 mb-6 animate-slideUp">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">Log Outside Meal</h3>
            <button onClick={() => setShowLogForm(false)} className="text-surface-400 hover:text-white">✕</button>
          </div>
          <form onSubmit={handleLogMeal} className="space-y-4">

            {/* Image Upload Area */}
            <div className="border-2 border-dashed border-surface-600 rounded-xl p-4 text-center">
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />

              {logForm.imageUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <img src={logForm.imageUrl} alt="preview" className="w-32 h-32 object-cover rounded-lg shadow-md" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs btn-secondary py-1 px-3">Change Image</button>
                    <button type="button" onClick={analyzeImageWithAI} disabled={analyzingImage} className="text-xs btn-primary flex items-center gap-1 py-1 px-3">
                      <HiOutlineSparkles className="w-4 h-4" /> {analyzingImage ? 'Analyzing...' : 'Analyze with AI'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  <p className="text-surface-400 text-sm mb-2">Upload a photo to automatically log nutrition using AI</p>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary py-2 px-4 text-sm">
                    Select Photo
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={logForm.customName} onChange={e => setLogForm({ ...logForm, customName: e.target.value })} className="input-field" placeholder="Meal name (e.g. McDonald's Burger)" required />
              <select value={logForm.mealType} onChange={e => setLogForm({ ...logForm, mealType: e.target.value })} className="input-field">
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="snack">Snack</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <input type="number" value={logForm.calories} onChange={e => setLogForm({ ...logForm, calories: e.target.value })} className="input-field px-2" placeholder="Calories" required />
              <input type="number" value={logForm.protein} onChange={e => setLogForm({ ...logForm, protein: e.target.value })} className="input-field px-2" placeholder="Pro (g)" required />
              <input type="number" value={logForm.carbs} onChange={e => setLogForm({ ...logForm, carbs: e.target.value })} className="input-field px-2" placeholder="Carb (g)" required />
              <input type="number" value={logForm.fat} onChange={e => setLogForm({ ...logForm, fat: e.target.value })} className="input-field px-2" placeholder="Fat (g)" required />
              <input type="number" value={logForm.fiber} onChange={e => setLogForm({ ...logForm, fiber: e.target.value })} className="input-field px-2" placeholder="Fib (g)" />
            </div>

            <button type="submit" className="btn-success w-full py-3 mt-2 text-lg">Save Meal</button>
          </form>
        </div>
      )}

      {/* Calorie Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Calorie Ring */}
        <div className="glass-card-static p-5 flex flex-col items-center">
          <HiOutlineFire className="w-6 h-6 text-orange-400 mb-2" />
          <div className="relative w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ value: Math.min(totals.calories, goals.calories) }, { value: Math.max(0, goals.calories - totals.calories) }]}
                  cx="50%" cy="50%" innerRadius={55} outerRadius={75} startAngle={90} endAngle={-270} dataKey="value"
                  animationDuration={1500} stroke="none"
                >
                  <Cell fill={getProgressColor(totals.calories, goals.calories)} />
                  <Cell fill="rgba(148,163,184,0.1)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold">{totals.calories}</p>
              <p className="text-xs text-surface-400">/ {goals.calories} kcal</p>
            </div>
          </div>
          <p className="text-sm font-semibold mt-3 text-surface-200">
            {totals.calories > goals.calories ? 'Over Goal by ' + (totals.calories - goals.calories) : (goals.calories - totals.calories) + ' remaining'}
          </p>
        </div>

        {/* Macro Breakdown */}
        <div className="glass-card-static p-5">
          <h3 className="text-sm font-semibold text-surface-400 mb-4 uppercase tracking-wider">Macros vs Goals</h3>
          <div className="space-y-5">
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
        <div className="glass-card-static p-5 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-surface-400 mb-3 uppercase tracking-wider">Caloric Distribution</h3>
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

      {/* Trend Charts */}
      <div className="glass-card-static p-5 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Calorie Trend</h3>
          <div className="bg-surface-800 rounded-lg p-1 flex">
            <button onClick={() => setChartView('weekly')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${chartView === 'weekly' ? 'bg-primary-500 text-white' : 'text-surface-400 hover:text-surface-200'}`}>
              Weekly
            </button>
            <button onClick={() => setChartView('monthly')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${chartView === 'monthly' ? 'bg-primary-500 text-white' : 'text-surface-400 hover:text-surface-200'}`}>
              Monthly
            </button>
          </div>
        </div>

        {chartView === 'weekly' ? (
          weekly.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, color: '#f1f5f9' }} />
                <Bar dataKey="calories" fill="#e06449" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-surface-500 text-center py-10">No weekly data</p>
        ) : (
          monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, color: '#f1f5f9' }} />
                <Line type="monotone" dataKey="calories" stroke="#e06449" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-surface-500 text-center py-10">No monthly data</p>
        )}
      </div>

      {/* Today's Meals List */}
      <div className="glass-card-static rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-surface-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Meals Logged ({daily?.meals?.length || 0})</h3>
        </div>

        {daily?.meals?.length > 0 ? (
          <div className="divide-y divide-surface-800">
            {daily.meals.map((meal, i) => {
              const qty = meal.quantity || 1;
              return (
                <div key={meal._id || i} className="p-4 sm:p-5 flex items-center justify-between hover:bg-surface-800/30 transition-colors group">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    {meal.imageUrl ? (
                      <img src={meal.imageUrl.startsWith('/') || meal.imageUrl.startsWith('http') ? meal.imageUrl : `/${meal.imageUrl}`} alt={meal.customName} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-surface-800 flex items-center justify-center text-xl flex-shrink-0">
                        {meal.mealType === 'breakfast' ? '🌅' : meal.mealType === 'lunch' ? '☀️' : meal.mealType === 'dinner' ? '🌙' : '🍿'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-medium text-surface-100 truncate">{meal.customName || meal.menuItem?.name}</p>
                      <p className="text-xs text-surface-500 capitalize">{meal.mealType} {meal.isAutoLogged ? '• Auto' : ''}</p>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 mx-3">
                    <button
                      onClick={() => qty > 1 ? handleUpdateQuantity(daily._id, meal._id, qty - 1) : handleDeleteMeal(daily._id, meal._id)}
                      className="w-7 h-7 rounded-lg bg-surface-700/60 flex items-center justify-center hover:bg-surface-600/60 text-surface-300 hover:text-white transition-colors"
                      title={qty <= 1 ? 'Remove meal' : 'Decrease quantity'}
                    >
                      {qty <= 1 ? <HiOutlineTrash className="w-3.5 h-3.5 text-red-400" /> : <HiMinus className="w-3.5 h-3.5" />}
                    </button>
                    <span className="w-6 text-center font-semibold text-sm text-surface-100">{qty}</span>
                    <button
                      onClick={() => handleUpdateQuantity(daily._id, meal._id, qty + 1)}
                      className="w-7 h-7 rounded-lg bg-surface-700/60 flex items-center justify-center hover:bg-surface-600/60 text-surface-300 hover:text-white transition-colors"
                      title="Increase quantity"
                    >
                      <HiPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Calories & Macros */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-surface-100">{meal.calories * qty} <span className="text-xs text-surface-400 font-normal">kcal</span></p>
                    <p className="text-xs text-surface-400 mt-0.5">P:{(meal.protein * qty).toFixed(0)}g C:{(meal.carbs * qty).toFixed(0)}g F:{(meal.fat * qty).toFixed(0)}g</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-surface-500">No meals logged for this day</p>
          </div>
        )}

        {/* Always-visible Add Meal row */}
        <div className="p-4 border-t border-surface-800">
          <button
            onClick={() => setShowLogForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-surface-600 text-surface-400 hover:border-primary-500 hover:text-primary-400 transition-colors"
          >
            <HiPlus className="w-5 h-5" /> Add another meal
          </button>
        </div>
      </div>

      {/* Goals Editor Modal */}
      {showGoalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card-static w-full max-w-md p-6 animate-slideUp border border-surface-700">
            <h2 className="text-xl font-bold mb-4">Edit Nutrition Goals</h2>
            <p className="text-surface-400 text-sm mb-6">Update your daily targets. The charts will automatically update to reflect your new goals.</p>

            <form onSubmit={handleSaveGoals} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">Daily Calories</label>
                <input type="number" className="input-field" value={goalsForm.dailyCalorieGoal} onChange={e => setGoalsForm({ ...goalsForm, dailyCalorieGoal: e.target.value })} required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1">Protein (g)</label>
                  <input type="number" className="input-field px-2" value={goalsForm.dailyProteinGoal} onChange={e => setGoalsForm({ ...goalsForm, dailyProteinGoal: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1">Carbs (g)</label>
                  <input type="number" className="input-field px-2" value={goalsForm.dailyCarbGoal} onChange={e => setGoalsForm({ ...goalsForm, dailyCarbGoal: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1">Fat (g)</label>
                  <input type="number" className="input-field px-2" value={goalsForm.dailyFatGoal} onChange={e => setGoalsForm({ ...goalsForm, dailyFatGoal: e.target.value })} required />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowGoalsModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save Goals</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
