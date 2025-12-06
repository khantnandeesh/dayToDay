import { useState, useEffect, useRef } from 'react';
import { Lock, Key as KeyIcon, Server, Shield, User, Database, ArrowRight, Smartphone, Fingerprint, FileText, Cloud } from 'lucide-react';
import Navbar from '../components/Navbar';

const SecurityExplained = () => {
    const [activeStep, setActiveStep] = useState(0);
    const stepRefs = useRef([]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = parseInt(entry.target.dataset.step);
                        setActiveStep(index);
                    }
                });
            },
            {
                root: null,
                threshold: 0.6,
                rootMargin: "-10% 0px -10% 0px"
            }
        );

        stepRefs.current.forEach((el) => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, []);

    const steps = [
        {
            title: "1. The Secret Input",
            desc: "It starts on your device. You type your Master Password. This is the only time it exists in plain text, and it stays strictly within your browser's memory.",
            icon: Smartphone,
            color: "bg-blue-500",
        },
        {
            title: "2. Key Derivation (PBKDF2)",
            desc: "We don't just use your password. We mix it with a unique 'Salt' and run it through 600,000 rounds of hashing. This creates a cryptographically strong 'Key'.",
            icon: Fingerprint,
            color: "bg-amber-500",
        },
        {
            title: "3. The Encryption Event",
            desc: "Your Vault Data meets the Key. AES-256-GCM encryption locks the data. The Key is then immediately destroyed from memory when you lock the vault.",
            icon: Lock,
            color: "bg-emerald-500",
        },
        {
            title: "4. The Server (Zero-Knowledge)",
            desc: "Our server only receives the encrypted 'Blob'. Without the Key (which we never have), this data is computationally impossible to crack. It's just noise to us.",
            icon: Cloud,
            color: "bg-purple-500",
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <Navbar />

            <div className="pt-24 pb-12 text-center px-4 md:px-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold uppercase tracking-wider mb-6 shadow-xl shadow-slate-900/10">
                    <Shield className="w-4 h-4" />
                    Security Architecture
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
                    How We Protect Your Data
                </h1>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    A transparency report on our Zero-Knowledge encryption.
                </p>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 relative pb-24">
                <div className="flex flex-col md:flex-row gap-8 lg:gap-24">

                    {/* SCROLLABLE STEPS */}
                    <div className="w-full md:w-1/2 py-10 space-y-[70vh] pb-[30vh]">
                        {steps.map((step, idx) => (
                            <div
                                key={idx}
                                data-step={idx}
                                ref={el => stepRefs.current[idx] = el}
                                className={`transition-all duration-700 p-8 rounded-3xl border ${activeStep === idx ? 'bg-white shadow-xl border-slate-200 opacity-100 translate-x-0 scale-100' : 'bg-transparent border-transparent opacity-30 -translate-x-4 scale-95 grayscale'}`}
                            >
                                <div className={`w-12 h-12 rounded-2xl ${step.color} text-white flex items-center justify-center mb-6 shadow-lg`}>
                                    <step.icon className="w-6 h-6" />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900 mb-4">{step.title}</h2>
                                <p className="text-lg text-slate-600 leading-relaxed font-medium">{step.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* STICKY VISUALIZATION */}
                    <div className="hidden md:block w-1/2 sticky top-24 h-[650px]">
                        <div className="bg-[#0B1120] rounded-[2.5rem] w-full h-full relative overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
                            {/* Ambient Effects */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.15),transparent_60%)]"></div>
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>

                            {/* --- VISUALIZATION STAGE --- */}
                            <div className="relative z-10 flex-1 flex flex-col p-8">

                                {/* ZONE 1: LOCAL SAFE ZONE (TOP) */}
                                <div className="flex-1 relative border-b border-slate-800/60 p-4 pt-10 flex flex-col items-center">
                                    <div className="absolute top-6 left-6 text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse"></div>
                                        Local Device (Private)
                                    </div>

                                    {/* DEVICE GRAPHIC */}
                                    <div className="relative mt-8">
                                        {/* Glow behind device */}
                                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-32 bg-blue-500/20 blur-3xl rounded-full transition-opacity duration-700 ${activeStep <= 2 ? 'opacity-100' : 'opacity-0'}`}></div>

                                        <div className="w-72 h-40 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-700 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden">

                                            {/* Step 0: Input */}
                                            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 transition-all duration-500 ${activeStep === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                                                <div className="w-56 h-12 bg-slate-950 rounded-lg border border-slate-800 flex items-center px-4 relative">
                                                    <span className="text-white font-mono tracking-[0.3em] text-xl z-10 relative">••••••••</span>
                                                    <div className="absolute right-4 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Master Password Input</span>
                                            </div>

                                            {/* Step 1: Hashing */}
                                            <div className={`absolute inset-0 flex items-center justify-center gap-4 transition-all duration-500 delay-100 ${activeStep === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                                                <div className="flex flex-col items-center">
                                                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white mb-2">P</div>
                                                    <span className="text-[9px] text-slate-500">Pass</span>
                                                </div>
                                                <span className="text-slate-600">+</span>
                                                <div className="flex flex-col items-center">
                                                    <div className="w-10 h-10 rounded-lg bg-amber-900/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-500 mb-2">S</div>
                                                    <span className="text-[9px] text-slate-500">Salt</span>
                                                </div>
                                                <div className="h-px w-6 bg-slate-700"></div>
                                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.5)] z-10">
                                                    <KeyIcon className="w-6 h-6 text-white" />
                                                </div>
                                            </div>

                                            {/* Step 2: Encryption */}
                                            <div className={`absolute inset-0 flex items-center justify-center gap-3 transition-all duration-500 ${activeStep === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                                                <div className="relative">
                                                    <FileText className="w-12 h-12 text-slate-600" />
                                                    <div className="absolute -bottom-1 -right-1 bg-slate-950 rounded-full p-1 border border-slate-700">
                                                        <Lock className="w-4 h-4 text-emerald-500" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="h-px w-10 bg-gradient-to-r from-slate-700 to-emerald-500/50"></div>
                                                    <span className="text-[9px] text-emerald-500 font-bold tracking-widest">AES-256</span>
                                                    <div className="h-px w-10 bg-gradient-to-r from-slate-700 to-emerald-500/50"></div>
                                                </div>
                                                <div className="w-14 h-10 bg-slate-950 border border-emerald-500/30 rounded-lg flex items-center justify-center">
                                                    <div className="text-[8px] text-emerald-400 font-mono grid grid-cols-4 gap-0.5 opacity-80">
                                                        {[...Array(12)].map((_, i) => (
                                                            <div key={i} className="w-1 h-1 rounded-full bg-emerald-500/50"></div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Step 3: Cleared */}
                                            <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${activeStep === 3 ? 'opacity-100' : 'opacity-0'}`}>
                                                <div className="text-slate-500 text-sm font-medium mb-1">(Memory Wiped)</div>
                                                <div className="text-[10px] text-slate-600">No Key Exists Here Anymore</div>
                                            </div>

                                        </div>
                                    </div>
                                </div>

                                {/* ZONE 2: TRANSIT (MIDDLE) */}
                                <div className="h-24 relative flex items-center justify-center z-20">
                                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-800/60 dashed-border"></div>

                                    {/* Network Label */}
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-mono border border-slate-800 bg-[#0B1120] px-2 py-1 rounded">
                                        TLS 1.3 TUNNEL
                                    </div>

                                    {/* PACKET */}
                                    <div
                                        className="absolute w-40 p-2 rounded-xl border flex items-center gap-3 bg-[#0f172a] shadow-2xl transition-all ease-in-out z-30"
                                        style={{
                                            top: activeStep < 3 ? '10%' : '150%', // Moves way down into server
                                            opacity: activeStep >= 2 ? 1 : 0,
                                            borderColor: activeStep >= 2 ? 'rgba(16, 185, 129, 0.4)' : 'transparent',
                                            boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)',
                                            transitionDuration: '1200ms',
                                            transform: activeStep === 3 ? 'scale(0.8)' : 'scale(1)'
                                        }}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                            <Lock className="w-4 h-4 text-emerald-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-emerald-400 font-bold tracking-wider">ENCRYPTED BLOB</span>
                                            <span className="text-[9px] text-slate-500 font-mono">0x7F...A1</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ZONE 3: SERVER ZONE (BOTTOM) */}
                                <div className="flex-1 relative border-t border-slate-800/60 p-4 pt-8 flex flex-col items-center justify-end">
                                    {/* Moved Label to TOP of Zone for clarity */}
                                    <div className="absolute top-6 left-6 text-[10px] font-bold tracking-[0.2em] text-purple-400 uppercase flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                        Cloud Server (Hostile)
                                    </div>

                                    {/* SERVER RACK */}
                                    <div className={`relative w-64 h-32 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-700 ${activeStep === 3 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-40'}`}>

                                        {/* Status Lights */}
                                        <div className="absolute top-3 right-3 flex gap-1.5">
                                            <div className="w-1 h-1 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
                                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                                        </div>

                                        {/* Rack Lines */}
                                        <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between py-4 px-4 opacity-20 pointer-events-none">
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className="h-px bg-slate-500 w-full"></div>
                                            ))}
                                        </div>

                                        {/* Database Icon */}
                                        <Database className={`w-32 h-32 text-slate-800 absolute -right-8 -bottom-8 transition-opacity duration-500 ${activeStep === 3 ? 'opacity-100' : 'opacity-0'}`} />

                                        {/* Received Data */}
                                        <div className={`relative z-10 w-48 p-3 bg-purple-900/30 backdrop-blur-md border border-purple-500/30 rounded-lg flex items-center justify-between transition-all duration-500 delay-500 ${activeStep === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center">
                                                    <Database className="w-4 h-4 text-purple-400" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-purple-200 font-bold">Stored Safely</span>
                                                    <span className="text-[8px] text-purple-400/60 font-mono">No Key Available</span>
                                                </div>
                                            </div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                        </div>

                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecurityExplained;
