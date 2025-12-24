/**
 * Pexels API Client
 * Based on official Pexels API documentation: https://www.pexels.com/api/documentation/
 */
class PexelsApi {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('API key is required');
        }
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.pexels.com/v1';
        this.timeout = 10000; // 10 seconds
    }

    /**
     * Make a request to Pexels API
     * @private
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} - Response data
     */
    async _request(endpoint, params = {}) {
        try {
            // Build query string
            const queryParams = new URLSearchParams();
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    queryParams.append(key, params[key]);
                }
            });
            
            const url = `${this.baseUrl}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            
            // Add timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': this.apiKey
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    // If response is not JSON, use status text
                }
                
                // Handle specific error codes
                if (response.status === 401) {
                    throw new Error('Invalid API key. Please check your Pexels API key.');
                } else if (response.status === 429) {
                    throw new Error('API rate limit exceeded. Please try again later.');
                } else if (response.status === 400) {
                    throw new Error(`Bad request: ${errorMessage}`);
                } else {
                    throw new Error(errorMessage);
                }
            }

            const data = await response.json();
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Please check your internet connection.');
            }
            throw error;
        }
    }

    /**
     * Search for photos
     * @param {string} query - Search query (required)
     * @param {Object} options - Search options
     * @param {number} options.per_page - Number of results per page (default: 15, max: 80)
     * @param {number} options.page - Page number (default: 1)
     * @param {string} options.orientation - Photo orientation: 'landscape', 'portrait', or 'square'
     * @param {string} options.size - Minimum photo size: 'large', 'medium', or 'small'
     * @param {string} options.color - Desired photo color (e.g., 'red', 'blue', or hex code)
     * @param {string} options.locale - Locale for search (e.g., 'en-US', 'fr-FR')
     * @returns {Promise<Object>} - Response with photos array
     */
    async searchPhotos(query, options = {}) {
        if (!query || typeof query !== 'string') {
            throw new Error('Search query is required and must be a string');
        }

        const params = {
            query: query,
            per_page: Math.min(options.per_page || 15, 80), // Max 80 per page
            page: options.page || 1
        };

        // Add optional parameters
        if (options.orientation) {
            const validOrientations = ['landscape', 'portrait', 'square'];
            if (validOrientations.includes(options.orientation)) {
                params.orientation = options.orientation;
            }
        }

        if (options.size) {
            const validSizes = ['large', 'medium', 'small'];
            if (validSizes.includes(options.size)) {
                params.size = options.size;
            }
        }

        if (options.color) {
            params.color = options.color;
        }

        if (options.locale) {
            params.locale = options.locale;
        }

        return await this._request('/search', params);
    }

    /**
     * Get curated photos
     * @param {Object} options - Options
     * @param {number} options.per_page - Number of results per page (default: 15, max: 80)
     * @param {number} options.page - Page number (default: 1)
     * @returns {Promise<Object>} - Response with photos array
     */
    async getCuratedPhotos(options = {}) {
        const params = {
            per_page: Math.min(options.per_page || 15, 80),
            page: options.page || 1
        };

        return await this._request('/curated', params);
    }

    /**
     * Get photo details by ID
     * @param {number} id - Photo ID
     * @returns {Promise<Object>} - Photo object
     */
    async getPhotoById(id) {
        if (!id) {
            throw new Error('Photo ID is required');
        }
        return await this._request(`/photos/${id}`);
    }

    /**
     * Get a random photo by keyword
     * @param {string} query - Search keyword
     * @param {Object} options - Additional search options
     * @returns {Promise<Object>} - Random photo object
     */
    async getRandomPhoto(query, options = {}) {
        try {
            // First, get first page to check total results
            const firstPage = await this.searchPhotos(query, { 
                per_page: 1, 
                page: 1,
                ...options 
            });
            
            const totalResults = firstPage.total_results || 0;
            
            if (totalResults === 0) {
                throw new Error(`No photos found for query: "${query}"`);
            }

            // Calculate total pages (max 80 per page, max 80 pages = 6400 results)
            const maxPerPage = 80;
            const maxPages = 80;
            const totalPages = Math.min(Math.ceil(totalResults / maxPerPage), maxPages);
            
            // Get a random page
            const randomPage = Math.floor(Math.random() * totalPages) + 1;
            
            // Fetch photos from random page
            const data = await this.searchPhotos(query, {
                per_page: maxPerPage,
                page: randomPage,
                ...options
            });
            
            if (data.photos && data.photos.length > 0) {
                // Return a random photo from the results
                const randomIndex = Math.floor(Math.random() * data.photos.length);
                return data.photos[randomIndex];
            } else {
                // Fallback to first page if random page has no results
                const fallbackData = await this.searchPhotos(query, {
                    per_page: maxPerPage,
                    page: 1,
                    ...options
                });
                
                if (fallbackData.photos && fallbackData.photos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * fallbackData.photos.length);
                    return fallbackData.photos[randomIndex];
                }
                
                throw new Error(`No photos found for query: "${query}"`);
            }
        } catch (error) {
            console.error('Error getting random photo:', error);
            throw error;
        }
    }

    /**
     * Get photo URL with size preference
     * @param {Object} photo - Photo object from Pexels API
     * @param {string} preferredSize - Preferred size: 'original', 'large2x', 'large', 'medium', 'small', 'tiny', 'portrait', 'landscape', 'square'
     * @returns {string} - Photo URL
     */
    getPhotoUrl(photo, preferredSize = 'large2x') {
        if (!photo || !photo.src) {
            return '';
        }

        // If preferred size exists, use it
        if (photo.src[preferredSize]) {
            return photo.src[preferredSize];
        }

        // Fallback order: large2x -> large -> medium -> original -> small
        return photo.src.large2x || 
               photo.src.large || 
               photo.src.medium || 
               photo.src.original || 
               photo.src.small || 
               '';
    }

    /**
     * Get photographer credit information
     * @param {Object} photo - Photo object from Pexels API
     * @returns {Object} - Photographer info {name, url}
     */
    getPhotographerCredit(photo) {
        if (!photo) {
            return {
                name: 'Unknown',
                url: '#'
            };
        }

        return {
            name: photo.photographer || 'Unknown',
            url: photo.photographer_url || '#'
        };
    }

    /**
     * Get all available photo sizes
     * @param {Object} photo - Photo object from Pexels API
     * @returns {Object} - Object with all available sizes
     */
    getPhotoSizes(photo) {
        if (!photo || !photo.src) {
            return {};
        }
        return photo.src;
    }
}
