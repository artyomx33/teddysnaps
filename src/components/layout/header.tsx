"use client";

import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="h-16 border-b border-charcoal-800 bg-charcoal-900/50 backdrop-blur-xl flex items-center justify-between px-6">
      <div>
        <h1 className="text-xl font-serif text-white">{title}</h1>
        {subtitle && (
          <p className="text-sm text-charcoal-400">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-500" />
          <Input
            placeholder="Search families..."
            className="pl-10 py-2 text-sm bg-charcoal-800 border-charcoal-700"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-charcoal-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-gold-500 rounded-full" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-charcoal-950 font-medium text-sm">
          A
        </div>
      </div>
    </header>
  );
}
