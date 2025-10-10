import { useMemo, useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DateBasedEvent, TimeBasedEvent, LiveEvent, RoomMeeting, InteractiveRoom } from "@/lib/eventTypes";
import { getEventCoordinates } from "@/lib/geolocation";
import { createEventIdentifier } from "@/lib/nip19Utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TimezoneDisplay } from "./TimezoneDisplay";
import { isLiveEvent } from "@/lib/liveEventUtils";
import { cn } from "@/lib/utils";

// Fix for default marker icons in Leaflet with Webpack/Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-expect-error - Leaflet icon setup
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface MapViewProps {
  events: Array<DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom>;
  className?: string;
  onBoundsFilter?: (bounds: { north: number; south: number; east: number; west: number } | null) => void;
}

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface EventMarker {
  event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom;
  coordinates: { lat: number; lng: number };
}

// Component to fit map bounds to markers
function FitBounds({ markers, shouldFit }: { markers: EventMarker[]; shouldFit: boolean }) {
  const map = useMap();
  
  useMemo(() => {
    if (markers.length > 0 && shouldFit) {
      const bounds = L.latLngBounds(
        markers.map(m => [m.coordinates.lat, m.coordinates.lng])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [markers, map, shouldFit]);
  
  return null;
}

// Component to handle map movement and show search button
function MapBoundsHandler({ 
  onBoundsChange,
  isFiltering,
  onClearFilter
}: { 
  onBoundsChange: (bounds: MapBounds) => void;
  isFiltering: boolean;
  onClearFilter: () => void;
}) {
  const [hasMoved, setHasMoved] = useState(false);
  
  const map = useMapEvents({
    moveend: () => {
      setHasMoved(true);
    },
    zoomend: () => {
      setHasMoved(true);
    },
  });

  const handleSearchThisArea = () => {
    const bounds = map.getBounds();
    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
    setHasMoved(false);
  };

  // Custom control for the search button
  useEffect(() => {
    if (!map) return;

    const SearchControl = L.Control.extend({
      onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        container.style.background = 'white';
        container.style.padding = '0';
        container.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        container.style.borderRadius = '8px';
        
        // Prevent map interactions when clicking the button
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        const buttonId = 'map-search-button-container';
        container.id = buttonId;
        
        return container;
      }
    });

    const searchControl = new SearchControl({ position: 'topright' });
    searchControl.addTo(map);

    return () => {
      map.removeControl(searchControl);
    };
  }, [map]);

  // Render the button using React Portal
  useEffect(() => {
    const container = document.getElementById('map-search-button-container');
    if (!container) return;

    const root = document.createElement('div');
    container.appendChild(root);

    // Render button content
    if (isFiltering) {
      root.innerHTML = `
        <button 
          id="clear-area-filter-btn"
          style="
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
          "
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Clear area filter
        </button>
      `;
      
      const btn = document.getElementById('clear-area-filter-btn');
      if (btn) {
        btn.onclick = onClearFilter;
      }
    } else if (hasMoved) {
      root.innerHTML = `
        <button 
          id="search-area-btn"
          style="
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
          "
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          Search this area
        </button>
      `;
      
      const btn = document.getElementById('search-area-btn');
      if (btn) {
        btn.onclick = handleSearchThisArea;
      }
    }

    return () => {
      root.remove();
    };
  }, [hasMoved, isFiltering, onClearFilter]);

  return null;
}

export function MapView({ events, className, onBoundsFilter }: MapViewProps) {
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [shouldFitBounds, setShouldFitBounds] = useState(true);

  // Filter events that have valid coordinates
  const eventMarkers: EventMarker[] = useMemo(() => {
    let markers = events
      .map(event => {
        const coordinates = getEventCoordinates(event);
        return coordinates ? { event, coordinates } : null;
      })
      .filter((marker): marker is EventMarker => marker !== null);

    // If bounds filter is active, filter by bounds
    if (mapBounds) {
      markers = markers.filter(marker => {
        const { lat, lng } = marker.coordinates;
        return (
          lat <= mapBounds.north &&
          lat >= mapBounds.south &&
          lng <= mapBounds.east &&
          lng >= mapBounds.west
        );
      });
    }

    return markers;
  }, [events, mapBounds]);

  const handleBoundsChange = (bounds: MapBounds) => {
    setMapBounds(bounds);
    setShouldFitBounds(false);
    onBoundsFilter?.(bounds);
  };

  const handleClearFilter = () => {
    setMapBounds(null);
    setShouldFitBounds(true);
    onBoundsFilter?.(null);
  };

  // Count events with and without coordinates
  const eventsWithCoords = events.filter(e => getEventCoordinates(e) !== null).length;
  const eventsWithoutCoords = events.length - eventsWithCoords;

  // Default center (will be overridden by FitBounds if there are markers)
  const defaultCenter: [number, number] = [40.7128, -74.0060]; // New York City
  const defaultZoom = 10;

  if (eventMarkers.length === 0) {
    return (
      <Card className={cn("p-8 text-center", className)}>
        <div className="space-y-4">
          <div className="text-5xl">🗺️</div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">No Events with Locations</h3>
            <p className="text-muted-foreground">
              The events you're viewing don't have geographic coordinates.
              Add location data when creating events to see them on the map!
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("rounded-2xl overflow-hidden border-2 border-primary/10 shadow-lg", className)}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: "600px", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <FitBounds markers={eventMarkers} shouldFit={shouldFitBounds} />
        <MapBoundsHandler 
          onBoundsChange={handleBoundsChange}
          isFiltering={mapBounds !== null}
          onClearFilter={handleClearFilter}
        />
        
        {eventMarkers.map(({ event, coordinates }) => {
          const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
          const startTime = (event.kind === 30311 || event.kind === 30312 || event.kind === 30313)
            ? event.tags.find((tag) => tag[0] === "starts")?.[1]
            : event.tags.find((tag) => tag[0] === "start")?.[1];
          const location = event.tags.find((tag) => tag[0] === "location")?.[1];
          const eventIdentifier = createEventIdentifier(event);
          const live = isLiveEvent(event);

          return (
            <Marker
              key={event.id}
              position={[coordinates.lat, coordinates.lng]}
            >
              <Popup>
                <div className="min-w-[250px] p-2">
                  <Link 
                    to={`/event/${eventIdentifier}`}
                    className="block hover:opacity-80 transition-opacity"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <h3 className="font-semibold text-base leading-tight flex-1">
                          {title}
                        </h3>
                        {live && (
                          <Badge className="bg-red-500 text-white text-xs px-2 py-0.5">
                            LIVE
                          </Badge>
                        )}
                      </div>
                      
                      {startTime && (
                        <div className="text-sm text-muted-foreground">
                          <TimezoneDisplay 
                            event={event as DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom} 
                            showLocalTime={false}
                          />
                        </div>
                      )}
                      
                      {location && (
                        <div className="text-sm flex items-center gap-1 text-muted-foreground">
                          <span>📍</span>
                          <span className="line-clamp-1">{location}</span>
                        </div>
                      )}
                      
                      <div className="text-xs text-primary font-medium pt-1">
                        Click for details →
                      </div>
                    </div>
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      <div className="bg-muted/50 px-4 py-2 text-sm border-t">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            📍 Showing <strong className="text-foreground">{eventMarkers.length}</strong> event{eventMarkers.length !== 1 ? 's' : ''} {mapBounds ? 'in this area' : 'with location data'}
          </span>
          {eventsWithoutCoords > 0 && (
            <span className="text-xs text-muted-foreground">
              +{eventsWithoutCoords} event{eventsWithoutCoords !== 1 ? 's' : ''} without coordinates
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

