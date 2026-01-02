import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, ImageOverlay } from 'react-leaflet';
import L from 'leaflet';
import { Lot } from '@/types';
import { convertLotsToGeoJSON } from '@/lib/convertToGeoJSON';
import { LayerSelector, MapLayer } from './LayerSelector';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LeafletMapProps {
  lots: Lot[];
  onLotClick?: (lot: Lot) => void;
  selectedLotId?: string | null;
}

export function LeafletMap({ lots, onLotClick, selectedLotId }: LeafletMapProps) {
  const [activeLayer, setActiveLayer] = useState<MapLayer>('custom');

  // Convert lots to GeoJSON
  const geoJSONData = useMemo(() => {
    return convertLotsToGeoJSON(lots);
  }, [lots]);

  // Style for lot polygons
  const lotStyle = (feature?: any) => {
    const isSelected = feature?.properties?.id === selectedLotId;
    
    return {
      fillColor: isSelected ? '#ef4444' : '#3b82f6',
      weight: isSelected ? 3 : 2,
      opacity: 1,
      color: 'white',
      fillOpacity: isSelected ? 0.6 : 0.3
    };
  };

  // Handle feature clicks
  const onEachFeature = (feature: any, layer: L.Layer) => {
    layer.on({
      click: () => {
        if (onLotClick) {
          // Find the original lot object
          const lot = lots.find(l => l.id === feature.properties.id);
          if (lot) {
            onLotClick(lot);
          }
        }
      },
      mouseover: (e: L.LeafletMouseEvent) => {
        const layer = e.target;
        layer.setStyle({
          fillOpacity: 0.7
        });
      },
      mouseout: (e: L.LeafletMouseEvent) => {
        const layer = e.target;
        layer.setStyle({
          fillOpacity: feature.properties.id === selectedLotId ? 0.6 : 0.3
        });
      }
    });

    // Bind popup with lot info
    const props = feature.properties;
    layer.bindPopup(`
      <div style="font-family: sans-serif;">
        <strong>Quadra ${props.quadra} - Lote ${props.lote}</strong><br/>
        ${props.area ? `Área: ${props.area}m²<br/>` : ''}
        ${props.status ? `Status: ${props.status}` : ''}
      </div>
    `);
  };

  return (
    <div className="relative w-full h-screen">
      {/* Leaflet Map */}
      <MapContainer
        center={[-23.9552584, -46.1952344]} // Centro aproximado de Acapulco
        zoom={16}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        {/* Tile/Image Layers - Custom, Satélite ou OSM */}
        {activeLayer === 'custom' ? (
          <ImageOverlay
            url="/map-background-hq.jpg"
            bounds={[
              [-23.963, -46.2001], // Southwest (SVG 0,747 → GPS)
              [-23.9402, -46.1886]  // Northeast (SVG 1024,0 → GPS)
            ]}
            opacity={1}
          />
        ) : activeLayer === 'satellite' ? (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; Esri'
            maxZoom={19}
          />
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />
        )}

        {/* Lotes GeoJSON */}
        <GeoJSON
          key={selectedLotId} // Force re-render on selection change
          data={geoJSONData as any}
          style={lotStyle}
          onEachFeature={onEachFeature}
        />
      </MapContainer>

      {/* Layer Selector */}
      <div className="absolute top-4 left-4 z-[1000]">
        <LayerSelector
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
        />
      </div>
    </div>
  );
}
