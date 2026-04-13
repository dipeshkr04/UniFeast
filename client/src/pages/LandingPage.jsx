import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MdRestaurantMenu, MdOutlineFlashOn, MdOutlineGroups, MdOutlineSpeed } from 'react-icons/md';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative selection:bg-primary-500/30">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ x: [0, 50, -50, 0], y: [0, -50, 50, 0], scale: [1, 1.2, 0.8, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary-600/15 blur-[120px]"
        />
        <motion.div 
          animate={{ x: [0, -40, 40, 0], y: [0, 40, -40, 0], scale: [1, 1.2, 0.8, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-accent-500/10 blur-[150px]"
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 glass-card-static border-x-0 border-t-0 rounded-none bg-[#09090b]/80">
        <div className="w-full max-w-[1200px] mx-auto px-8 md:px-12 h-24 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 group-hover:scale-105 transition-all">
              <MdRestaurantMenu className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-surface-300">
              Uni<span className="text-primary-500">Feast</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-semibold text-surface-300 hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="btn-primary py-2 px-5 text-sm rounded-lg hidden sm:block">Get Started</Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 w-full max-w-[1200px] mx-auto px-8 md:px-12 pt-20 pb-32">
        {/* Hero Section */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-8 min-h-[70vh]">
          <div className="flex-1 w-full text-center lg:text-left pt-10 lg:pt-0 max-w-2xl mx-auto lg:mx-0">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block py-1 pe-4 ps-1 mb-6 rounded-full bg-surface-900 border border-white/10 text-xs font-bold uppercase tracking-widest text-primary-400">
                <span className="bg-primary-500 text-white px-2 py-1 rounded-full mr-2">New</span> IIIT Nagpur's Digital Canteen
              </span>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight tracking-tight mb-8">
                Hyper-connected <br className="hidden lg:block"/>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-accent-400 drop-shadow-[0_0_30px_rgba(255,71,20,0.3)]">Dining Experience.</span>
              </h1>
              <p className="text-lg sm:text-xl text-surface-400 font-medium leading-relaxed max-w-2xl mx-auto lg:mx-0 mb-10">
                Skip the lines. Pool your orders. Track exactly when your food will be ready using our advanced Erlang-C powered queue engine.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link to="/register" className="btn-primary w-full sm:w-auto py-4 px-8 text-lg flex items-center justify-center gap-2 group">
                  Start Ordering Now
                  <MdOutlineFlashOn className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </Link>
                <Link to="/login" className="btn-secondary w-full sm:w-auto py-4 px-8 text-lg bg-surface-900 border-surface-700 hover:bg-surface-800">
                  Access Dashboard
                </Link>
              </div>
            </motion.div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex-1 w-full max-w-lg lg:max-w-none relative"
          >
            {/* Abstract Decorative Graphic representing the app */}
            <div className="relative aspect-square w-full">
              <div className="absolute inset-0 rounded-full border border-white/5 bg-gradient-to-br from-surface-900/40 to-transparent m-8 animate-[spin_60s_linear_infinite]" />
              <div className="absolute inset-0 rounded-full border border-primary-500/10 bg-gradient-to-tr from-transparent to-primary-900/10 m-16 animate-[spin_40s_reverse_linear_infinite]" />
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glass-card border-white/10 shadow-[0_0_50px_rgba(255,71,20,0.15)] p-6 z-20 w-3/4 max-w-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/30 text-2xl">🍔</div>
                  <div>
                    <h3 className="font-black text-lg leading-tight">Spicy Paneer Wrap</h3>
                    <p className="text-primary-400 font-bold text-sm tracking-wide">Ready in 4m</p>
                  </div>
                </div>
                <div className="w-full bg-surface-800 rounded-full h-2 mb-2 overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: "0%" }} 
                    animate={{ width: "75%" }} 
                    transition={{ duration: 2, delay: 1 }}
                    className="bg-primary-500 h-full rounded-full shadow-[0_0_10px_#ff4714]"
                  />
                </div>
                <div className="flex justify-between text-[10px] uppercase font-bold text-surface-500 tracking-wider">
                  <span>Ordered</span>
                  <span className="text-primary-400">Preparing</span>
                </div>
              </div>

              {/* Floating pool badge */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/4 right-10 glass-card p-4 border border-info/20 shadow-lg shadow-blue-500/10 z-30"
              >
                <div className="flex items-center gap-2 text-blue-400 font-black text-sm uppercase tracking-wider mb-1">
                  <MdOutlineGroups className="w-5 h-5" /> Active Pool
                </div>
                <p className="text-white text-xs font-semibold">4/5 Joined • Save 20%</p>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-24">
          {[
            { 
              icon: <MdOutlineSpeed className="w-6 h-6" />, 
              title: "Smart Queuing", 
              desc: "Mathematical Erlang-C logic analyzes kitchen load to give you to-the-minute ETA predictions."
            },
            { 
              icon: <MdOutlineGroups className="w-6 h-6" />, 
              title: "Social Order Pools", 
              desc: "Join active pools to batch your orders with others and unlock significant dynamic discounts."
            },
            { 
              icon: <MdOutlineFlashOn className="w-6 h-6" />, 
              title: "Live Tracking", 
              desc: "Watch your order flow directly from the kitchen grill to the pickup counter in real-time."
            }
          ].map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card bg-[#09090b]/80 border-white/5 hover:border-primary-500/30 p-8 group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-400 mb-6 group-hover:scale-110 group-hover:bg-primary-500/10 transition-all">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{f.title}</h3>
              <p className="text-surface-400 leading-relaxed font-medium text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
