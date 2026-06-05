export const openNavigation = (beach: any) => {
  const lat = beach.mapCoordinates?.lat ?? beach.latitude ?? beach.coordinates?.lat;
  const lon = beach.mapCoordinates?.lon ?? beach.longitude ?? beach.coordinates?.lon;
  
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.error("Coordinates not found for navigation");
    return;
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const url = isMobile 
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

  window.open(url, '_blank', 'noopener,noreferrer');
};
