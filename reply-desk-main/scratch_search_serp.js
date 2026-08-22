import dotenv from 'dotenv';
dotenv.config();

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

function normalizeWord(w) {
  return w.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function locationMatches(expectedLoc, resultAddress) {
  if (!expectedLoc) return true;
  const address = (resultAddress || '').toLowerCase();
  const loc = expectedLoc.toLowerCase().trim();
  if (!loc) return true;
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

async function run() {
  const businessName = "Cottonyard Furnishing";
  const city = "Ahmedabad";
  const state = "Gujarat";
  const country = "India";
  const searchQuery = "Cottonyard Furnishing Ahmedabad Gujarat India";
  
  const searchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(searchQuery)}&api_key=${SERPAPI_API_KEY}&gl=in`;

  console.log("Searching SerpApi: " + searchUrl);
  const res = await fetch(searchUrl);
  const data = await res.json();

  const results = Array.isArray(data.local_results) ? data.local_results : [];
  const placeResults = Array.isArray(data.place_results) ? data.place_results : [];
  const allResults = [...results, ...placeResults];

  console.log(`Found ${allResults.length} results:`);
  for (const r of allResults) {
    const score = scoreResultMatch(businessName, r.title, r.address, country, city);
    console.log(`- Title: "${r.title}"`);
    console.log(`  Address: "${r.address}"`);
    console.log(`  Place ID: "${r.place_id}"`);
    console.log(`  Score: ${score}`);
  }
}

run();
