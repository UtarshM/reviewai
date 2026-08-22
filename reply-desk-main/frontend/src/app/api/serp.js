const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

function extractPlaceId(url) {
  if (!url) return null;
  const match = url.match(/[?&]placeid=([^&]+)/i) || url.match(/[?&]place_id=([^&]+)/i);
  if (match) return match[1];
  return null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function normalizeWord(w) {
  return w.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function locationMatches(expectedLoc, resultAddress) {
  if (!expectedLoc) return true;
  const address = (resultAddress || '').toLowerCase();
  const loc = expectedLoc.toLowerCase().trim();
  if (!loc) return true;

  // Strict country mismatch check to prevent US/India crossovers
  if (loc === 'india' || loc === 'in') {
    if (address.includes('united states') || address.includes('usa') || address.includes(', us') || address.includes('united kingdom') || address.includes('uk') || address.includes('canada') || address.includes('australia')) {
      return false;
    }
  }
  if (loc === 'united states' || loc === 'usa' || loc === 'us') {
    if (address.includes('india') || address.includes('united kingdom') || address.includes('uk') || address.includes('canada') || address.includes('australia')) {
      return false;
    }
  }

  if (address.includes(loc)) return true;
  const locWords = loc.split(/[\s\-]+/).filter(w => w.length > 2);
  const addrWords = address.split(/[\s\-]+/);
  return locWords.some(lw => addrWords.some(aw => aw.startsWith(lw) || lw.startsWith(aw)));
}

function scoreResultMatch(businessName, resultTitle, resultAddress, expectedCountry, expectedCity) {
  const name = businessName.toLowerCase().trim();
  const title = (resultTitle || '').toLowerCase().trim();

  if (!locationMatches(expectedCountry, resultAddress)) return -1;

  let cityMatched = locationMatches(expectedCity, resultAddress);
  let nameScore = 0;

  if (name === title) {
    nameScore = 100;
  } else {
    const nameWords = name.split(/[\s\-]+/).map(normalizeWord).filter(w => w.length > 2);
    const titleWords = title.split(/[\s\-]+/).map(normalizeWord).filter(w => w.length > 0);

    if (nameWords.length > 0) {
      let matchCount = 0;
      for (const nw of nameWords) {
        const matched = titleWords.some(tw =>
          tw === nw ||
          (tw.length > 2 && nw.length > 2 && (tw.startsWith(nw) || nw.startsWith(tw)))
        );
        if (matched) matchCount++;
      }
      nameScore = (matchCount / nameWords.length) * 100;
    }
  }

  if (!cityMatched) {
    nameScore *= 0.5;
  }

  return nameScore;
}

function getCountryCode(country) {
  const c = (country || '').toLowerCase().trim();
  const map = {
    'india': 'in', 'united states': 'us', 'usa': 'us', 'united kingdom': 'gb',
    'uk': 'gb', 'canada': 'ca', 'australia': 'au', 'germany': 'de',
    'france': 'fr', 'uae': 'ae', 'united arab emirates': 'ae'
  };
  return map[c] || null;
}

export async function resolvePlaceId(businessName, businessCategory, city, state, country) {
  if (!SERPAPI_API_KEY) {
    throw new Error('SerpApi API key is not configured');
  }

  const gl = getCountryCode(country);

  // Define fallback query candidates
  const queryCandidates = [];
  
  // 1. Full detailed query
  const fullParts = [businessName, city, state, country].filter(Boolean);
  queryCandidates.push(fullParts.join(' '));

  // 2. City + Country fallback
  const cityCountryParts = [businessName, city, country].filter(Boolean);
  if (cityCountryParts.length < fullParts.length) {
    queryCandidates.push(cityCountryParts.join(' '));
  }

  // 3. City fallback
  const cityParts = [businessName, city].filter(Boolean);
  if (cityParts.length < cityCountryParts.length) {
    queryCandidates.push(cityParts.join(' '));
  }

  // 4. Name only fallback
  if (businessName && businessName !== queryCandidates[queryCandidates.length - 1]) {
    queryCandidates.push(businessName);
  }

  let allResults = [];
  let lastError = null;

  for (const searchQuery of queryCandidates) {
    let searchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(searchQuery)}&api_key=${SERPAPI_API_KEY}`;
    if (gl) searchUrl += `&gl=${gl}`;

    console.log(`[SerpApi] Trying query: "${searchQuery}" | gl=${gl || 'none'} | URL: ${searchUrl.replace(SERPAPI_API_KEY, 'HIDDEN')}`);

    try {
      const searchResponse = await fetchWithTimeout(searchUrl);
      if (!searchResponse.ok) {
        throw new Error(`SerpApi search failed with status ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      const results = Array.isArray(searchData.local_results) ? searchData.local_results : [];
      let placeResults = [];
      if (Array.isArray(searchData.place_results)) {
        placeResults = searchData.place_results;
      } else if (searchData.place_results && typeof searchData.place_results === 'object') {
        placeResults = [searchData.place_results];
      }

      allResults = [...results, ...placeResults];

      if (allResults.length > 0) {
        console.log(`[SerpApi] Found ${allResults.length} candidates for query "${searchQuery}"`);
        break; // Stop falling back if we have results
      }
    } catch (err) {
      console.error(`[SerpApi] Error for query "${searchQuery}":`, err.message);
      lastError = err;
    }
  }

  if (allResults.length === 0) {
    throw lastError || new Error(`No business profile found matching "${businessName}" on Google Maps.`);
  }

  let bestResult = null;
  let bestScore = -1;

  for (const result of allResults) {
    let fullResultAddress = result.address || '';
    if (result.country && !fullResultAddress.toLowerCase().includes(result.country.toLowerCase())) {
      fullResultAddress += `, ${result.country}`;
    }
    const score = scoreResultMatch(businessName, result.title, fullResultAddress, country, city);
    console.log(`[SerpApi] Score for "${result.title}": ${score}`);
    if (score > bestScore) {
      bestScore = score;
      bestResult = result;
    }
  }

  if (bestResult && bestResult.place_id && bestScore >= 50) {
    console.log(`[SerpApi] ✓ Resolved place_id: ${bestResult.place_id} (title: "${bestResult.title}", score: ${bestScore})`);
    return bestResult.place_id;
  }

  console.error(`[SerpApi] ✗ No confident match. Best candidate: "${bestResult?.title}" score ${bestScore}`);
  throw new Error(`No matching business found for "${businessName}" with sufficient confidence.`);
}

export async function fetchGoogleReviews(businessName, businessCategory, reviewLink, city, state, country) {
  if (!SERPAPI_API_KEY) {
    throw new Error('SerpApi API key is not configured');
  }

  let placeId = extractPlaceId(reviewLink);

  if (!placeId) {
    placeId = await resolvePlaceId(businessName, businessCategory, city, state, country);
  }

  const reviewsUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&sort_by=newestFirst&place_id=${placeId}&api_key=${SERPAPI_API_KEY}`;

  const reviewsResponse = await fetchWithTimeout(reviewsUrl);
  if (!reviewsResponse.ok) {
    throw new Error(`Google Maps reviews fetch failed with status ${reviewsResponse.status}`);
  }

  const reviewsData = await reviewsResponse.json();
  if (reviewsData.error) {
    throw new Error(`SerpApi reviews error: ${reviewsData.error}`);
  }

  const rawReviews = reviewsData.reviews || [];
  const mappedReviews = rawReviews.map(r => ({
    customer_name: r.user?.name || 'Anonymous Customer',
    rating: r.rating || 5,
    review_text: r.snippet || r.text || '',
    publish_date: r.date || 'Recent'
  }));

  return {
    place_name: reviewsData.place_info?.title || businessName,
    rating: reviewsData.place_info?.rating || null,
    reviews: mappedReviews,
    place_id: placeId
  };
}
