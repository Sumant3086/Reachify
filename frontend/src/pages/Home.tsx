import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';
import PaymentModal from '../components/PaymentModal';
import NotificationToast from '../components/NotificationToast';

function Home() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [darkMode, setDarkMode] = useDarkMode();
  const [isVisible, setIsVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'professional' | 'enterprise' | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  useEffect(() => {
    setIsVisible(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: '🚀',
      title: 'Lightning Fast',
      description: 'Send 10,000 emails faster than you can say "unsubscribe". Our servers don\'t sleep, even if you should.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: '🎯',
      title: 'Smart Scheduling',
      description: 'Schedule emails for 3 AM because apparently that\'s when people check their inbox. (Spoiler: They don\'t.)',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: '📊',
      title: 'Real-time Analytics',
      description: 'Watch your open rates in real-time. It\'s like Netflix, but for disappointment. (JK, our avg open rate is 35%)',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: '🔒',
      title: 'Enterprise Security',
      description: 'Bank-level encryption. Because your "Buy Now!" emails deserve the same security as nuclear codes.',
      color: 'from-red-500 to-orange-500'
    },
    {
      icon: '⚡',
      title: 'Bulk Operations',
      description: 'Cancel 1,000 emails with one click. Perfect for when you realize it\'s a typo in the subject line.',
      color: 'from-yellow-500 to-amber-500'
    },
    {
      icon: '🎨',
      title: 'Personalization',
      description: 'Add {{name}} to make it personal. They\'ll totally believe you wrote it just for them. (They won\'t.)',
      color: 'from-indigo-500 to-purple-500'
    }
  ];

  const stats = [
    { value: '10M+', label: 'Emails Sent', icon: '📧' },
    { value: '99.9%', label: 'Uptime', icon: '⚡' },
    { value: '500+', label: 'Happy Users', icon: '👥' },
    { value: '<100ms', label: 'API Speed', icon: '🚀' }
  ];

  const testimonials = [
    {
      name: 'Priya Sharma',
      role: 'Marketing Director, TechCorp India',
      content: 'Finally, I can schedule emails at 2 AM without actually being awake at 2 AM. Life-changing? No. Convenient? Absolutely.',
      avatar: '👩‍💼'
    },
    {
      name: 'Rahul Verma',
      role: 'CEO, StartupHub',
      content: 'I used to pay $299/month for Mailchimp. Now I pay ₹3,999 and get the same features. My CFO loves me again.',
      avatar: '👨‍💼'
    },
    {
      name: 'Anita Desai',
      role: 'Growth Lead, E-commerce Plus',
      content: 'The analytics told me 90% of people don\'t open my emails. Brutal honesty. But hey, at least now I know.',
      avatar: '👩‍💻'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-colors duration-500">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg z-50 border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 animate-slide-in-left">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg hover:scale-110 transition-transform duration-300">
              R
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Reachify
            </span>
          </div>
          <div className="flex items-center gap-6 animate-slide-in-right">
            <a href="#features" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200">
              Features
            </a>
            <a href="#pricing" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200">
              Pricing
            </a>
            <a href="#testimonials" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200">
              Testimonials
            </a>
            
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-110"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => navigate('/login')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center">
          <div 
            className={`inline-block mb-6 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 text-sm font-medium animate-bounce-slow ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            style={{ transform: `translateY(${scrollY * 0.1}px)` }}
          >
            ✨ Because Manually Sending 10,000 Emails is SO 2005
          </div>
          
          <h1 
            className={`text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            style={{ transform: `translateY(${scrollY * 0.05}px)` }}
          >
            Email Marketing
            <br />
            <span className="text-5xl md:text-6xl">Without the Drama</span>
          </h1>
          
          <p 
            className={`text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            style={{ transform: `translateY(${scrollY * 0.08}px)` }}
          >
            Stop clicking "send" like it's 1999. Schedule 10,000 emails while you sleep, 
            track who actually reads them (spoiler: not many), and pretend you're a marketing genius.
            <br />
            <span className="text-sm mt-2 block opacity-75">
              (But seriously, we handle 1M+ emails/day with 99.9% deliverability. We're good at this.)
            </span>
          </p>

          <div className={`flex items-center justify-center gap-4 mb-16 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <button
              onClick={() => navigate('/login')}
              className="group bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-2xl hover:scale-105 transition-all duration-300 relative overflow-hidden"
            >
              <span className="relative z-10">Start Free Trial</span>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>

          {/* Animated Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {stats.map((stat, i) => (
              <div 
                key={i}
                className={`bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:scale-110 hover:shadow-xl transition-all duration-300 cursor-pointer animate-fade-in-up`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="text-4xl mb-2">{stat.icon}</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-white/50 dark:bg-gray-900/50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Features That Actually Work
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Unlike your last marketing campaign, these features deliver results
              <br />
              <span className="text-sm opacity-75">(We have the analytics to prove it. You probably don't.)</span>
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 hover:border-transparent hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 animate-fade-in-up relative overflow-hidden"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>
                <div className="relative z-10">
                  <div className="text-5xl mb-4 group-hover:scale-125 group-hover:rotate-12 transition-all duration-500">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - INR */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Pricing That Won't Make Your CFO Cry
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Unlike Mailchimp's $299/month, we charge in rupees. Revolutionary, we know.
              <br />
              <span className="text-sm opacity-75">(Seriously though, we're 70% cheaper. Do the math.)</span>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                name: 'Starter',
                price: '₹0',
                period: 'Forever Free',
                features: ['1,000 emails/month', 'Basic analytics (see who ignores you)', 'Email support (we reply faster than your customers)', '1 user', 'CSV upload (because Excel is life)'],
                cta: 'Start Free',
                plan: 'starter'
              },
              {
                name: 'Professional',
                price: '₹3,999',
                period: '/month',
                features: ['50,000 emails/month (that\'s a lot of spam)', 'Advanced analytics (know exactly who hates you)', 'Priority support (we\'ll reply in 5 min)', '5 users (share the pain)', 'Custom templates (look professional)', 'API access (for the nerds)', 'Webhooks (because automation)'],
                popular: true,
                cta: 'Start 14-day Trial',
                plan: 'professional'
              },
              {
                name: 'Enterprise',
                price: '₹14,999',
                period: '/month',
                features: ['Unlimited emails (go crazy)', 'Real-time analytics (watch the magic happen)', '24/7 support (we never sleep)', 'Unlimited users (bring the whole company)', 'Custom integrations (we\'ll integrate with your toaster)', 'Dedicated manager (your new best friend)', 'SLA guarantee (99.9% uptime or your money back)', 'White-label (pretend you built this)'],
                cta: 'Get Started',
                plan: 'enterprise'
              }
            ].map((plan, i) => (
              <div
                key={i}
                className={`relative bg-white dark:bg-gray-800 rounded-3xl p-8 border-2 transition-all duration-500 hover:scale-105 animate-fade-in-up ${
                  plan.popular 
                    ? 'border-blue-500 dark:border-blue-400 shadow-2xl scale-105 ring-4 ring-blue-500/20' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                }`}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg animate-pulse">
                    ⭐ Most Popular
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {plan.price}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3 text-gray-600 dark:text-gray-300">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    if (plan.plan === 'starter') {
                      navigate('/login');
                    } else if (plan.plan === 'professional' || plan.plan === 'enterprise') {
                      setSelectedPlan(plan.plan);
                    }
                  }}
                  className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-2xl'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm opacity-75">💳 All prices in Indian Rupees (₹). GST applicable as per Indian tax laws.
            <br />
            <span className="text-xs">P.S. - Yes, we're cheaper than Mailchimp. No, we're not cutting corners. We just don't have a fancy office in San Francisco.</span>
          </p>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-6 bg-white/50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Real Reviews from Real People
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              (Who are definitely not our friends. Probably.)
              <br />
              <span className="text-sm opacity-75">Okay fine, Priya is my cousin. But the other two are legit!</span>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 animate-fade-in-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl">{testimonial.avatar}</div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">{testimonial.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 italic">"{testimonial.content}"</p>
                <div className="flex gap-1 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-white shadow-2xl hover:scale-105 transition-transform duration-500 animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">
            Still Reading? You Must Be Interested.
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join 50,000+ marketers who stopped manually sending emails and started living their best life.
            <br />
            <span className="text-sm">(Okay, it's more like 500 users. But we're growing! Give us a break.)</span>
          </p>
          <button
            onClick={() => navigate('/login')}
            className="bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-2xl hover:scale-110 transition-all duration-300"
          >
            Fine, I'll Try It For Free →
          </button>
          <p className="mt-4 text-sm opacity-75">No credit card required • 14-day free trial • Cancel anytime (but you won't want to)</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center font-bold">
                  R
                </div>
                <span className="text-xl font-bold">Reachify</span>
              </div>
              <p className="text-gray-400 text-sm">
                Email marketing that doesn't suck.
                <br />
                <span className="text-xs opacity-75">(Most of the time.)</span>
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition">API Docs</a></li>
                <li><a href="#" className="hover:text-white transition">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition">About Us</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition">Cookie Policy</a></li>
                <li><a href="#" className="hover:text-white transition">GDPR</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>© 2026 Reachify. All rights reserved. Made with ❤️ (and lots of coffee ☕) in India</p>
            <p className="text-xs mt-2 opacity-75">
              No emails were harmed in the making of this platform. Okay, maybe a few bounced. But we fixed it!
            </p>
          </div>
        </div>
      </footer>

      {selectedPlan && (
        <PaymentModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSuccess={() => {
            setNotification({ message: 'Payment successful! Your subscription is now active.', type: 'success' });
            setSelectedPlan(null);
            setTimeout(() => navigate('/dashboard'), 2000);
          }}
        />
      )}

      {notification && (
        <NotificationToast
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-up {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.6s ease-out;
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.6s ease-out;
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default Home;
