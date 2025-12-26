"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Upload,
  ShoppingCart,
  Users,
  Settings,
  Camera,
  LogOut,
  Scan,
  Brush,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  role: "admin" | "photographer" | "teacher";
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const adminLinks = [
    { href: "/admin", icon: Home, label: "Dashboard" },
    { href: "/admin/upload", icon: Upload, label: "Upload" },
    { href: "/admin/orders", icon: ShoppingCart, label: "Orders" },
    { href: "/admin/retouch", icon: Brush, label: "Retouch Queue" },
    { href: "/admin/families", icon: Users, label: "Families" },
    { href: "/admin/faces", icon: Scan, label: "Faces" },
    { href: "/admin/settings", icon: Settings, label: "Settings" },
  ];

  const teacherLinks = [
    { href: "/teacher", icon: Home, label: "Dashboard" },
    { href: "/teacher/families", icon: Users, label: "Families" },
  ];

  const links = role === "teacher" ? teacherLinks : adminLinks;

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-charcoal-900 border-r border-charcoal-800 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-charcoal-800">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/teddysnaps-logo.png"
            alt="TeddySnaps"
            width={48}
            height={48}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-lg font-serif">
              <span className="text-white">Teddy</span>
              <span className="text-gold-500">Snaps</span>
            </h1>
            <p className="text-xs text-charcoal-500 capitalize">{role}</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-gold-500/10 text-gold-400 border border-gold-500/20"
                      : "text-charcoal-400 hover:text-white hover:bg-charcoal-800"
                  )}
                >
                  <link.icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-charcoal-800">
        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-charcoal-400 hover:text-white hover:bg-charcoal-800 transition-all duration-200">
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
