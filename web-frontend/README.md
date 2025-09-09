# Routivity Web Frontend

A modern web interface for the Routivity trip planning application.

## Features

- **Smart Trip Planning**: Plan road trips with waypoints and meal stops
- **Meal Preferences**: Support for various dietary preferences (vegetarian, vegan, halal, etc.)
- **Time-based Scheduling**: Schedule meal stops based on your preferred time windows
- **Real-time Route Optimization**: Get optimized routes with estimated travel times
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Modern UI/UX**: Clean, intuitive interface with smooth animations

## Quick Start

### Option 1: Simple HTTP Server (Recommended)

1. Navigate to the web-frontend directory:
   ```bash
   cd routivity/web-frontend
   ```

2. Start a simple HTTP server:
   
   **Python 3:**
   ```bash
   python -m http.server 3000
   ```
   
   **Python 2:**
   ```bash
   python -m SimpleHTTPServer 3000
   ```
   
   **Node.js (if you have it installed):**
   ```bash
   npx serve -s . -l 3000
   ```

3. Open your browser and go to: `http://localhost:3000`

### Option 2: Live Server (VS Code Extension)

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html` and select "Open with Live Server"

## Backend Setup

Make sure your Routivity backend is running:

1. Navigate to the backend directory:
   ```bash
   cd routivity/backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the backend server:
   ```bash
   python -m uvicorn main:app --reload
   ```

The backend will be available at `http://localhost:8000`

## Usage

1. **Enter Trip Details**:
   - Source coordinates (latitude and longitude)
   - Destination coordinates
   - Optional waypoints/stops
   - Meal preferences
   - Meal time windows (lunch and dinner)
   - Preferred arrival time (optional)

2. **Plan Your Trip**:
   - Click "Plan My Trip" button
   - Wait for the system to calculate your route and meal stops

3. **Review Results**:
   - View your departure time
   - See route details with travel times
   - Check recommended meal stops with ratings
   - Export your trip data

## API Integration

The frontend communicates with the backend API at `http://localhost:8000`:

- **POST /plan-trip**: Main trip planning endpoint
- **GET /health**: Health check endpoint
- **GET /**: Welcome message

## Default Test Values

The form comes pre-filled with test coordinates:
- **Source**: New York (40.7128, -74.0060)
- **Destination**: Los Angeles (34.0522, -118.2437)
- **Meal Preferences**: Vegetarian

## Features Overview

### Trip Planning Form
- Coordinate input with validation
- Dynamic waypoint addition/removal
- Meal preference selection
- Time window configuration
- Optional arrival time setting

### Results Display
- Trip overview with key metrics
- Detailed route breakdown
- Meal stop recommendations with ratings
- Export functionality
- Responsive design for all devices

### Error Handling
- Form validation
- API error handling
- Loading states
- User-friendly error messages

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Development

### File Structure
```
web-frontend/
├── index.html          # Main HTML file
├── styles.css          # CSS styles
├── script.js           # JavaScript functionality
└── README.md           # This file
```

### Customization

- **API URL**: Change `API_BASE_URL` in `script.js` to point to your backend
- **Styling**: Modify `styles.css` for custom colors, fonts, and layout
- **Functionality**: Extend `script.js` for additional features

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure your backend is running and accessible
2. **API Connection Failed**: Check if the backend server is running on port 8000
3. **Form Not Submitting**: Ensure all required fields are filled
4. **No Results**: Check browser console for error messages

### Debug Mode

Open browser developer tools (F12) to see:
- Network requests to the backend
- Console errors and warnings
- API response data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the Routivity application suite.
