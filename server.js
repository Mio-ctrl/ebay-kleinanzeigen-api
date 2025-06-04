// server.js - Express API für eBay Kleinanzeigen
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Max 100 requests pro 15 Minuten
  message: 'Zu viele Anfragen, bitte später erneut versuchen.'
});
app.use(limiter);

// Basis-URL für eBay Kleinanzeigen API
const EBAY_API_BASE = 'https://api.ebay-kleinanzeigen.de/api';

// Headers für API Requests
const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'de-DE,de;q=0.9',
});

// Hilfsfunktion für API Requests mit Retry-Logik
async function makeApiRequest(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting request to: ${url} (Attempt ${i + 1})`);
      
      const response = await axios.get(url, {
        headers: getHeaders(),
        timeout: 15000, // 15 Sekunden Timeout
      });
      
      return response.data;
    } catch (error) {
      console.error(`Request failed (Attempt ${i + 1}):`, error.message);
      
      if (i === retries - 1) throw error;
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

// Route: Anzeigen suchen
app.get('/search', async (req, res) => {
  try {
    const {
      q = 'technik',
      locationName = 'Berlin',
      distance = '50',
      categoryId = '161', // Elektronik
      sortBy = 'CREATION_DATE_DESC',
      limit = '20',
      priceMin,
      priceMax
    } = req.query;

    console.log('Search parameters:', req.query);

    // Baue die Such-URL
    const searchParams = new URLSearchParams({
      q,
      locationName,
      distance,
      categoryId,
      sortBy,
      limit
    });

    if (priceMin) searchParams.append('priceMin', priceMin);
    if (priceMax) searchParams.append('priceMax', priceMax);

    const searchUrl = `${EBAY_API_BASE}/ads?${searchParams.toString()}`;
    
    const data = await makeApiRequest(searchUrl);
    
    // Transformiere die Daten für das Frontend
    const transformedResults = data._embedded?.ads?.map(ad => ({
      id: ad.id,
      title: ad.title,
      price: ad.price?.display || 'Preis auf Anfrage',
      location: ad.location?.display,
      url: ad._links?.self?.href?.replace('/api/', '/s-anzeige/') || '#',
      postedDate: ad.postedDate,
      images: ad.pictures?.map(pic => pic._links?.large?.href) || []
    })) || [];

    res.json({
      success: true,
      count: transformedResults.length,
      results: transformedResults,
      query: req.query
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Laden der Suchergebnisse',
      details: error.message
    });
  }
});

// Route: Einzelne Anzeige laden
app.get('/ad/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Loading ad details for ID: ${id}`);
    
    const adUrl = `${EBAY_API_BASE}/ads/${id}`;
    const data = await makeApiRequest(adUrl);
    
    // Transformiere die Anzeigendetails
    const transformedAd = {
      id: data.id,
      title: data.title,
      description: data.description,
      price: data.price?.display || 'Preis auf Anfrage',
      location: data.location?.display,
      postedDate: data.postedDate,
      images: data.pictures?.map(pic => pic._links?.large?.href) || [],
      features: data.features || [],
      seller: {
        name: data.seller?.name || 'Unbekannt',
        type: data.seller?.type
      },
      url: data._links?.self?.href?.replace('/api/', '/s-anzeige/') || '#'
    };

    res.json({
      success: true,
      ...transformedAd
    });

  } catch (error) {
    console.error('Ad details error:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Laden der Anzeigendetails',
      details: error.message
    });
  }
});

// Route: Kategorien laden
app.get('/categories', async (req, res) => {
  try {
    const categoriesUrl = `${EBAY_API_BASE}/categories`;
    const data = await makeApiRequest(categoriesUrl);
    
    // Filtere Technik-relevante Kategorien
    const techCategories = data._embedded?.categories?.filter(cat => 
      cat.name.toLowerCase().includes('elektronik') ||
      cat.name.toLowerCase().includes('computer') ||
      cat.name.toLowerCase().includes('handy') ||
      cat.name.toLowerCase().includes('technik')
    ) || [];

    res.json({
      success: true,
      categories: techCategories
    });

  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Laden der Kategorien'
    });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'eBay Kleinanzeigen Technik API',
    version: '1.0.0',
    endpoints: {
      search: '/search?q=technik&locationName=Berlin',
      ad: '/ad/:id',
      categories: '/categories',
      health: '/health'
    }
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Interner Serverfehler',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Server starten - Railway benötigt 0.0.0.0 binding
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
  console.log(`📍 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔍 Beispiel Suche: http://localhost:${PORT}/search?q=laptop`);
});

module.exports = app;
