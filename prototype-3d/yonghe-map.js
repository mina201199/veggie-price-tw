(function () {
  'use strict';
  const data = window.YonghePlaces;
  const $ = id => document.getElementById(id);
  const venues = data.venues;
  let kind = 'all', selectedId = null;
  const markers = new Map();
  const counts = { all: venues.length, market: venues.filter(v => v.kind === 'market').length, supermarket: venues.filter(v => v.kind === 'supermarket').length };
  $('allCount').textContent = counts.all;
  $('marketCount').textContent = $('marketFilterCount').textContent = counts.market;
  $('supermarketCount').textContent = $('supermarketFilterCount').textContent = counts.supermarket;
  $('coverage').textContent = data.coverage;
  $('checkedDate').textContent = '資料核對：' + data.checkedDate;
  const map = L.map('map', { zoomControl: false, scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false }).setView([25.011, 121.519], 16);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' }).addTo(map);
  let tileErrors = 0, tileSuccesses = 0;
  tiles.on('loading', () => { tileErrors = 0; tileSuccesses = 0; });
  tiles.on('tileerror', () => { tileErrors++; });
  tiles.on('tileload', () => { tileSuccesses++; $('tileStatus').hidden = true; });
  tiles.on('load', () => { $('tileStatus').hidden = !(tileErrors > 0 && tileSuccesses === 0); });
  $('retryTiles').addEventListener('click', () => { $('tileStatus').hidden = true; tiles.redraw(); });
  function matchingVenues() {
    const q = $('search').value.trim().normalize('NFKC').toLocaleLowerCase();
    return venues.filter(v => (kind === 'all' || v.kind === kind) && (v.name + v.address).normalize('NFKC').toLocaleLowerCase().includes(q));
  }
  function clearSelection() {
    selectedId = null;
    $('placeDetail').hidden = true;
    document.querySelectorAll('.venue-card').forEach(card => card.setAttribute('aria-pressed', 'false'));
    markers.forEach(marker => marker.getElement()?.classList.remove('is-selected'));
  }
  function selectVenue(venue) {
    selectedId = venue.id;
    $('detailKind').textContent = venue.kind === 'market' ? '公有市場' : '超市 · 全聯';
    $('detailName').textContent = venue.name;
    $('explore3d').href = 'index.html?venue=' + encodeURIComponent(venue.id);
    $('detailAddress').textContent = venue.address;
    $('detailHours').textContent = '來源記載時間：' + venue.hours;
    $('directions').href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(venue.lat + ',' + venue.lng) + '&travelmode=walking';
    $('officialSource').textContent = venue.sourceName + ' ↗';
    $('officialSource').href = venue.sourceUrl;
    $('coordinateSource').href = venue.coordinateSource;
    $('placeDetail').hidden = false;
    document.querySelectorAll('.venue-card').forEach(card => card.setAttribute('aria-pressed', String(card.dataset.venue === selectedId)));
    markers.forEach((marker, id) => marker.getElement()?.classList.toggle('is-selected', id === selectedId));
    map.setView([venue.lat, venue.lng], Math.max(map.getZoom(), 16));
    if (matchMedia('(max-width: 800px)').matches) $('placeDetail').scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  function render() {
    clearSelection();
    markers.forEach(marker => map.removeLayer(marker));
    markers.clear();
    const visible = matchingVenues();
    $('placesList').replaceChildren();
    $('visibleCount').textContent = visible.length + ' 個地點';
    $('emptyState').hidden = visible.length > 0;
    visible.forEach(venue => {
      const type = venue.kind === 'market' ? '市場' : '超市';
      const icon = L.divIcon({ className: 'venue-marker', html: '<div class="pin ' + venue.kind + '"><span>' + (venue.kind === 'market' ? '市' : '買') + '</span></div>', iconSize: [35, 35], iconAnchor: [17, 32] });
      const marker = L.marker([venue.lat, venue.lng], { icon, title: venue.name, alt: venue.name, keyboard: true }).addTo(map);
      const tooltip = document.createElement('span'); tooltip.textContent = venue.name;
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -25] });
      marker.on('click', () => selectVenue(venue));
      markers.set(venue.id, marker);
      const card = document.createElement('button'); card.type = 'button'; card.className = 'venue-card'; card.dataset.venue = venue.id; card.setAttribute('aria-pressed', 'false');
      const badge = document.createElement('span'); badge.className = 'card-icon ' + venue.kind; badge.textContent = venue.kind === 'market' ? '市' : '買'; badge.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span'); text.className = 'card-text';
      const name = document.createElement('b'); name.textContent = venue.name;
      const address = document.createElement('small'); address.textContent = venue.address;
      text.append(name, address);
      const arrow = document.createElement('span'); arrow.className = 'card-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
      card.setAttribute('aria-label', type + '：' + venue.name + '，' + venue.address);
      card.append(badge, text, arrow); card.addEventListener('click', () => selectVenue(venue));
      $('placesList').append(card);
    });
  }
  document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
    kind = button.dataset.kind;
    document.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    render();
  }));
  $('search').addEventListener('input', render);
  $('closeDetail').addEventListener('click', clearSelection);
  $('showAll').addEventListener('click', () => {
    const visible = matchingVenues();
    if (visible.length) map.fitBounds(visible.map(v => [v.lat, v.lng]), { padding: [55, 70], maxZoom: 16 });
  });
  render();
})();
