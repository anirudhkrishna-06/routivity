// API Configuration
const API_BASE_URL = 'http://localhost:8000';

// DOM Elements
const tripForm = document.getElementById('tripForm');
const resultsSection = document.getElementById('resultsSection');
const loadingSpinner = document.getElementById('loadingSpinner');

// Form Elements
const sourceLatInput = document.getElementById('sourceLat');
const sourceLngInput = document.getElementById('sourceLng');
const destLatInput = document.getElementById('destLat');
const destLngInput = document.getElementById('destLng');
const mealPreferencesSelect = document.getElementById('mealPreferences');
const lunchStartInput = document.getElementById('lunchStart');
const lunchEndInput = document.getElementById('lunchEnd');
const dinnerStartInput = document.getElementById('dinnerStart');
const dinnerEndInput = document.getElementById('dinnerEnd');
const arrivalTimeInput = document.getElementById('arrivalTime');

// Results Elements
const departureTimeElement = document.getElementById('departureTime');
const mealStopsCountElement = document.getElementById('mealStopsCount');
const routeLegsCountElement = document.getElementById('routeLegsCount');
const routeLegsElement = document.getElementById('routeLegs');
const mealStopsListElement = document.getElementById('mealStopsList');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set default values for quick testing
    setDefaultValues();
    
    // Add form submission handler
    tripForm.addEventListener('submit', handleFormSubmission);
    
    // Add navigation handlers
    setupNavigation();
    
    // Check backend status
    checkBackendStatus();
});

// Set default values for testing
function setDefaultValues() {
    sourceLatInput.value = '40.7128';  // New York
    sourceLngInput.value = '-74.0060';
    destLatInput.value = '34.0522';    // Los Angeles
    destLngInput.value = '-118.2437';
    mealPreferencesSelect.value = 'vegetarian';
}

// Handle form submission
async function handleFormSubmission(event) {
    event.preventDefault();
    
    try {
        // Show loading spinner
        showLoading();
        
        // Collect form data
        const formData = collectFormData();
        
        // Validate form data
        if (!validateFormData(formData)) {
            hideLoading();
            return;
        }
        
        // Try to make API call, fallback to mock data if backend is not available
        let tripData;
        try {
            const response = await fetch(`${API_BASE_URL}/plan-trip`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            tripData = await response.json();
        } catch (apiError) {
            console.warn('Backend not available, using mock data:', apiError);
            tripData = generateMockTripData(formData);
        }
        
        // Display results
        displayResults(tripData);
        
    } catch (error) {
        console.error('Error planning trip:', error);
        showError('Failed to plan trip. Please check your connection and try again.');
    } finally {
        hideLoading();
    }
}

// Collect form data
function collectFormData() {
    const stops = [];
    const stopInputs = document.querySelectorAll('.stop-input');
    
    stopInputs.forEach(stopInput => {
        const latInput = stopInput.querySelector('.stop-lat');
        const lngInput = stopInput.querySelector('.stop-lng');
        
        if (latInput.value && lngInput.value) {
            stops.push({
                lat: parseFloat(latInput.value),
                lng: parseFloat(lngInput.value)
            });
        }
    });
    
    return {
        source: {
            lat: parseFloat(sourceLatInput.value),
            lng: parseFloat(sourceLngInput.value)
        },
        destination: {
            lat: parseFloat(destLatInput.value),
            lng: parseFloat(destLngInput.value)
        },
        stops: stops,
        mealPreferences: mealPreferencesSelect.value,
        mealWindows: {
            lunch: {
                start: lunchStartInput.value,
                end: lunchEndInput.value
            },
            dinner: {
                start: dinnerStartInput.value,
                end: dinnerEndInput.value
            }
        },
        preferredArrivalTime: arrivalTimeInput.value || null
    };
}

// Validate form data
function validateFormData(data) {
    if (!data.source.lat || !data.source.lng) {
        showError('Please enter valid source coordinates');
        return false;
    }
    
    if (!data.destination.lat || !data.destination.lng) {
        showError('Please enter valid destination coordinates');
        return false;
    }
    
    if (!data.mealPreferences) {
        showError('Please select meal preferences');
        return false;
    }
    
    return true;
}

// Display results
function displayResults(tripData) {
    // Update overview cards
    departureTimeElement.textContent = tripData.estimatedDeparture;
    mealStopsCountElement.textContent = tripData.mealStops.length;
    routeLegsCountElement.textContent = tripData.route.legs.length;
    
    // Display route legs
    displayRouteLegs(tripData.route.legs);
    
    // Display meal stops
    displayMealStops(tripData.mealStops);
    
    // Show results section
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Display route legs
function displayRouteLegs(legs) {
    routeLegsElement.innerHTML = '';
    
    legs.forEach((leg, index) => {
        const legElement = document.createElement('div');
        legElement.className = 'route-leg';
        
        legElement.innerHTML = `
            <div class="route-leg-info">
                <div class="route-leg-route">${leg.from_place} → ${leg.to_place}</div>
                <div class="route-leg-duration">Duration: ${leg.duration}</div>
            </div>
            <div class="route-leg-number">${index + 1}</div>
        `;
        
        routeLegsElement.appendChild(legElement);
    });
}

// Display meal stops
function displayMealStops(mealStops) {
    mealStopsListElement.innerHTML = '';
    
    if (mealStops.length === 0) {
        mealStopsListElement.innerHTML = `
            <div style="text-align: center; color: #666; padding: 2rem;">
                <i class="fas fa-utensils" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No meal stops found for your selected time windows.</p>
            </div>
        `;
        return;
    }
    
    mealStops.forEach(mealStop => {
        const stopElement = document.createElement('div');
        stopElement.className = 'meal-stop-card';
        
        const stars = generateStars(mealStop.rating);
        
        stopElement.innerHTML = `
            <div class="meal-stop-name">${mealStop.name}</div>
            <div class="meal-stop-rating">
                <div class="stars">${stars}</div>
                <span>${mealStop.rating}/5</span>
            </div>
            <div class="meal-stop-eta">
                <i class="fas fa-clock"></i>
                ETA: ${mealStop.eta}
            </div>
            <div class="meal-stop-location">
                <i class="fas fa-map-marker-alt"></i>
                ${mealStop.location.lat.toFixed(4)}, ${mealStop.location.lng.toFixed(4)}
            </div>
        `;
        
        mealStopsListElement.appendChild(stopElement);
    });
}

// Generate star rating display
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    
    // Half star
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    
    return stars;
}

// Add stop input
function addStop() {
    const container = document.getElementById('stopsContainer');
    const stopInput = document.createElement('div');
    stopInput.className = 'stop-input';
    
    stopInput.innerHTML = `
        <input type="number" class="stop-lat" placeholder="Latitude" step="any">
        <input type="number" class="stop-lng" placeholder="Longitude" step="any">
        <button type="button" class="remove-stop" onclick="removeStop(this)">×</button>
    `;
    
    container.appendChild(stopInput);
}

// Remove stop input
function removeStop(button) {
    const stopInput = button.parentElement;
    stopInput.remove();
}

// Show loading spinner
function showLoading() {
    loadingSpinner.style.display = 'block';
    resultsSection.style.display = 'none';
}

// Hide loading spinner
function hideLoading() {
    loadingSpinner.style.display = 'none';
}

// Show error message
function showError(message) {
    // Create a simple alert for now - could be enhanced with a proper modal
    alert(message);
}

// Reset form
function resetForm() {
    tripForm.reset();
    setDefaultValues();
    
    // Clear stops
    const stopsContainer = document.getElementById('stopsContainer');
    stopsContainer.innerHTML = `
        <div class="stop-input">
            <input type="number" class="stop-lat" placeholder="Latitude" step="any">
            <input type="number" class="stop-lng" placeholder="Longitude" step="any">
            <button type="button" class="remove-stop" onclick="removeStop(this)">×</button>
        </div>
    `;
    
    // Hide results
    resultsSection.style.display = 'none';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Export trip data
function exportTrip() {
    // This would typically export the trip data to a file
    // For now, we'll just copy the data to clipboard
    const tripData = {
        departureTime: departureTimeElement.textContent,
        mealStops: Array.from(mealStopsListElement.children).map(card => ({
            name: card.querySelector('.meal-stop-name').textContent,
            rating: card.querySelector('.meal-stop-rating span').textContent,
            eta: card.querySelector('.meal-stop-eta').textContent.replace('ETA: ', ''),
            location: card.querySelector('.meal-stop-location').textContent
        })),
        routeLegs: Array.from(routeLegsElement.children).map(leg => ({
            route: leg.querySelector('.route-leg-route').textContent,
            duration: leg.querySelector('.route-leg-duration').textContent.replace('Duration: ', '')
        }))
    };
    
    navigator.clipboard.writeText(JSON.stringify(tripData, null, 2))
        .then(() => {
            alert('Trip data copied to clipboard!');
        })
        .catch(() => {
            alert('Failed to copy trip data. Please try again.');
        });
}

// Setup navigation
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Handle navigation
            const href = link.getAttribute('href');
            if (href === '#home') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (href === '#about') {
                // Scroll to about section or show about modal
                showAboutModal();
            }
        });
    });
}

// Show about modal (simple implementation)
function showAboutModal() {
    const aboutContent = `
        <div style="text-align: center; padding: 2rem; color: white;">
            <h2 style="margin-bottom: 1rem;">About Routivity</h2>
            <p style="margin-bottom: 1rem;">Routivity is a smart trip planning application that helps you plan your road trips with personalized meal stops based on your preferences and schedule.</p>
            <p style="margin-bottom: 1rem;">Features:</p>
            <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                <li>Smart route planning with waypoints</li>
                <li>Personalized meal stop recommendations</li>
                <li>Time-based meal scheduling</li>
                <li>Real-time route optimization</li>
            </ul>
        </div>
    `;
    
    // Create a simple modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 2rem;
        max-width: 500px;
        margin: 20px;
        position: relative;
    `;
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        color: white;
        font-size: 2rem;
        cursor: pointer;
    `;
    
    modalContent.innerHTML = aboutContent;
    modalContent.appendChild(closeButton);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close modal handlers
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// Utility function to format coordinates
function formatCoordinates(lat, lng) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// Utility function to format time
function formatTime(timeString) {
    if (!timeString) return 'Not specified';
    
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${displayHour}:${minutes} ${ampm}`;
}

// Check backend status
async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            showBackendStatus(true);
        } else {
            showBackendStatus(false);
        }
    } catch (error) {
        showBackendStatus(false);
    }
}

// Show backend status indicator
function showBackendStatus(isConnected) {
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'backend-status';
    statusIndicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        z-index: 1000;
        transition: all 0.3s ease;
    `;
    
    if (isConnected) {
        statusIndicator.style.background = '#10b981';
        statusIndicator.style.color = 'white';
        statusIndicator.innerHTML = '🟢 Backend Connected';
    } else {
        statusIndicator.style.background = '#f59e0b';
        statusIndicator.style.color = 'white';
        statusIndicator.innerHTML = '🟡 Demo Mode';
    }
    
    // Remove existing status indicator
    const existing = document.getElementById('backend-status');
    if (existing) {
        existing.remove();
    }
    
    document.body.appendChild(statusIndicator);
}

// Generate mock trip data when backend is not available
function generateMockTripData(formData) {
    const now = new Date();
    const departureTime = new Date(now.getTime() + 30 * 60000); // 30 minutes from now
    
    return {
        estimatedDeparture: departureTime.toTimeString().slice(0, 5),
        route: {
            polyline: "mock_polyline_data_for_demo",
            legs: [
                {
                    from_place: "Source Location",
                    to_place: "Waypoint 1",
                    duration: "2h 30m"
                },
                {
                    from_place: "Waypoint 1", 
                    to_place: "Destination Location",
                    duration: "3h 15m"
                }
            ]
        },
        mealStops: [
            {
                name: "Green Garden Restaurant",
                location: {
                    lat: formData.source.lat + 0.5,
                    lng: formData.source.lng + 0.3
                },
                rating: 4.5,
                eta: "13:30"
            },
            {
                name: "Sunset Bistro",
                location: {
                    lat: formData.destination.lat - 0.2,
                    lng: formData.destination.lng - 0.1
                },
                rating: 4.7,
                eta: "19:45"
            }
        ]
    };
}
