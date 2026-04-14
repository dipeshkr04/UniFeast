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

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLogForm({ ...logForm, imageFile: file, imageUrl: URL.createObjectURL(file) });
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
          calories: nutrition?.calories || prev.calories,
          protein: nutrition?.protein || prev.protein,
          carbs: nutrition?.carbs || prev.carbs,
          fat: nutrition?.fat || prev.fat,
          fiber: nutrition?.fiber || prev.fiber,
        }));
        
        toast.success(`Detected: ${foodName}`, { icon: '🎯' });
      }
    } catch (err) {
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
        if (key === 'imageFile' && val) formData.append('image', val);
        else if (key !== 'imageFile' && key !== 'imageUrl') formData.append(key, val);
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
      const { data } = await nutritionAPI.updateGoals(goalsForm);
      if (updateUser && data.user) updateUser(data.user);
      toast.success('Goals updated successfully!');
      setShowGoalsModal(false);
      fetchData();
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

  const macroData = [
    { name: 'Protein', value: totals.protein, goal: goals.protein, unit: 'g', color: COLORS[0] },
    { name: 'Carbs', value: totals.carbs, goal: goals.carbs, unit: 'g', color: COLORS[1] },
    { name: 'Fat', value: totals.fat, goal: goals.fat, unit: 'g', color: COLORS[2] },
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 animate-fadeIn pb-24 lg:pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-sm">
            <span className="text-primary-400">Smart</span> Nutrition
          </h1>
          <p className="text-surface-400 mt-1 capitalize text-sm sm:text-base">Track, analyze, and conquer your goals automatically.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button onClick={() => setShowGoalsModal(true)} className="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm bg-surface-800/80 hover:bg-surface-700/80 text-surface-200 border border-surface-700/50 rounded-xl transition-all">
            <HiOutlineCog className="w-4 h-4" /> Goals
          </button>
          <button onClick={() => setShowLogForm(!showLogForm)} className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 shadow-[0_0_15px_rgba(255,71,20,0.3)] hover:shadow-[0_0_25px_rgba(255,71,20,0.5)] transition-shadow">
            <HiPlus className="w-4 h-4" /> Log Meal
          </button>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="glass-card-static rounded-2xl flex items-center justify-between p-3 mb-8 w-full max-w-md mx-auto shadow-lg border border-surface-800/50">
        <button onClick={() => changeDate(-1)} className="p-3 bg-surface-800/50 rounded-xl hover:bg-surface-700 transition-colors text-surface-300 hover:text-white">
          <HiOutlineChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="font-bold text-surface-100 text-[15px]">{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          {date === new Date().toISOString().split('T')[0] && (
             <p className="text-xs font-semibold text-primary-400 uppercase tracking-widest mt-0.5 shadow-primary-400/20">Today</p>
          )}
        </div>
        <button onClick={() => changeDate(1)} className="p-3 bg-surface-800/50 rounded-xl hover:bg-surface-700 transition-colors text-surface-300 hover:text-white">
          <HiOutlineChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* AI Log Form Section */}
      {showLogForm && (
        <div className="glass-card-static p-6 mb-8 animate-slideDown border border-primary-500/20 shadow-[0_0_30px_rgba(255,71,20,0.05)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 shadow-lg">
               <HiOutlineSparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">AI Food Scanner</h3>
              <p className="text-xs text-surface-400">Upload a picture and let AI calculate the macros.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Image Upload Area */}
            <div className="col-span-1 md:col-span-4 flex flex-col gap-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative h-48 sm:h-56 w-full rounded-2xl border-2 border-dashed ${logForm.imageUrl ? 'border-primary-500/50' : 'border-surface-600 hover:border-primary-500/50'} flex items-center justify-center cursor-pointer overflow-hidden transition-colors bg-surface-900/50 group`}
              >
                {logForm.imageUrl ? (
                  <>
                    <img src={logForm.imageUrl} alt="Food preview" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
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
                   <p className="text-xs font-semibold text-primary-400">Clarifai AI scanning image...</p>
                </div>
              )}
            </div>

            {/* Manual Edit Area */}
            <div className="col-span-1 md:col-span-8 flex flex-col justify-end">
              <form onSubmit={handleLogMeal} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="glass-card-static p-4 bg-surface-900/50 border border-surface-800">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-surface-400 mb-1 uppercase text-center">Qty</label>
                      <input type="number" value={logForm.quantity} onChange={e => setLogForm({ ...logForm, quantity: e.target.value })} 
                        className="input-field w-full text-center px-1 font-bold" placeholder="1" min="1" required />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-surface-400 mb-1 uppercase text-center">Kcal</label>
                      <input type="number" value={logForm.calories} onChange={e => setLogForm({ ...logForm, calories: e.target.value })} 
                        className={`input-field w-full text-center px-1 ${aiResult ? 'border-primary-500/50 text-white font-bold' : ''}`} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-surface-400 mb-1 uppercase text-center">Prot</label>
                      <input type="number" value={logForm.protein} onChange={e => setLogForm({ ...logForm, protein: e.target.value })} 
                        className={`input-field w-full text-center px-1 ${aiResult ? 'border-primary-500/50' : ''}`} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-surface-400 mb-1 uppercase text-center">Carb</label>
                      <input type="number" value={logForm.carbs} onChange={e => setLogForm({ ...logForm, carbs: e.target.value })} 
                        className={`input-field w-full text-center px-1 ${aiResult ? 'border-primary-500/50' : ''}`} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-surface-400 mb-1 uppercase text-center">Fat</label>
                      <input type="number" value={logForm.fat} onChange={e => setLogForm({ ...logForm, fat: e.target.value })} 
                        className={`input-field w-full text-center px-1 ${aiResult ? 'border-primary-500/50' : ''}`} placeholder="0" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowLogForm(false)} className="btn-secondary w-full sm:w-auto px-6 py-2.5">Cancel</button>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Calorie Ring summary */}
        <div className="glass-card-static p-6 flex flex-col items-center justify-center relative overflow-hidden group">
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
              <p className="text-[11px] font-bold text-surface-500 uppercase tracking-widest mt-0.5">/ {goals.calories} kcal</p>
            </div>
          </div>
          
          <div className="relative z-10 flex gap-6 text-sm">
            <div className="text-center">
               <p className="font-bold text-surface-100">{totals.calories}</p>
               <p className="text-[10px] text-surface-500 uppercase">Eaten</p>
            </div>
            <div className="w-px bg-surface-700/50" />
            <div className="text-center">
               <p className="font-bold text-surface-100">{Math.max(0, goals.calories - totals.calories)}</p>
               <p className="text-[10px] text-surface-500 uppercase">Left</p>
            </div>
          </div>
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
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, color: '#f1f5f9' }} />
                <Line type="monotone" dataKey="calories" stroke="#e06449" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#e06449', stroke: '#fff', strokeWidth: 2 }} />
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
