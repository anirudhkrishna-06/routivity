# Test script for the trip planning API
$body = @{
    source = @{ lat = 12.9716; lng = 77.5946 }
    destination = @{ lat = 13.0827; lng = 80.2707 }
    stops = @()
    mealPreferences = "veg"
    mealWindows = @{
        breakfast = @{ start = "08:00"; end = "09:00" }
        lunch = @{ start = "13:00"; end = "14:00" }
        dinner = @{ start = "19:00"; end = "20:00" }
    }
    preferredArrivalTime = "22:00"
} | ConvertTo-Json -Depth 10

Write-Host "Sending request to trip planning API..."
Write-Host "Request body:"
Write-Host $body
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/plan-trip" -Method POST -Body $body -ContentType "application/json"
    Write-Host "Response received successfully!"
    Write-Host "Full response:"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error occurred:"
    Write-Host $_.Exception.Message
}

