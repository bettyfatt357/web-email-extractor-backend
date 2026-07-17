'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: 'How accurate are discovered emails?',
    answer:
      'Our AI-powered discovery engine achieves 99% accuracy in email extraction through advanced validation, pattern matching, and real-time verification. We continuously improve our algorithms based on feedback and industry best practices.',
  },
  {
    question: 'Can I search multiple keywords simultaneously?',
    answer:
      'Yes! You can use multiple keywords, location filters, and email patterns in a single search. Our engine processes complex queries and returns highly relevant results filtered by your specific criteria.',
  },
  {
    question: 'Can I export results?',
    answer:
      'Absolutely. All plans include CSV export functionality. Professional and Enterprise plans also support API access for programmatic data export and integration with your existing tools.',
  },
  {
    question: 'Does the platform verify emails?',
    answer:
      'Yes, our verification system checks email validity, deliverability, and recent activity. We also provide bounce detection and spam trap identification to ensure you only get active, valid contacts.',
  },
  {
    question: 'Can teams collaborate on searches?',
    answer:
      'Professional and Enterprise plans include team collaboration features. You can share searches, saved queries, results, and assign discovery jobs to team members with role-based access control.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, American Express), wire transfers for Enterprise, and monthly invoicing options. All payments are processed securely through Stripe.',
  },
]

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-foreground/70">
            Find answers to common questions about Nastech Discovery Intelligence.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <Card
              key={idx}
              className="p-6 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{faq.question}</h3>
                <ChevronDown
                  className={`w-5 h-5 text-foreground/60 transition-transform ${
                    openIndex === idx ? 'rotate-180' : ''
                  }`}
                />
              </div>
              {openIndex === idx && (
                <p className="text-foreground/70 text-sm mt-4 leading-relaxed">{faq.answer}</p>
              )}
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-foreground/70 mb-4">
            Still have questions?{' '}
            <a href="#contact" className="text-primary hover:underline">
              Contact our support team
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
