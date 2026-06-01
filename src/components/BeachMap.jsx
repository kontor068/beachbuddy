import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // CRITICAL: This makes the map look right!
import L from 'leaflet';
import { mockBeaches } from '../data/mockBeaches';

// Fix for the "missing marker icon" bug in React/Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const BeachMap = () => {
  // Center the map around Greece/Peloponnese area
  const centerPosition = [35.3, 23.5]; 

  return (
    <div className="map-container" style={{ height: '500px', width: '100%', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <MapContainer 
        center={centerPosition} 
        zoom={7} 
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {mockBeaches.map((beach) => (
          <Marker key={beach.id} position={[beach.lat, beach.lng]}>
            <Popup>
              <div style={{ padding: '5px', minWidth: '150px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{beach.name}</h3>
                <p style={{ fontSize: '12px', margin: '0 0 8px 0' }}>{beach.description}</p>
                <hr />
                <div style={{ marginTop: '8px', fontSize: '12px' }}>
                  <div style={{ color: '#007bff' }}>🌡️ Water: {beach.waterTemp}°C</div>
                  <div style={{ color: '#dc3545' }}>💨 Wind: {beach.windSpeed} km/h</div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default BeachMap;
