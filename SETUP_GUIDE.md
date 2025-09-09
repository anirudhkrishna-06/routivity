# Routivity Setup Guide

This guide will help you get both the frontend and backend running for the Routivity trip planning application.

## 🚀 Quick Start

### Option 1: Automatic Setup (Recommended)

1. **Start the Backend:**
   ```bash
   cd routivity/backend
   python start-backend.py
   ```

2. **Start the Frontend:**
   ```bash
   cd routivity/web-frontend
   python start-server.py
   ```

3. **Open your browser:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Option 2: Manual Setup

#### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd routivity/backend
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the server:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

#### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd routivity/web-frontend
   ```

2. **Start the server:**
   ```bash
   python start-server.py
   ```

## 🔧 Troubleshooting

### Backend Issues

#### "Connection Refused" Error
If you get connection errors when trying to plan a trip:

1. **Check if backend is running:**
   ```bash
   curl http://localhost:8000/health
   ```

2. **If not running, start it:**
   ```bash
   cd routivity/backend
   python start-backend.py
   ```

3. **Check for port conflicts:**
   - Make sure port 8000 is not being used by another application
   - Try a different port: `uvicorn main:app --reload --port 8001`

#### Dependencies Issues
If you get import errors:

1. **Reinstall dependencies:**
   ```bash
   cd routivity/backend
   pip install -r requirements.txt --force-reinstall
   ```

2. **Check Python version:**
   ```bash
   python --version
   ```
   (Requires Python 3.7+)

### Frontend Issues

#### "Failed to plan trip" Error
The frontend now includes fallback functionality:

- **If backend is running:** Uses real API data
- **If backend is not running:** Uses mock data for demonstration

#### Server Won't Start
If the frontend server won't start:

1. **Try a different port:**
   ```bash
   python -m http.server 3001
   ```

2. **Check if port 3000 is in use:**
   ```bash
   netstat -an | findstr :3000
   ```

## 📱 Using the Application

### 1. Plan a Trip
- Enter source and destination coordinates
- Add optional waypoints
- Select meal preferences
- Set meal time windows
- Click "Plan My Trip"

### 2. View Results
- See estimated departure time
- Review route details with travel times
- Check recommended meal stops
- Export trip data

### 3. Test Data
The form comes pre-filled with test coordinates:
- **Source:** New York (40.7128, -74.0060)
- **Destination:** Los Angeles (34.0522, -118.2437)
- **Meal Preferences:** Vegetarian

## 🌐 API Endpoints

When the backend is running, you can access:

- **Health Check:** `GET http://localhost:8000/health`
- **Plan Trip:** `POST http://localhost:8000/plan-trip`
- **API Docs:** `GET http://localhost:8000/docs`
- **ReDoc:** `GET http://localhost:8000/redoc`

## 🔍 Testing the Backend

You can test the backend directly:

```bash
cd routivity/backend
python test_api.py
```

## 📁 Project Structure

```
routivity/
├── backend/                 # FastAPI backend
│   ├── main.py             # Main application
│   ├── models.py           # Data models
│   ├── services/           # Business logic
│   │   ├── planner.py      # Trip planning
│   │   ├── places.py       # Restaurant discovery
│   │   └── routing.py      # Route calculation
│   ├── requirements.txt    # Dependencies
│   ├── start-backend.py    # Startup script
│   └── test_api.py         # API tests
├── web-frontend/           # Web frontend
│   ├── index.html          # Main page
│   ├── styles.css          # Styling
│   ├── script.js           # JavaScript
│   ├── start-server.py     # Startup script
│   └── README.md           # Frontend docs
└── screens/                # React Native screens
```

## 🆘 Getting Help

### Common Commands

**Start Backend:**
```bash
cd routivity/backend && python start-backend.py
```

**Start Frontend:**
```bash
cd routivity/web-frontend && python start-server.py
```

**Test Backend:**
```bash
cd routivity/backend && python test_api.py
```

**Check Backend Health:**
```bash
curl http://localhost:8000/health
```

### Error Messages

- **"Connection Refused":** Backend is not running
- **"Failed to plan trip":** Check backend connection or use mock data
- **"Port already in use":** Try a different port number
- **"Module not found":** Install dependencies with `pip install -r requirements.txt`

## 🎯 Next Steps

1. **Start both servers** using the commands above
2. **Open the frontend** at http://localhost:3000
3. **Test trip planning** with the pre-filled data
4. **Check the API docs** at http://localhost:8000/docs
5. **Customize** the application for your needs

The application now works in both modes:
- **Full functionality** when backend is running
- **Demo mode** with mock data when backend is not available


