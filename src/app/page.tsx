"use client";

import { motion } from "framer-motion";
import { Camera, Users, ShoppingBag } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl" />
      </div>

      {/* Hero Section */}
      <header className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <span className="text-6xl">🧸</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-serif mb-6">
            <span className="text-white">Teddy</span>
            <span className="text-gradient-gold">Snaps</span>
          </h1>

          <p className="text-xl md:text-2xl text-charcoal-300 mb-4 font-light">
            Precious Moments, Perfectly Preserved
          </p>

          <p className="text-charcoal-400 mb-12 max-w-xl mx-auto">
            Transform daycare photography into an elegant, AI-powered experience
            where parents discover and treasure their children&apos;s precious moments.
          </p>

          {/* Login Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="primary"
              className="group"
              onClick={() => (window.location.href = "/gallery")}
            >
              <Users className="w-5 h-5 mr-2" />
              Parent Access
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => (window.location.href = "/teacher")}
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              Teacher Login
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => (window.location.href = "/admin")}
            >
              <Camera className="w-5 h-5 mr-2" />
              Photographer
            </Button>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-6 h-10 border-2 border-charcoal-600 rounded-full flex justify-center pt-2"
          >
            <div className="w-1.5 h-1.5 bg-gold-500 rounded-full" />
          </motion.div>
        </motion.div>
      </header>

      {/* Features Section */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-serif text-center text-white mb-16"
          >
            Every Moment, Captured{" "}
            <span className="text-gradient-gold">Beautifully</span>
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card variant="glass" className="h-full hover:glow-gold transition-all duration-500">
                  <CardContent>
                    <div className="text-4xl mb-4">{feature.icon}</div>
                    <h3 className="text-xl font-serif text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-charcoal-400">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 py-24 px-4 bg-charcoal-900/50">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-serif text-center text-white mb-16"
          >
            How It <span className="text-gradient-gold">Works</span>
          </motion.h2>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex items-start gap-6"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center text-gold-400 font-serif text-xl">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white mb-1">
                    {step.title}
                  </h3>
                  <p className="text-charcoal-400">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-4 border-t border-charcoal-800">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-charcoal-500">
            Made with 💛 for{" "}
            <span className="text-gold-500">TeddyKids</span> families
          </p>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: "🤖",
    title: "AI Face Recognition",
    description:
      "Photos automatically sorted by child using smart face recognition. No more searching through hundreds of photos.",
  },
  {
    icon: "📸",
    title: "Premium Quality",
    description:
      "Professional prints, digital downloads, and custom photo products delivered right to your door.",
  },
  {
    icon: "💝",
    title: "Easy Selection",
    description:
      "Swipe to love your favorites, build your collection, and checkout in seconds.",
  },
];

const steps = [
  {
    title: "We Capture the Moments",
    description:
      "Professional photographers capture your child's daily adventures, milestones, and friendships.",
  },
  {
    title: "AI Sorts by Child",
    description:
      "Smart face recognition automatically organizes photos into your family's personal gallery.",
  },
  {
    title: "You Browse & Select",
    description:
      "View your child's photos in an elegant gallery. Heart your favorites to add them to your selection.",
  },
  {
    title: "Choose Your Products",
    description:
      "Pick from digital downloads, premium prints, photo books, and more. Mix and match as you like.",
  },
  {
    title: "We Deliver",
    description:
      "Get digital photos instantly via email or WhatsApp. Prints delivered to daycare or your home.",
  },
];
