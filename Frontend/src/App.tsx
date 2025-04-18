import React, { useState, useEffect, useRef } from 'react';
import { Camera, Send, FileText, Map as MapIcon, Navigation, CheckCircle2, Trash2, RotateCcw } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';
import heic2any from "heic2any";

interface DeliveryStop {
  id: string;
  address: string;
  completed: boolean;
  order: number;
  delivery_number: string; // Added delivery number field
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
  const [showMap, setShowMap] = useState(false);
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualOrigin, setManualOrigin] = useState<string>('');

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const currentLocationMarkerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (showMap) {
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
    }
  }, [showMap]);

  useEffect(() => {
    if (showMap && mapRef.current && !mapInstanceRef.current) {
      const loader = new Loader({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCTTU5bBQWJ2IybIH9hAvMhlpH9_CYPQU4',
        version: 'weekly',
        libraries: ['places']
      });

      loader.load().then(() => {
        if (!mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: currentLocation || { lat: 40.7128, lng: -74.0060 },
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
          ]
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
  }, [showMap, currentLocation]);

  useEffect(() => {
    if (ocrResult?.stops) {
      const newStops = ocrResult.stops.map((stop: any, index: number) => ({
        id: crypto.randomUUID(),
        address: stop.address,
        delivery_number: stop.delivery_number || `${index + 59}`, // Default using incremented numbers if not provided
        completed: false,
        order: index + 1,
      }));
      setStops(newStops);
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

  const handleSubmit = async () => {
    if (!imagePreview) return;
  
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/ocr` || 'http://localhost:5001/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ image: imagePreview }),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OCR processing failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }
  
      const result = await response.json();
      console.log('OCR Result:', result);
      
      setOcrResult(result);
      setShowMap(true);
    } catch (error) {
      console.error('Error:', error);
      alert(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      alert('Need at least 1 active stop to calculate a route');
      return;
    }
  
    const origin: string | google.maps.LatLngLiteral | null = manualOrigin || currentLocation;
    if (!origin) {
      alert('Waiting for your current location or enter a manual origin.');
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
      const newOrderedStops = [...activeStops];
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
  
      // Optional: marker for origin
      if (typeof origin !== 'string') {
        const originMarker = new google.maps.Marker({
          position: origin,
          map: mapInstanceRef.current!,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#34D399',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2,
          },
          title: 'Origin',
        });
        markersRef.current.push(originMarker);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      alert('Failed to calculate route. Please check the addresses and try again.');
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
    calculateRoute();
  };

  const removeStop = (stopId: string) => {
    setStops(prevStops => prevStops.filter(stop => stop.id !== stopId));
    calculateRoute();
  };

  const resetStops = () => {
    setStops(prevStops =>
      prevStops.map(stop => ({ ...stop, completed: false }))
    );
    calculateRoute();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-gray-800 text-white py-6 px-4 text-center shadow-md">
        <h1 className="text-3xl font-bold">Delivery Route Planner</h1>
      </header>

      <div className="p-4 flex-1 flex flex-col gap-6">
        <div className="flex justify-center gap-4 flex-wrap">
          {/* Take Photo */}
          <label className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-8 py-4 flex items-center gap-3 cursor-pointer touch-manipulation shadow-md transition duration-200 ease-in-out transform hover:-translate-y-1">
            <Camera size={24} />
            <span className="text-lg font-medium">Take Photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageCapture}
              className="hidden"
            />
          </label>

          {/* Choose File */}
          <label className="bg-gray-600 hover:bg-gray-700 text-white rounded-xl px-8 py-4 flex items-center gap-3 cursor-pointer touch-manipulation shadow-md transition duration-200 ease-in-out transform hover:-translate-y-1">
            <FileText size={24} />
            <span className="text-lg font-medium">Choose File</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageCapture}
              className="hidden"
            />
          </label>
        </div>

        {imagePreview && (
          <div className="mt-2 bg-white rounded-xl overflow-hidden shadow-lg">
            <h2 className="text-xl font-semibold p-4 bg-gray-50 border-b">Image Preview</h2>
            <div className="p-4">
              <img
                src={imagePreview}
                alt="Captured manifest"
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        )}

        {imagePreview && !isLoading && (
          <button
            onClick={handleSubmit}
            className="bg-green-500 hover:bg-green-600 text-white rounded-xl px-8 py-4 flex items-center justify-center gap-3 touch-manipulation shadow-md transition duration-200 ease-in-out transform hover:-translate-y-1 mx-auto"
          >
            <Send size={24} />
            <span className="text-lg font-medium">Process Image</span>
          </button>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Processing image...</p>
          </div>
        )}

        {locationError && (
          <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl shadow">
            <p className="font-medium">Couldn't get your location: {locationError}</p>
            <label className="block mt-3">
              <span className="text-gray-700">Enter your start address manually:</span>
              <input
                type="text"
                className="mt-1 p-3 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                value={manualOrigin}
                onChange={e => setManualOrigin(e.target.value)}
                placeholder="123 Main St, City, State"
              />
            </label>
          </div>
        )}

        {stops.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={24} className="text-gray-700" />
                <h2 className="text-xl font-bold">Delivery Stops</h2>
              </div>
              <button
                onClick={resetStops}
                className="text-blue-500 hover:text-blue-600 flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <RotateCcw size={18} />
                <span className="font-medium">Reset All</span>
              </button>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {[...stops]
                  .sort((a, b) => a.order - b.order)
                  .map(stop => (
                    <div
                      key={stop.id}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        stop.completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                      } shadow-sm`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-full text-lg font-bold">
                          {stop.order}
                        </span>
                        <span className={stop.completed ? 'text-gray-500 line-through' : 'text-gray-700 font-medium'}>
                          {stop.address} <span className="text-gray-500">({stop.delivery_number})</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleStopCompletion(stop.id)}
                          className={`p-2 rounded-full ${
                            stop.completed
                              ? 'text-green-500 bg-green-50 hover:bg-green-100'
                              : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                          } transition-colors`}
                          aria-label={stop.completed ? "Mark as incomplete" : "Mark as complete"}
                        >
                          <CheckCircle2 size={22} />
                        </button>
                        <button
                          onClick={() => removeStop(stop.id)}
                          className="p-2 rounded-full text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                          aria-label="Remove stop"
                        >
                          <Trash2 size={22} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {showMap && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapIcon size={24} className="text-gray-700" />
                <h2 className="text-xl font-bold">Delivery Route</h2>
              </div>
              <button
                onClick={calculateRoute}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 flex items-center gap-2 shadow transition-colors"
                disabled={!currentLocation && !manualOrigin}
              >
                <Navigation size={20} />
                <span className="font-medium">Optimize Route</span>
              </button>
            </div>
            <div
              ref={mapRef}
              className="w-full h-96 rounded-lg"
            />
            <div className="p-4 border-t">
              <button
                onClick={openInGoogleMaps}
                className="w-full bg-gray-800 hover:bg-gray-900 text-white rounded-lg px-4 py-3 flex items-center justify-center gap-3 shadow transition-colors"
              >
                <MapIcon size={22} />
                <span className="font-medium">Open in Google Maps</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;