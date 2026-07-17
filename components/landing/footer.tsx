'use client'

import Link from 'next/link'
import { Mail, Code, Briefcase, Send } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-secondary/50 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Nastech</h3>
            <p className="text-foreground/70 text-sm">
              AI-Powered Business Discovery & Contact Intelligence Platform
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <Link href="#platform" className="text-foreground/70 hover:text-foreground text-sm transition-colors">
                  Platform
                </Link>
              </li>
              <li>
                <Link href="#features" className="text-foreground/70 hover:text-foreground text-sm transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="text-foreground/70 hover:text-foreground text-sm transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-foreground/70 hover:text-foreground text-sm transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="/privacy" className="text-foreground/70 hover:text-foreground text-sm transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="text-foreground/70 hover:text-foreground text-sm transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/contact" className="text-foreground/70 hover:text-foreground text-sm transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="/security" className="text-foreground/70 hover:text-foreground text-sm transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Follow</h4>
            <div className="flex gap-4">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/70 hover:text-foreground transition-colors"
                aria-label="Twitter"
              >
                <Send className="w-5 h-5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/70 hover:text-foreground transition-colors"
                aria-label="LinkedIn"
              >
                <Briefcase className="w-5 h-5" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/70 hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <Code className="w-5 h-5" />
              </a>
              <a
                href="mailto:contact@nastech.io"
                className="text-foreground/70 hover:text-foreground transition-colors"
                aria-label="Email"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between">
          <p className="text-foreground/60 text-sm">
            &copy; {currentYear} Nastech Discovery Intelligence. All rights reserved.
          </p>
          <p className="text-foreground/60 text-sm mt-4 md:mt-0">
            Built with precision for discovery.
          </p>
        </div>
      </div>
    </footer>
  )
}
