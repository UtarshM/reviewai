"use client";

import React, { useState, useEffect } from 'react';

export default function SubscriptionModal({ isOpen, onClose, onSubscriptionSuccess, token }) {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [currentSubscription, setCurrentSubscription] = useState(null);

  useEffect(() => {
    if (isOpen && token) {
      fetchSubscriptionStatus();
    }
  }, [isOpen, token]);

  const fetchSubscriptionStatus = async () => {
    try {
      const res = await fetch('/api/v1/payments/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentSubscription(data);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  if (!isOpen) return null;

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSelectPlan = async (planKey) => {
    setError(null);
    setSuccessMsg(null);
    setLoadingPlan(planKey);

    try {
      // 1. Create order on backend
      const res = await fetch('/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan: planKey })
      });

      const orderData = await res.json();

      if (!res.ok) {
        throw new Error(orderData.message || 'Failed to create payment order');
      }

      // 2. Load Razorpay script
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded && orderData.key_id !== 'rzp_test_dummy_key_id') {
        throw new Error('Razorpay SDK failed to load. Please check internet connection.');
      }

      // 3. Setup Razorpay options or handle testing mode
      if (window.Razorpay && orderData.key_id !== 'rzp_test_dummy_key_id') {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Reply Desk',
          description: orderData.plan_name,
          order_id: orderData.order_id,
          handler: async function (response) {
            await verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature, planKey);
          },
          theme: { color: '#2563eb' }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Test / Demo Mode fallback activation
        console.log('[DEMO PAYMENT] Activating test subscription');
        await verifyPayment(orderData.order_id, `pay_demo_${Date.now()}`, 'demo_signature', planKey);
      }

    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message);
    } finally {
      setLoadingPlan(null);
    }
  };

  const verifyPayment = async (orderId, paymentId, signature, planKey) => {
    try {
      const res = await fetch('/api/v1/payments/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          plan: planKey
        })
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMsg(data.message);
        fetchSubscriptionStatus();
        if (onSubscriptionSuccess) onSubscriptionSuccess(data);
      } else {
        throw new Error(data.message || 'Payment verification failed');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-surface-container-high rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-outline-variant relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-2 rounded-full hover:bg-surface-bright transition"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-3">
            <span className="material-symbols-outlined text-[28px]">stars</span>
          </div>
          <h2 className="text-2xl font-bold text-on-surface">Choose Your Access Plan</h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            Get complete access to AI Review Management & Business Profiles
          </p>

          {currentSubscription?.is_active && (
            <div className="mt-3 inline-block bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-semibold">
              ✓ Active Plan: {currentSubscription.subscription_plan === '12_months' ? '12 Months' : '6 Months'} 
              (Valid until {new Date(currentSubscription.subscription_expires_at).toLocaleDateString()})
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 text-sm font-semibold rounded-lg text-center">
            {successMsg}
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          {/* 1 Month Plan */}
          <div className="border-2 border-outline-variant hover:border-primary rounded-xl p-4 flex flex-col justify-between transition-all hover:shadow-md bg-surface">
            <div>
              <div className="text-label-md font-bold text-primary uppercase tracking-wider mb-1">
                Monthly Access
              </div>
              <div className="text-2xl font-extrabold text-on-surface mb-1">
                ₹1,000 <span className="text-xs font-normal text-on-surface-variant">/ month</span>
              </div>
              <div className="text-xs text-on-surface-variant mb-4">
                Flexible Monthly Billing
              </div>

              <ul className="space-y-2 text-xs text-on-surface-variant mb-4">
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  <span>Full AI Review Reply</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  <span>QR Review Acquisition</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  <span>Private Feedback Filter</span>
                </li>
              </ul>
            </div>

            <button
              disabled={loadingPlan !== null}
              onClick={() => handleSelectPlan('1_month')}
              className="w-full py-2 px-3 bg-surface-container-high hover:bg-primary hover:text-white text-primary font-bold rounded-lg transition-all border border-primary/30 flex items-center justify-center gap-1.5 text-xs cursor-pointer"
            >
              {loadingPlan === '1_month' ? 'Processing...' : 'Pay ₹1,000'}
            </button>
          </div>

          {/* 6 Months Plan */}
          <div className="border-2 border-outline-variant hover:border-primary rounded-xl p-4 flex flex-col justify-between transition-all hover:shadow-md bg-surface">
            <div>
              <div className="text-label-md font-bold text-primary uppercase tracking-wider mb-1">
                Semi-Annual
              </div>
              <div className="text-2xl font-extrabold text-on-surface mb-1">
                ₹4,000 <span className="text-xs font-normal text-on-surface-variant">/ 6 months</span>
              </div>
              <div className="text-xs text-on-surface-variant mb-4">
                Save ₹2,000 vs monthly
              </div>

              <ul className="space-y-2 text-xs text-on-surface-variant mb-4">
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  <span>All Monthly Features</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  <span>Multi-Franchise Support</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  <span>AI Google Posts</span>
                </li>
              </ul>
            </div>

            <button
              disabled={loadingPlan !== null}
              onClick={() => handleSelectPlan('6_months')}
              className="w-full py-2 px-3 bg-surface-container-high hover:bg-primary hover:text-white text-primary font-bold rounded-lg transition-all border border-primary/30 flex items-center justify-center gap-1.5 text-xs cursor-pointer"
            >
              {loadingPlan === '6_months' ? 'Processing...' : 'Pay ₹4,000'}
            </button>
          </div>

          {/* 12 Months Plan (Best Value) */}
          <div className="border-2 border-primary rounded-xl p-4 flex flex-col justify-between transition-all shadow-md bg-primary/5 relative">
            <div className="absolute -top-3 right-3 bg-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Best Value
            </div>

            <div>
              <div className="text-label-md font-bold text-primary uppercase tracking-wider mb-1">
                Annual Access
              </div>
              <div className="text-2xl font-extrabold text-on-surface mb-1">
                ₹5,000 <span className="text-xs font-normal text-on-surface-variant">/ 12 months</span>
              </div>
              <div className="text-xs text-emerald-700 font-semibold mb-4">
                Save ₹7,000! (₹416/mo)
              </div>

              <ul className="space-y-2 text-xs text-on-surface-variant mb-4">
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  <span>All 6-Month Features</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  <span>Priority AI Processing</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  <span>Full SEO Audit Suite</span>
                </li>
              </ul>
            </div>

            <button
              disabled={loadingPlan !== null}
              onClick={() => handleSelectPlan('12_months')}
              className="w-full py-2 px-3 bg-primary hover:brightness-110 text-white font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 text-xs cursor-pointer"
            >
              {loadingPlan === '12_months' ? 'Processing...' : 'Pay ₹5,000'}
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-on-surface-variant">
          🔒 Secure Checkout powered by Razorpay (UPI, Google Pay, PhonePe, Cards & NetBanking)
        </div>
      </div>
    </div>
  );
}
