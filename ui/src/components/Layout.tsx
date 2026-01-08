import { Link, useLocation } from 'react-router-dom';
import { UploadCloud, Music, FileOutput } from 'lucide-react';
import { cn } from '../lib/utils'; // We need to create this utility or just inline it

const Layout = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Upload', icon: UploadCloud },
        { path: '/results', label: 'Results', icon: Music },
        { path: '/export', label: 'Export', icon: FileOutput },
    ];

    return (
        <div className="flex h-screen bg-background text-white overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-background border-r border-brown-dark flex flex-col">
                <div className="p-6 border-b border-brown-dark">
                    <h1 className="text-xl font-bold text-gold tracking-wide">
                        MP3 META TAGGER
                        <span className="block text-xs text-stone-500 font-normal mt-1">ANALYZER</span>
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                                    isActive
                                        ? "bg-green text-gold border border-green-light/20 shadow-[0_0_15px_rgba(201,162,74,0.1)]"
                                        : "text-stone-400 hover:bg-brown-dark/50 hover:text-white"
                                )}
                            >
                                <Icon size={20} className={cn(isActive ? "text-gold" : "text-stone-500 group-hover:text-stone-300")} />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-brown-dark">
                    <div className="text-xs text-stone-600 text-center">
                        Local First Analysis v1.0
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brown-dark/20 via-background to-background">
                <div className="p-8 max-w-7xl mx-auto h-full">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
