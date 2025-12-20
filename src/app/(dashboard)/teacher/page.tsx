"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Camera, Users, Calendar, ChevronRight } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Input, Badge } from "@/components/ui";

// Demo data - will be replaced with Supabase queries
const recentSessions = [
  { id: "1", name: "December Portraits", date: "Dec 18", photoCount: 147 },
  { id: "2", name: "Winter Activities", date: "Dec 15", photoCount: 203 },
  { id: "3", name: "Art Class", date: "Dec 12", photoCount: 89 },
];

const families = [
  {
    id: "1",
    name: "Van Berg",
    children: ["Emma", "Lucas"],
    photoCount: 54,
    hasNew: true,
  },
  {
    id: "2",
    name: "De Vries",
    children: ["Sophie"],
    photoCount: 31,
    hasNew: true,
  },
  {
    id: "3",
    name: "Jansen",
    children: ["Mila", "Daan", "Sem"],
    photoCount: 78,
    hasNew: false,
  },
  {
    id: "4",
    name: "Bakker",
    children: ["Lieke"],
    photoCount: 23,
    hasNew: false,
  },
  {
    id: "5",
    name: "Visser",
    children: ["Noah", "Julia"],
    photoCount: 45,
    hasNew: true,
  },
];

export default function TeacherDashboard() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFamilies = families.filter(
    (family) =>
      family.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      family.children.some((child) =>
        child.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar role="teacher" />

      <main className="flex-1 ml-64">
        <Header
          title="Teacher Dashboard"
          subtitle="Find and browse family photos"
        />

        <div className="p-6 space-y-8">
          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal-500" />
              <Input
                placeholder="Search by family name or child..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 py-4 text-lg bg-charcoal-900 border-charcoal-700"
              />
            </div>
          </motion.div>

          {/* Recent Sessions */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gold-500" />
              Recent Sessions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentSessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    variant="glass"
                    className="cursor-pointer hover:border-gold-500/30 transition-all"
                  >
                    <CardContent className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{session.name}</p>
                        <p className="text-sm text-charcoal-400">
                          {session.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-charcoal-400">
                        <Camera className="w-4 h-4" />
                        <span>{session.photoCount}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Families List */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-400" />
              Families ({filteredFamilies.length})
            </h2>
            <div className="space-y-2">
              {filteredFamilies.map((family, index) => (
                <motion.div
                  key={family.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    variant="default"
                    className="cursor-pointer hover:bg-charcoal-800 transition-all group p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-serif text-lg">
                          {family.name[0]}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">
                              {family.name}
                            </p>
                            {family.hasNew && (
                              <Badge variant="gold">New photos</Badge>
                            )}
                          </div>
                          <p className="text-sm text-charcoal-400">
                            {family.children.join(", ")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-charcoal-400">
                          <Camera className="w-4 h-4" />
                          <span>{family.photoCount} photos</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-charcoal-600 group-hover:text-gold-500 transition-colors" />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {filteredFamilies.length === 0 && (
              <div className="text-center py-12">
                <p className="text-charcoal-500">
                  No families found matching &quot;{searchQuery}&quot;
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
