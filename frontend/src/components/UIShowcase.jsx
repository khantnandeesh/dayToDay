import React from 'react';

/**
 * UI Component Showcase
 * Demonstrates all components from the DayToDay Design System (Light Theme)
 * This file serves as a visual reference and testing ground
 */

const UIShowcase = () => {
    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto space-y-12">

                {/* Header */}
                <div className="text-center space-y-4 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/10 mb-4">
                        <span className="text-white text-4xl font-bold">D</span>
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900">DayToDay Design System</h1>
                    <p className="text-slate-500 text-lg max-w-2xl mx-auto">
                        Clean, professional light theme using Slate color palette and Tailwind CSS.
                    </p>
                </div>

                {/* Color Palette */}
                <section className="space-y-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-slate-900 pb-2 border-b border-slate-200">Color Palette</h2>

                    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-4">Slate Scale (Primary)</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="space-y-2">
                                <div className="h-16 rounded-lg bg-slate-50 border border-slate-200"></div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Slate 50</p>
                                    <p className="text-xs text-slate-500">Backgrounds</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-16 rounded-lg bg-slate-100"></div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Slate 100</p>
                                    <p className="text-xs text-slate-500">Hover states</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-16 rounded-lg bg-slate-200"></div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Slate 200</p>
                                    <p className="text-xs text-slate-500">Borders</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-16 rounded-lg bg-slate-500"></div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Slate 500</p>
                                    <p className="text-xs text-slate-500">Muted text</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-16 rounded-lg bg-slate-900"></div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Slate 900</p>
                                    <p className="text-xs text-slate-500">Primary text / bg</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-4">Status Colors</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <div className="h-12 rounded-lg bg-green-500"></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-green-100 border border-green-200"></div>
                                    <p className="text-sm text-slate-700">Success</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-12 rounded-lg bg-red-500"></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-red-100 border border-red-200"></div>
                                    <p className="text-sm text-slate-700">Error</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-12 rounded-lg bg-blue-500"></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-blue-100 border border-blue-200"></div>
                                    <p className="text-sm text-slate-700">Info</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-12 rounded-lg bg-amber-500"></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-200"></div>
                                    <p className="text-sm text-slate-700">Warning</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Typography */}
                <section className="space-y-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-slate-900 pb-2 border-b border-slate-200">Typography</h2>

                    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-bold text-slate-900">Heading 1 - Bold 4xl</h1>
                            <h2 className="text-3xl font-bold text-slate-900">Heading 2 - Bold 3xl</h2>
                            <h3 className="text-2xl font-bold text-slate-900">Heading 3 - Bold 2xl</h3>
                            <h4 className="text-xl font-semibold text-slate-900">Heading 4 - Semibold xl</h4>
                        </div>
                        <div className="space-y-2 max-w-2xl">
                            <p className="text-slate-900">
                                <span className="font-semibold">Body Text (Slate 900):</span> Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                            </p>
                            <p className="text-slate-600">
                                <span className="font-semibold text-slate-900">Secondary Text (Slate 600):</span> Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                            </p>
                            <p className="text-slate-400 text-sm">
                                <span className="font-semibold text-slate-900">Muted/Small Text (Slate 400):</span> Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Components */}
                <section className="space-y-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-slate-900 pb-2 border-b border-slate-200">Components</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Buttons */}
                        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
                            <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Buttons</h3>
                            <div className="flex flex-wrap gap-4">
                                <button className="btn btn-primary">Primary Action</button>
                                <button className="btn btn-secondary">Secondary</button>
                                <button className="btn btn-danger">Danger Action</button>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <button className="btn btn-primary opacity-50 cursor-not-allowed">Disabled</button>
                                <button className="btn btn-secondary opacity-50 cursor-not-allowed">Disabled</button>
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
                            <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Form Elements</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Text Input</label>
                                    <input type="text" className="input" placeholder="Enter details..." />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-slate-700">Input with Error</label>
                                    <input type="text" className="input border-red-300 focus:ring-red-200 focus:border-red-400" placeholder="Invalid input..." />
                                    <p className="text-xs text-red-600">This field is required</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="card p-6">
                            <h3 className="font-bold text-slate-900 mb-2">Basic Card</h3>
                            <p className="text-slate-500 text-sm">Standard white card with subtle shadow and border. Used for most content containers.</p>
                        </div>
                        <div className="card p-6 shadow-lg">
                            <h3 className="font-bold text-slate-900 mb-2">Elevated Card</h3>
                            <p className="text-slate-500 text-sm">Card with stronger shadow for emphasis or floating elements.</p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed">
                            <h3 className="font-semibold text-slate-700 mb-2">Dashed / Ghost</h3>
                            <p className="text-slate-500 text-sm">Used for empty states or secondary grouping areas.</p>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <div className="text-center pt-12 pb-8 border-t border-slate-200">
                    <p className="text-slate-400 text-sm">
                        DayToDay Design System • Version 2.0 (Light Theme)
                    </p>
                </div>

            </div>
        </div>
    );
};

export default UIShowcase;
