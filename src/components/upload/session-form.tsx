"use client";

import { useState } from "react";
import { Calendar, MapPin } from "lucide-react";
import { Input, Button, Card, CardContent } from "@/components/ui";
import { useUploadStore } from "@/stores";

interface SessionFormProps {
  onSubmit: (data: { name: string; date: string; locationId: string }) => void;
  locations: Array<{ id: string; name: string }>;
}

export function SessionForm({ onSubmit, locations }: SessionFormProps) {
  const { sessionName, setSessionName, locationId, setLocationId } = useUploadStore();
  const [shootDate, setShootDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionName && shootDate && locationId) {
      onSubmit({ name: sessionName, date: shootDate, locationId });
    }
  };

  return (
    <Card variant="glass">
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Session Name */}
            <div>
              <label className="block text-sm font-medium text-charcoal-300 mb-1.5">
                Session Name
              </label>
              <Input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g., December Portraits"
                required
              />
            </div>

            {/* Shoot Date */}
            <div>
              <label className="block text-sm font-medium text-charcoal-300 mb-1.5">
                <Calendar className="w-4 h-4 inline mr-1" />
                Shoot Date
              </label>
              <Input
                type="date"
                value={shootDate}
                onChange={(e) => setShootDate(e.target.value)}
                required
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-charcoal-300 mb-1.5">
                <MapPin className="w-4 h-4 inline mr-1" />
                Location
              </label>
              <select
                value={locationId || ""}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-4 py-2.5 bg-charcoal-900 border border-charcoal-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500"
                required
              >
                <option value="">Select location...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
