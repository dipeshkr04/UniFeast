import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MdRestaurantMenu, MdOutlineFlashOn, MdOutlineGroups, MdOutlineSpeed, MdChevronRight } from 'react-icons/md';

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full bg-[#050505] text-white overflow-hidden relative selection:bg-primary-500/30 font-sans flex flex-col items-center">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex justify-center items-center">
        <motion.div 
          animate={{ x: [0, 30, -30, 0], y: [0, -30, 30, 0], scale: [1, 1.1, 0.9, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] w-[150vw] sm:w-[100vw] lg:w-[800px] aspect-square rounded-full bg-primary-600/15 blur-[80px] sm:blur-[120px]"
        />
        <motion.div 
          animate={{ x: [0, -20, 20, 0], y: [0, 20, -20, 0], scale: [1, 1.1, 0.9, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] w-[150vw] sm:w-[100vw] lg:w-[900px] aspect-square rounded-full bg-accent-500/10 blur-[100px] sm:blur-[150px]"
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 w-full glass-card-static border-x-0 border-t-0 rounded-none bg-[#09090b]/80 backdrop-blur-md">
        <div className="w-full mx-auto px-6 sm:px-8 lg:px-12 h-20 sm:h-24 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 group cursor-pointer">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl gradient-primary flex items-center justify-center shadow-[0_0_15px_rgba(255,71,20,0.4)] group-hover:shadow-[0_0_25px_rgba(255,71,20,0.6)] group-hover:scale-105 transition-all duration-300 shrink-0">
              <MdRestaurantMenu className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-surface-300">
              Uni<span className="text-primary-500">Feast</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/login" className="text-sm font-semibold text-surface-300 hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="btn-primary py-2 px-4 sm:py-2.5 sm:px-6 text-sm font-bold rounded-full hover:shadow-[0_0_20px_rgba(255,71,20,0.4)] transition-all">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12 pt-12 sm:pt-20 lg:pt-24 pb-24 sm:pb-32 flex flex-col items-center gap-16 sm:gap-24 lg:gap-32">
        
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center text-center w-full max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center text-center w-full gap-6 sm:gap-8 lg:gap-10"
          >
            <div className="inline-flex items-center justify-center gap-2 py-1.5 pe-5 ps-2 rounded-full bg-surface-900/60 border border-white/10 text-xs font-bold uppercase tracking-widest text-primary-400 backdrop-blur-sm shadow-xl mx-auto mt-4 sm:mt-0">
              <span className="bg-gradient-to-r from-primary-600 to-primary-500 text-white px-2.5 py-1 rounded-full shadow-lg shadow-primary-500/30">New</span> 
              IIIT Nagpur's Digital Canteen
            </div>
            
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1.1] tracking-tight w-full text-center mx-auto">
              Hyper-connected <br className="hidden sm:block"/>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 via-primary-500 to-accent-400 drop-shadow-[0_0_40px_rgba(255,71,20,0.2)]">Dining Experience</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-surface-400 font-medium leading-relaxed max-w-2xl w-full text-center mx-auto">
              Skip the lines. Pool your orders. Track exactly when your food will be ready using our advanced Erlang-C powered queue engine.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mx-auto">
              <Link to="/register" className="w-full sm:w-auto py-4 px-8 text-lg font-bold rounded-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(255,71,20,0.3)] hover:shadow-[0_0_30px_rgba(255,71,20,0.5)] transition-all transform hover:-translate-y-1 shrink-0 mx-auto sm:mx-0">
                Start Ordering Now
                <MdOutlineFlashOn className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </Link>
              <Link to="/login" className="w-full sm:w-auto py-4 px-8 text-lg font-bold rounded-full bg-surface-800/80 hover:bg-surface-700/80 border border-white/10 hover:border-white/20 text-white backdrop-blur-sm transition-all flex items-center justify-center gap-2 group shrink-0">
                Access Dashboard
                <MdChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform text-surface-400 group-hover:text-white" />
              </Link>
            </div>
          </motion.div>
        </section>
        
        {/* Abstract Graphic Section */}
        <section className="w-full max-w-4xl relative flex flex-col items-center justify-center mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="w-full flex justify-center mx-auto"
          >
            <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9] flex flex-col items-center justify-center overflow-visible">
              
              {/* Decorative backgrounds */}
              <div className="absolute inset-0 sm:inset-4 lg:inset-8 rounded-[2rem] sm:rounded-[3rem] border border-white/5 bg-gradient-to-b from-surface-900/40 to-transparent" />
              <div className="absolute inset-4 sm:inset-8 lg:inset-16 rounded-[2rem] sm:rounded-[3rem] border border-primary-500/10 bg-gradient-to-t from-transparent to-primary-900/10" />
              
              {/* Floating pool badge */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-0 right-0 sm:-top-4 sm:right-6 lg:-top-6 lg:right-10 glass-card p-3 sm:p-4 border border-info/20 shadow-[0_10px_30px_rgba(59,130,246,0.15)] z-30 rounded-xl sm:rounded-2xl backdrop-blur-xl bg-[#09090b]/90 flex flex-col gap-1 sm:gap-1.5"
              >
                <div className="flex items-center gap-2 text-blue-400 font-black text-xs sm:text-sm uppercase tracking-wider">
                  <MdOutlineGroups className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> 
                  <span>Active Pool</span>
                </div>
                <p className="text-white text-xs sm:text-sm font-bold opacity-90 whitespace-nowrap">
                  4/5 Joined <span className="mx-1">•</span> <span className="text-green-400">Save 20%</span>
                </p>
              </motion.div>

              {/* Main Card */}
              <div className="relative glass-card border-white/10 shadow-[0_20px_60px_rgba(255,71,20,0.15)] p-5 sm:p-8 z-20 w-[90%] sm:w-[S5%] lg:w-[60%] max-w-md rounded-2xl sm:rounded-3xl hover:scale-105 transition-transform duration-500 flex flex-col gap-5 sm:gap-8 bg-[#0a0a0c]/80 backdrop-blur-2xl mt-8 sm:mt-0">
                
                {/* Icon & Text flex container */}
                <div className="flex items-center gap-4 sm:gap-5 w-full">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl gradient-primary flex items-center justify-center shadow-[0_0_20px_rgba(255,71,20,0.4)] text-2xl sm:text-3xl shrink-0">🍔</div>
                  <div className="flex flex-col flex-1 text-left justify-center overflow-hidden">
                    <h3 className="font-black text-lg sm:text-2xl leading-tight mb-1 truncate">Spicy Paneer Wrap</h3>
                    <p className="text-primary-400 font-bold text-xs sm:text-base tracking-wide flex items-center gap-1.5">
                      <MdOutlineSpeed className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> 
                      <span>Ready in 4m</span>
                    </p>
                  </div>
                </div>

                {/* Progress bar container */}
                <div className="w-full flex flex-col gap-2.5 sm:gap-3">
                  <div className="w-full bg-surface-800/80 rounded-full h-2.5 sm:h-4 overflow-hidden border border-white/10">
                    <motion.div 
                      initial={{ width: "0%" }} 
                      animate={{ width: "75%" }} 
                      transition={{ duration: 2, delay: 1, ease: "easeOut" }}
                      className="bg-gradient-to-r from-primary-600 to-primary-400 h-full rounded-full shadow-[0_0_15px_#ff4714]"
                    />
                  </div>
                  <div className="flex justify-between w-full text-[10px] sm:text-xs uppercase font-black text-surface-500 tracking-widest px-1">
                    <span>Ordered</span>
                    <span className="text-primary-400 drop-shadow-[0_0_5px_rgba(255,71,20,0.5)]">Preparing</span>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Grid */}
        <section className="w-full max-w-7xl mx-auto flex flex-col items-center gap-10 sm:gap-14 lg:gap-16">
          <div className="text-center w-full max-w-2xl mx-auto flex flex-col gap-3 sm:gap-4 px-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black">Why UniFeast?</h2>
            <p className="text-surface-400 font-medium text-sm sm:text-base lg:text-lg">Everything you need for a faster, smarter dining experience on campus.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 w-full">
            {[
              { 
                icon: <MdOutlineSpeed className="w-7 h-7 sm:w-8 sm:h-8" />, 
                title: "Smart Queuing", 
                desc: "Mathematical Erlang-C logic analyzes kitchen load to give you to-the-minute ETA predictions."
              },
              { 
                icon: <MdOutlineGroups className="w-7 h-7 sm:w-8 sm:h-8" />, 
                title: "Social Order Pools", 
                desc: "Join active pools to batch your orders with others and unlock significant dynamic discounts."
              },
              { 
                icon: <MdOutlineFlashOn className="w-7 h-7 sm:w-8 sm:h-8" />, 
                title: "Live Tracking", 
                desc: "Watch your order flow directly from the kitchen grill to the pickup counter in real-time."
              }
            ].map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="glass-card bg-surface-900/40 backdrop-blur-lg border-white/5 hover:border-primary-500/40 p-6 sm:p-8 lg:p-10 group rounded-2xl sm:rounded-3xl hover:bg-surface-900/60 transition-all duration-300 hover:shadow-[0_10px_40px_rgba(255,71,20,0.1)] flex flex-col items-center text-center gap-5 sm:gap-6"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-surface-800 border border-white/10 flex items-center justify-center text-primary-400 group-hover:scale-110 group-hover:bg-primary-500/20 group-hover:border-primary-500/30 transition-all duration-300 shadow-lg shrink-0">
                  {f.icon}
                </div>
                <div className="flex flex-col gap-2 sm:gap-3">
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-bold">{f.title}</h3>
                  <p className="text-surface-400 leading-relaxed font-medium text-sm sm:text-base">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
