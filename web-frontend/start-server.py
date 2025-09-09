#!/usr/bin/env python3
"""
Simple HTTP server for serving the Routivity web frontend.
This script provides a convenient way to start a local development server.
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

def start_server(port=3000):
    """Start the HTTP server and open the browser."""
    
    # Change to the directory containing this script
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Check if index.html exists
    if not Path("index.html").exists():
        print("❌ Error: index.html not found in current directory")
        print("Make sure you're running this script from the web-frontend directory")
        sys.exit(1)
    
    # Create the server
    handler = http.server.SimpleHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", port), handler) as httpd:
            print(f"🚀 Routivity Web Frontend Server")
            print(f"📁 Serving from: {script_dir}")
            print(f"🌐 Server running at: http://localhost:{port}")
            print(f"📱 Open your browser to: http://localhost:{port}")
            print(f"⏹️  Press Ctrl+C to stop the server")
            print("-" * 50)
            
            # Try to open the browser automatically
            try:
                webbrowser.open(f"http://localhost:{port}")
                print("🔗 Browser opened automatically")
            except Exception as e:
                print(f"⚠️  Could not open browser automatically: {e}")
                print(f"   Please manually open: http://localhost:{port}")
            
            print("-" * 50)
            
            # Start serving
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ Error: Port {port} is already in use")
            print(f"   Try a different port or stop the process using port {port}")
        else:
            print(f"❌ Error starting server: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Allow custom port via command line argument
    port = 3000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("❌ Error: Port must be a number")
            print("Usage: python start-server.py [port]")
            sys.exit(1)
    
    start_server(port)
