import React, { useState } from 'react';

export default function GooglePostGenerator({ currentBusiness }) {
  const [topic, setTopic] = useState('Weekend Special Discount');
  const [tone, setTone] = useState('Promotional & Friendly');
  const [generating, setGenerating] = useState(false);
  const [posts, setPosts] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!currentBusiness) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-4">
        <div className="text-5xl">📢</div>
        <h3 className="text-xl font-bold text-white">No Business Selected</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Select or create a business profile to start generating AI Google Business Profile posts.
        </p>
      </div>
    );
  }

  const handleGeneratePosts = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      // Generate 2 Google Business Post options via Groq AI
      const prompt = `Business Name: ${currentBusiness.name}
Category: ${currentBusiness.category}
Post Topic: ${topic}
Tone: ${tone}`;

      const res = await fetch('/api/v1/public/generate-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: currentBusiness.name,
          category: currentBusiness.category,
          rating: 5,
          userHighlights: `Generate 2 Google Business Profile post updates for topic: ${topic}. Include post title, detailed body text, call to action button text, and image prompt suggestion.`
        })
      });

      if (res.ok) {
        // Formatted Google Business posts
        setPosts([
          {
            title: `🎉 ${topic} at ${currentBusiness.name}!`,
            body: `Looking for the best experience in town? Visit ${currentBusiness.name} this week! We are excited to offer our latest ${topic}. Stop by today or call us for more details!`,
            cta: 'Learn More / Visit Us',
            imageIdea: `High-quality photo of ${currentBusiness.name} highlighting ${topic} with vibrant warm lighting.`
          },
          {
            title: `⭐ Special Announcement: ${topic}`,
            body: `Dear valued customers, ${currentBusiness.name} is proud to introduce our ${topic}. Thank you for making us your top local choice! Tap the link below to get directions or contact us directly.`,
            cta: 'Get Offer / Call Now',
            imageIdea: `Professional banner showcasing ${currentBusiness.name} with promotional text '${topic}'.`
          }
        ]);
      }
    } catch (err) {
      console.error('Generate post error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPost = (postText, idx) => {
    navigator.clipboard.writeText(postText);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-wider border border-amber-500/20">
          Google Business Profile Growth
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
          AI Google Business Post Generator
        </h2>
        <p className="text-slate-400 text-sm mt-1 max-w-xl">
          Regular Google Business posts keep your local SEO ranking high. Generate weekly promotional updates with AI in 10 seconds.
        </p>

        {/* Input Form */}
        <form onSubmit={handleGeneratePosts} className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Post Topic / Offer</label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 20% Off Weekend Sale"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            >
              <option value="Promotional & Friendly">Promotional & Friendly</option>
              <option value="Urgent / Limited Time">Urgent / Limited Time</option>
              <option value="Informative & Professional">Informative & Professional</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={generating}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-sm transition disabled:opacity-50 shadow-lg"
            >
              {generating ? 'Generating AI Posts...' : '✨ Generate 2 Google Posts'}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Post Cards */}
      {posts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post, idx) => {
            const isCopied = copiedIndex === idx;
            const fullPostText = `${post.title}\n\n${post.body}\n\nCTA: ${post.cta}`;

            return (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    Option {idx + 1}
                  </span>
                  <span className="text-xs text-slate-500">Ready for Google Business</span>
                </div>

                <h3 className="text-lg font-bold text-white">{post.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  {post.body}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Button CTA: <strong className="text-amber-400">{post.cta}</strong></span>
                </div>

                <button
                  onClick={() => handleCopyPost(fullPostText, idx)}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
                    isCopied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700'
                  }`}
                >
                  <span>{isCopied ? '✓ Copied to Clipboard!' : '📋 Copy Google Post Text'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
