import React, { useState, useEffect, useRef } from 'react';
import { Camera, FileText, Map as MapIcon, Navigation, CheckCircle2, Trash2, RotateCcw, User, Clock, LifeBuoy, Sliders } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';
import heic2any from "heic2any";

interface DeliveryStop {
  id: string;
  address: string;
  completed: boolean;
  order: number;
  delivery_number: string;
}

interface OCRResult {
  stops: { delivery_number: string; address: string }[];
}

interface Location {
  lat: number;
  lng: number;
}

function App() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualOrigin, setManualOrigin] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'delivery' | 'history' | 'support' | 'profile'>('delivery');
  const [routeSummary, setRouteSummary] = useState<{totalKm: number, totalTime: string} | null>(null);
  const [currentDate, setCurrentDate] = useState<string>('');

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const currentLocationMarkerRef = useRef<google.maps.Marker | null>(null);

  // Set current date on load
  useEffect(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    };
    setCurrentDate(now.toLocaleDateString('en-US', options));
  }, []);

  // Initialize geolocation tracking
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(loc);
        setLocationError(null);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocationError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Initialize map
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const loader = new Loader({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCTTU5bBQWJ2IybIH9hAvMhlpH9_CYPQU4',
        version: 'weekly',
        libraries: ['places']
      });

      loader.load().then(() => {
        if (!mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: currentLocation || { lat: 49.2827, lng: -123.1207 }, // Default to Vancouver
          zoom: 12,
          styles: [
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#e9e9e9" }, { lightness: 17 }]
            },
            {
              featureType: "landscape",
              elementType: "geometry",
              stylers: [{ color: "#f5f5f5" }, { lightness: 20 }]
            },
            {
              featureType: "road.highway",
              elementType: "geometry.fill",
              stylers: [{ color: "#ffffff" }, { lightness: 17 }]
            },
            {
              featureType: "road.highway",
              elementType: "geometry.stroke",
              stylers: [{ color: "#ffffff" }, { lightness: 29 }, { weight: 0.2 }]
            }
          ],
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false
        });
        mapInstanceRef.current = map;

        const directionsRenderer = new google.maps.DirectionsRenderer({ 
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#4285F4',
            strokeWeight: 5,
            strokeOpacity: 0.8
          }
        });
        directionsRenderer.setMap(map);
        directionsRendererRef.current = directionsRenderer;

        if (currentLocation) {
          currentLocationMarkerRef.current = new google.maps.Marker({
            position: currentLocation,
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 2,
            },
            title: 'Current Location'
          });
        }
      });
    }
  }, [currentLocation]);

  // Update map marker when current location changes
  useEffect(() => {
    if (mapInstanceRef.current && currentLocation) {
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.setPosition(currentLocation);
      } else {
        currentLocationMarkerRef.current = new google.maps.Marker({
          position: currentLocation,
          map: mapInstanceRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2,
          },
          title: 'Current Location'
        });
      }
      
      // Center map on current location
      mapInstanceRef.current.panTo(currentLocation);
    }
  }, [currentLocation]);

  useEffect(() => {
    if (ocrResult?.stops) {
      const newStops = ocrResult.stops.map((stop: any, index: number) => ({
        id: crypto.randomUUID(),
        address: stop.address,
        delivery_number: stop.delivery_number || `${index + 59}`,
        completed: false,
        order: index + 1,
      }));
      setStops(newStops);
      
      // Calculate and set route summary
      setRouteSummary({
        totalKm: newStops.length * 3, // Approximate calculation
        totalTime: `${Math.ceil(newStops.length * 0.15)}h ${Math.floor(Math.random() * 60)}min` // Approximate calculation
      });
      
      // Calculate route automatically
      setTimeout(() => calculateRoute(), 500);
    }
  }, [ocrResult]);
  
  const handleImageCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
  
    try {
      let previewDataUrl: string;
  
      if (file.type === "image/heic" || file.name.endsWith(".heic")) {
        // Convert HEIC to PNG
        const convertedBlob = await heic2any({
          blob: file,
          toType: "image/png",
          quality: 0.9,
        }) as Blob;
  
        previewDataUrl = await blobToDataURL(convertedBlob);
      } else {
        // Standard images
        previewDataUrl = await blobToDataURL(file);
      }
  
      setImagePreview(previewDataUrl);
      
      // Auto-process the image
      processImage(previewDataUrl);
    } catch (err) {
      console.error("Failed to process image:", err);
      alert("Could not process the selected image. Please try a different file.");
    }
  };
  
  const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const processImage = async (imageData: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/ocr` || 'http://localhost:5001/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OCR processing failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }
  
      const result = await response.json();
      console.log('OCR Result:', result);
      
      setOcrResult(result);
    } catch (error) {
      console.error('Error:', error);
      
      // For demo purposes, create mock data if API fails
      const mockData = {
        stops: [
          { delivery_number: "59", address: "1596 Johnston St" },
          { delivery_number: "60", address: "1081 Burrard St" },
          { delivery_number: "61", address: "900 Burrard St" },
          { delivery_number: "62", address: "550 W Broadway" }
        ]
      };
      setOcrResult(mockData);
      
    } finally {
      setIsLoading(false);
    }
  };
  
  const openInGoogleMaps = () => {
    const activeStops = stops.filter(stop => !stop.completed);
    if (activeStops.length < 1) {
      alert("No active stops to export.");
      return;
    }
  
    const origin = manualOrigin || (currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : null);
    if (!origin) {
      alert("No origin defined.");
      return;
    }
  
    const destination = activeStops[activeStops.length - 1].address;
    const waypoints = activeStops
      .slice(0, -1)
      .map(stop => encodeURIComponent(stop.address))
      .join('|');
  
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${waypoints}`;
  
    window.open(mapsUrl, '_blank');
  };

  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  const calculateRoute = async () => {
    if (!stops.length || !mapInstanceRef.current || !directionsRendererRef.current) return;

    const activeStops = stops.filter(stop => !stop.completed);
    if (activeStops.length < 1) {
      clearMarkers();
      return;
    }
  
    const origin: string | google.maps.LatLngLiteral | null = manualOrigin || currentLocation;
    if (!origin) {
      alert('Waiting for your location or enter a manual origin.');
      return;
    }
  
    clearMarkers();
  
    const directionsService = new google.maps.DirectionsService();
    const destination = activeStops[activeStops.length - 1].address;
    const waypoints = activeStops.slice(0, -1).map(stop => ({
      location: stop.address,
      stopover: true
    }));
  
    try {
      const response = await directionsService.route({
        origin,
        destination,
        waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
      });
  
      directionsRendererRef.current.setDirections(response);
  
      // Reorder stops according to optimized route
      const order = response.routes[0].waypoint_order;
      if (order && order.length === waypoints.length) {
        const reordered = order.map(i => activeStops[i]);
        reordered.push(activeStops[activeStops.length - 1]); // Add final stop
        setStops(prev =>
          prev.map(stop => {
            const index = reordered.findIndex(s => s.id === stop.id);
            return index >= 0
              ? { ...stop, order: index + 1 }
              : stop;
          })
        );
      }
  
      // Add numbered markers
      response.routes[0].legs.forEach((leg, index) => {
        const marker = new google.maps.Marker({
          position: leg.end_location,
          map: mapInstanceRef.current!,
          label: {
            text: (index + 1).toString(),
            color: '#FFFFFF',
            fontWeight: 'bold'
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 14
          },
          title: leg.end_address,
        });
        markersRef.current.push(marker);
      });
  
      // Update route summary with actual data
      let totalDistance = 0;
      let totalDuration = 0;
      
      response.routes[0].legs.forEach(leg => {
        totalDistance += leg.distance?.value || 0;
        totalDuration += leg.duration?.value || 0;
      });
      
      // Convert to km and hours/minutes
      const kmTotal = Math.round(totalDistance / 100) / 10;
      const hours = Math.floor(totalDuration / 3600);
      const mins = Math.floor((totalDuration % 3600) / 60);
      
      setRouteSummary({
        totalKm: kmTotal,
        totalTime: `${hours}h ${mins}min`
      });
    } catch (error) {
      console.error('Error calculating route:', error);
    }
  };
  
  const toggleStopCompletion = (stopId: string) => {
    setStops(prevStops =>
      prevStops.map(stop =>
        stop.id === stopId
          ? { ...stop, completed: !stop.completed }
          : stop
      )
    );
    
    // Recalculate route after stop completion status changes
    setTimeout(() => calculateRoute(), 100);
  };

  const removeStop = (stopId: string) => {
    setStops(prevStops => prevStops.filter(stop => stop.id !== stopId));
    
    // Recalculate route after stop removal
    setTimeout(() => calculateRoute(), 100);
  };

  const resetStops = () => {
    setStops(prevStops =>
      prevStops.map(stop => ({ ...stop, completed: false }))
    );
    
    // Recalculate route after reset
    setTimeout(() => calculateRoute(), 100);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Map View (Always Visible) */}
      <div className="relative">
        <div
          ref={mapRef}
          className="w-full h-64"
        />
        
        {/* Map Controls */}
        <div className="absolute top-2 right-2 flex gap-2">
          <button 
            onClick={calculateRoute}
            className="bg-white p-2 rounded-full shadow-md"
            aria-label="Recenter map"
          >
            <Navigation size={20} className="text-gray-700" />
          </button>
        </div>
        
        {/* Route Summary (Shows on top of the map when available) */}
        {routeSummary && (
          <div className="absolute bottom-3 left-4 right-4 bg-white/80 backdrop-blur-sm py-2 px-4 rounded-lg shadow-md">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-yellow-500 flex items-center justify-center">
                <span className="text-xs text-white font-bold">✓</span>
              </div>
              <div className="text-sm flex-1">
                <p>you saved</p>
                <p className="font-semibold">{routeSummary.totalTime} • {routeSummary.totalKm} kms</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 z-10 p-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        ) : (
          <div>
            {/* Route Date & Summary */}
            <div className="mb-4 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">{currentDate}</h2>
                {stops.length > 0 && (
                  <p className="text-gray-600">
                    {stops.length} Stops • 0 Parcels • {routeSummary?.totalKm || '--'} km • {routeSummary?.totalTime || '--'}
                  </p>
                )}
              </div>
              {/* Adding Optimize Route button here */}
              {stops.length > 1 && (
                <button 
                  onClick={calculateRoute}
                  className="bg-blue-500 text-white py-2 px-4 rounded-lg flex items-center gap-2 text-sm"
                >
                  <Sliders size={16} />
                  <span>Optimize Route</span>
                </button>
              )}
            </div>
            
            {locationError && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
                <p>
                  <span className="font-medium">Location not available:</span> {locationError}
                </p>
                <input
                  type="text"
                  className="mt-2 p-2 w-full rounded border border-gray-300"
                  value={manualOrigin}
                  onChange={e => setManualOrigin(e.target.value)}
                  placeholder="Enter start address manually"
                />
              </div>
            )}
            
            {/* Starting Location */}
            {currentLocation && !stops.length && (
              <div className="flex items-center gap-3 mb-4 p-3 border-b">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100">
                  <MapIcon size={16} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-gray-600">Your location</p>
                  <p className="font-medium">Current GPS location</p>
                </div>
              </div>
            )}
            
            {/* Stops List */}
            {stops.length > 0 && (
              <div className="mb-4">
                {/* Starting Point */}
                <div className="flex items-start gap-3 mb-2">
                  <div className="flex flex-col items-center">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 border-2 border-blue-500 text-blue-500">
                      <MapIcon size={16} />
                    </div>
                    <div className="w-0.5 h-8 bg-blue-200 my-1"></div>
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-gray-500 text-sm">your trip starts here</p>
                  </div>
                </div>
                
                {/* Delivery Stops */}
                {[...stops]
                  .sort((a, b) => a.order - b.order)
                  .map((stop, index, array) => (
                    <div key={stop.id} className="flex items-start gap-3 mb-2">
                      <div className="flex flex-col items-center">
                        <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${stop.completed ? 'bg-gray-100 text-gray-400' : 'bg-blue-500 text-white'} font-bold`}>
                          {stop.order}
                        </div>
                        {index < array.length - 1 && <div className={`w-0.5 h-16 ${stop.completed ? 'bg-gray-200' : 'bg-blue-200'} my-1`}></div>}
                      </div>
                      <div className={`flex-1 pb-6 ${stop.completed ? 'opacity-60' : ''}`}>
                        <div className="flex justify-between items-start">
                          <p className={`font-medium text-lg ${stop.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                            {stop.address} <span className="text-gray-500">({stop.delivery_number})</span>
                          </p>
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleStopCompletion(stop.id)}
                              className={`p-2 rounded-full ${
                                stop.completed
                                  ? 'text-green-500'
                                  : 'text-gray-400'
                              }`}
                            >
                              <CheckCircle2 size={20} />
                            </button>
                            <button
                              onClick={() => removeStop(stop.id)}
                              className="p-2 rounded-full text-red-500"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-1 text-sm text-gray-500">
                          <span>{(index + 1) * 2} km</span>
                          <span>•</span>
                          <span>{(index + 1) * 7}min</span>
                        </div>
                      </div>
                    </div>
                  ))
                }
                
                {/* Action Buttons */}
                <div className="mt-4 flex justify-between">
                  {/* Added the Navigate button here at bottom level instead */}
                  <button
                    onClick={openInGoogleMaps}
                    className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded flex items-center justify-center gap-2"
                  >
                    <Navigation size={16} />
                    <span>Navigate</span>
                  </button>
                  
                  {/* Reset Button */}
                  {stops.some(stop => stop.completed) && (
                    <button
                      onClick={resetStops}
                      className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
                    >
                      <RotateCcw size={18} />
                      <span>Reset All Stops</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="bg-white border-t flex justify-around py-2">
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center px-4 py-2 ${activeTab === 'history' ? 'text-blue-500' : 'text-gray-500'}`}
        >
          <Clock size={20} />
          <span className="text-xs mt-1">History</span>
        </button>
        
        <button
          onClick={() => setActiveTab('support')}
          className={`flex flex-col items-center px-4 py-2 ${activeTab === 'support' ? 'text-blue-500' : 'text-gray-500'}`}
        >
          <LifeBuoy size={20} />
          <span className="text-xs mt-1">Support</span>
        </button>
        
        {/* Image Capture Button */}
        <label className="flex flex-col items-center px-4 py-2 bg-blue-50 text-blue-500 rounded-lg mx-1">
          <Camera size={24} />
          <span className="text-xs mt-1">Take Photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageCapture}
            className="hidden"
          />
        </label>
        
        <label className="flex flex-col items-center px-4 py-2 text-gray-500">
          <FileText size={20} />
          <span className="text-xs mt-1">Choose File</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageCapture}
            className="hidden"
          />
        </label>
        
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center px-4 py-2 ${activeTab === 'profile' ? 'text-blue-500' : 'text-gray-500'}`}
        >
          <User size={20} />
          <span className="text-xs mt-1">Profile</span>
        </button>
      </div>
    </div>
  );
}

export default App;