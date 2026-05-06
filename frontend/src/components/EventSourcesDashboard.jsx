import React, { useEffect, useState } from 'react';
import '../styles/EventSourcesDashboard.css';

const API_BASE = 'http://127.0.0.1:8000/api';
const SEARCH_HISTORY_KEY = 'eventLocationHistory';

const CATEGORY_ICONS = {
  'Government & City': 'City',
  'Event Platforms': 'Platform',
  'Tourism & Visitors': 'Tourism',
  Universities: 'University',
  'Social Media': 'Social',
  'Venues & Theaters': 'Venue',
  Sports: 'Sports',
  'News & Media': 'News',
  Community: 'Community',
  'Other Event Sources': 'Other',
};

function EventSourcesDashboard() {
  const [location, setLocation] = useState('Palo Alto, CA');
  const [websites, setWebsites] = useState([]);
  const [websitesByCategory, setWebsitesByCategory] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('category');
  const [searchHistory, setSearchHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const trimmed = location.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/search?text=${encodeURIComponent(trimmed)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && Array.isArray(data.results)) {
            setSuggestions(data.results);
          }
        }
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [location]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!event.target.closest('.input-container')) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  const handleSuggestionClick = (selected) => {
    setLocation(selected.name);
    setSuggestions([]);
    setShowSuggestions(false);
    handleSearch(selected.name);
  };

  const loadSearchHistory = () => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSearchHistory(parsed);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to parse search history:', err);
    }
    setSearchHistory(['Palo Alto, CA']);
  };

  useEffect(() => {
    loadSearchHistory();
    handleSearch('Palo Alto, CA');
  }, []);

  const saveSearchHistory = (searchLocation) => {
    setSearchHistory((previousHistory) => {
      const nextHistory = [
        searchLocation,
        ...previousHistory.filter((item) => item !== searchLocation),
      ];
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory.slice(0, 20)));
      return nextHistory;
    });
  };


  const handleSearch = async (searchLocation) => {
    const trimmedLocation = searchLocation.trim();

    if (!trimmedLocation) {
      setError('Please enter a location');
      return;
    }

    // ── Check Cache First! ──
    const cacheKey = `eventLocationCache_${trimmedLocation.toLowerCase()}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed && parsed.websites && parsed.websitesByCategory) {
          setLocation(trimmedLocation);
          setWebsites(parsed.websites);
          setWebsitesByCategory(parsed.websitesByCategory);
          setError(null);
          saveSearchHistory(trimmedLocation);
          return;
        }
      } catch (cacheError) {
        console.error('Failed to parse cached data:', cacheError);
      }
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/event-websites-by-category?location=${encodeURIComponent(trimmedLocation)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'success') {
        throw new Error(data.message || 'Failed to fetch websites');
      }

      const groupedWebsites = data.websites_by_category || {};
      const flatWebsites = Object.values(groupedWebsites).flat();

      setLocation(trimmedLocation);
      setWebsitesByCategory(groupedWebsites);
      setWebsites(flatWebsites);
      saveSearchHistory(trimmedLocation);

      // ── Save to Cache! ──
      if (flatWebsites.length > 0) {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            websites: flatWebsites,
            websitesByCategory: groupedWebsites,
          })
        );
      }

      if (flatWebsites.length === 0) {
        setError('No event websites found. Try a different location.');
      }
    } catch (fetchError) {
      console.error('Event website search failed:', fetchError);
      setWebsites([]);
      setWebsitesByCategory({});
      setError(fetchError.message || 'Failed to fetch websites');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSearch(location);
      setShowSuggestions(false);
    }
  };

  const getPriorityColor = (priority = 0) => {
    if (priority >= 9) return '#ef4444';
    if (priority >= 7) return '#f97316';
    if (priority >= 5) return '#eab308';
    if (priority >= 3) return '#84cc16';
    return '#6b7280';
  };

  const getCategoryIcon = (category) => CATEGORY_ICONS[category] || 'Source';

  const sortedCategoryEntries = Object.entries(websitesByCategory).sort(([, leftItems], [, rightItems]) => {
    const leftAverage =
      leftItems.reduce((sum, website) => sum + (website.priority || 0), 0) / (leftItems.length || 1);
    const rightAverage =
      rightItems.reduce((sum, website) => sum + (website.priority || 0), 0) / (rightItems.length || 1);

    return rightAverage - leftAverage;
  });

  const sortedWebsites = [...websites].sort((leftWebsite, rightWebsite) => {
    return (rightWebsite.priority || 0) - (leftWebsite.priority || 0);
  });

  return (
    <div className="event-sources-dashboard">
      <div className="sources-header">
        <h1>Find All Event Websites Near You</h1>
        <p className="subtitle">
          Search for a location to see websites hosting nearby events through SerpAPI
        </p>
      </div>

      <div className="search-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: '1 1 500px', display: 'flex', gap: '1rem', marginBottom: 0 }}>
          <div className="input-container" style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleLocationKeyDown}
              placeholder="Enter location (for example, Palo Alto, CA)"
              className="location-input"
              disabled={loading}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="autocomplete-dropdown">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.name}-${index}`}
                    type="button"
                    className="autocomplete-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <span className="suggestion-icon">📍</span>
                    <div className="suggestion-details">
                      <span className="suggestion-name">{suggestion.name}</span>
                      {suggestion.address && (
                        <span className="suggestion-address">{suggestion.address}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              handleSearch(location);
              setShowSuggestions(false);
            }}
            disabled={loading}
            className="search-button"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Dropdown on the right side */}
        <div className="search-history" style={{ borderTop: 'none', paddingTop: 0, margin: 0, display: 'flex', alignItems: 'center', gap: '1rem', flex: '0 1 auto' }}>
          <span className="history-label" style={{ fontWeight: 800, color: '#4f46e5', fontSize: '12px' }}>Recent Searches:</span>
          <div className="history-select-container" style={{ minWidth: '220px' }}>
            <select
              id="recent-searches-select"
              className="history-select"
              value={location}
              onChange={(event) => {
                if (event.target.value) {
                  handleSearch(event.target.value);
                }
              }}
              style={{
                width: '100%',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: '700',
                color: '#1e293b',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="" disabled>Select from cached history...</option>
              {searchHistory.length > 0 ? (
                searchHistory.map((historyItem) => (
                  <option key={historyItem} value={historyItem}>
                    {historyItem}
                  </option>
                ))
              ) : (
                <>
                  <option value="Palo Alto, CA">Palo Alto, CA</option>
                  <option value="San Francisco, CA">San Francisco, CA</option>
                  <option value="Palo Alto">Palo Alto</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {websites.length > 0 && (
        <div className="view-toggle-section">
          <div className="view-buttons">
            <button
              type="button"
              className={`view-btn ${viewMode === 'category' ? 'active' : ''}`}
              onClick={() => setViewMode('category')}
            >
              By Category
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List View
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grid View
            </button>
          </div>
        </div>
      )}

      {loading && <div className="loading-spinner">Searching for event websites...</div>}

      {error && <div className="error-message">{error}</div>}

      {!loading && !error && websites.length === 0 && (
        <div className="no-results">
          <p>Click Search to find event websites for {location}.</p>
        </div>
      )}

      {!loading && !error && viewMode === 'category' && sortedCategoryEntries.length > 0 && (
        <div className="category-view">
          {sortedCategoryEntries.map(([category, items]) => (
            <div key={category} className="category-section">
              <h2 className="category-title">
                {getCategoryIcon(category)} {category}
                <span className="category-count">{items.length}</span>
              </h2>

              <div className="websites-grid-cat">
                {items.map((website, index) => (
                  <a
                    key={`${category}-${website.url || website.name || index}`}
                    href={website.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="website-card"
                  >
                    <div className="card-header">
                      <h3>{website.name}</h3>
                      <span
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(website.priority) }}
                      >
                        {website.priority || 0}/10
                      </span>
                    </div>
                    <p className="card-domain">{website.domain}</p>
                    <p className="card-description">{website.description}</p>
                    <div className="card-footer">
                      <span className="visit-link">Visit Website -&gt;</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && viewMode === 'list' && sortedWebsites.length > 0 && (
        <div className="websites-list">
          {sortedWebsites.map((website, index) => (
            <a
              key={website.url || website.name || index}
              href={website.url}
              target="_blank"
              rel="noopener noreferrer"
              className="website-list-item"
            >
              <div>
                <div className="list-item-header">
                  <h3>{website.name}</h3>
                  <span className="category-label">{website.category}</span>
                </div>
                <p className="list-item-domain">{website.domain}</p>
              </div>
              <div className="list-item-meta">
                <span className="priority" style={{ color: getPriorityColor(website.priority) }}>
                  Priority {website.priority || 0}/10
                </span>
                <span className="visit-arrow">-&gt;</span>
              </div>
            </a>
          ))}
        </div>
      )}

      {!loading && !error && viewMode === 'grid' && sortedWebsites.length > 0 && (
        <div className="websites-grid">
          {sortedWebsites.map((website, index) => (
            <a
              key={website.url || website.name || index}
              href={website.url}
              target="_blank"
              rel="noopener noreferrer"
              className="website-grid-card"
            >
              <div className="grid-card-top">
                <div className="grid-icon">{getCategoryIcon(website.category)}</div>
                <span
                  className="grid-priority"
                  style={{ backgroundColor: getPriorityColor(website.priority) }}
                >
                  {website.priority || 0}
                </span>
              </div>
              <h4>{website.name}</h4>
              <p className="grid-domain">{website.domain}</p>
              <p className="grid-category">{website.category}</p>
              <div className="grid-footer">
                <small>Visit</small>
              </div>
            </a>
          ))}
        </div>
      )}

      {!loading && !error && websites.length > 0 && (
        <div className="summary-footer">
          <p>
            Found <strong>{websites.length}</strong> event websites for "{location}" across
            <strong> {Object.keys(websitesByCategory).length}</strong> categories
          </p>
        </div>
      )}
    </div>
  );
}

export default EventSourcesDashboard;
