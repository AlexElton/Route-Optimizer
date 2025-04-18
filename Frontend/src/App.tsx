import React, { useState, useEffect, useRef } from 'react';
import { Camera, Send, FileText, Map as MapIcon, Navigation, CheckCircle2, Trash2, RotateCcw } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';

interface DeliveryStop {
  id: string;
  address: string;
  completed: boolean;
  order: number;
}

interface OCRResult {
  stops: { delivery_number: number; address: string }[];
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
        });
        mapInstanceRef.current = map;

        const directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
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
        completed: false,
        order: index + 1,
      }));
      setStops(newStops);
    }
  }, [ocrResult]);
  

  const handleImageCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
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
  
      // Assuming result.stops is returned with delivery_number and address
      if (result.stops) {
        const newStops = result.stops.map((stop: any, index: number) => ({
          id: crypto.randomUUID(),
          address: stop.address,
          completed: false,
          order: index + 1,
        }));
        setOcrResult({ stops: result.stops });  // Ensure the OCR result is updated correctly
        setStops(newStops);
        setShowMap(true);
      }
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
    console.log('Calculating route...');
    //Log all elemtns before the if
    console.log('Stops:', stops);
    console.log('Map Instance:', mapInstanceRef.current);
    console.log('Directions Renderer:', directionsRendererRef.current);
    if (!stops.length || !mapInstanceRef.current || !directionsRendererRef.current) return;

    const activeStops = stops.filter(stop => !stop.completed);
    if (activeStops.length < 1) {
      alert('Need at least 1 active stop to calculate a route');
      return;
    }
    console.log('Active Stops:', activeStops);
  
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
          label: (index + 1).toString(),
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
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col gap-4">
      <header className="text-center py-4">
        <h1 className="text-2xl font-bold text-gray-800">Delivery Route Planner</h1>
      </header>

      <div className="flex justify-center gap-4 flex-wrap">
        {/* Take Photo */}
        <label className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-4 flex items-center gap-2 cursor-pointer touch-manipulation">
          <Camera size={24} />
          <span className="text-lg">Take Photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageCapture}
            className="hidden"
          />
        </label>

        {/* Choose File */}
        <label className="bg-gray-500 hover:bg-gray-600 text-white rounded-lg px-6 py-4 flex items-center gap-2 cursor-pointer touch-manipulation">
          <FileText size={24} />
          <span className="text-lg">Choose File</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageCapture}
            className="hidden"
          />
        </label>
      </div>



      {imagePreview && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Preview</h2>
          <div className="rounded-lg overflow-hidden shadow-lg">
            <img
              src={imagePreview}
              alt="Captured manifest"
              className="w-full h-auto"
            />
          </div>
        </div>
      )}

      {imagePreview && !isLoading && (
        <button
          onClick={handleSubmit}
          className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-6 py-4 flex items-center justify-center gap-2 touch-manipulation"
        >
          <Send size={24} />
          <span className="text-lg">Process Image</span>
        </button>
      )}

      {isLoading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Processing image...</p>
        </div>
      )}

      {locationError && (
        <div className="my-4 p-4 bg-yellow-100 text-yellow-800 rounded">
          <p>Couldn’t get your location: {locationError}</p>
          <label className="block mt-2">
            Enter your start address manually:
            <input
              type="text"
              className="mt-1 p-2 border rounded w-full"
              value={manualOrigin}
              onChange={e => setManualOrigin(e.target.value)}
              placeholder="123 Main St, City, State"
            />
          </label>
        </div>
      )}

      {stops.length > 0 && (
        <div className="mt-4 bg-white rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText size={24} className="text-gray-700" />
              <h2 className="text-xl font-semibold">Delivery Stops</h2>
            </div>
            <button
              onClick={resetStops}
              className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              <RotateCcw size={20} />
              <span>Reset All</span>
            </button>
          </div>
          <div className="space-y-2">
            {[...stops]
              .sort((a, b) => a.order - b.order)
              .map(stop => (
                <div
                  key={stop.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    stop.completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-full text-sm">
                      {stop.order}
                    </span>
                    <span className={stop.completed ? 'text-gray-500 line-through' : 'text-gray-700'}>
                      {stop.address}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleStopCompletion(stop.id)}
                      className={`p-2 rounded-full ${
                        stop.completed
                          ? 'text-green-500 hover:text-green-600'
                          : 'text-gray-400 hover:text-gray-500'
                      }`}
                    >
                      <CheckCircle2 size={20} />
                    </button>
                    <button
                      onClick={() => removeStop(stop.id)}
                      className="p-2 rounded-full text-red-500 hover:text-red-600"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {showMap && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapIcon size={24} className="text-gray-700" />
              <h2 className="text-xl font-semibold">Delivery Route</h2>
            </div>
            <button
              onClick={calculateRoute}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 flex items-center gap-2"
              disabled={!currentLocation && !manualOrigin}
            >
              <Navigation size={20} />
              <span>Optimize Route</span>
            </button>
          </div>
          <div
            ref={mapRef}
            className="w-full h-[400px] rounded-lg shadow-lg"
          />
          <button
            onClick={openInGoogleMaps}
            className="bg-gray-800 hover:bg-gray-900 text-white rounded-lg px-4 py-2 flex items-center gap-2"
          >
            <MapIcon size={20} />
            <span>Open in Google Maps</span>
          </button>
        </div>
        
      )}
    </div>
  );
}

export default App;
