import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  ZoomIn,
  ZoomOut,
  MapPin,
  Plus,
  Crosshair,
  Server,
  Layers,
  Ruler,
  RotateCcw,
  X,
} from 'lucide-react';
import { Customer, FiberCable, FiberClosure, NapBox, OltPopNode } from '../../types';
import {
  getGoogleMapsApiKey,
  getGoogleTileUrl,
  loadGoogleMapsScript,
} from '../../services/googleMapsService';
import {
  calculateSpanMetrics,
  calculateHaversineDistance,
  findNearestNaps,
  SpanMetrics,
} from '../../utils/geoDistance';
import {
  buildPonCascadeChain,
  calculateCascadeTelemetry,
  CascadeHopTelemetry,
} from '../../utils/opticalBudget';

export type RealMapTileStyle =
  | 'google_hybrid'
  | 'google_streets'
  | 'google_satellite'
  | 'google_terrain'
  | 'satellite'
  | 'dark_grid'
  | 'streets';

interface RealLeafletMapProps {
  oltNode?: OltPopNode;
  oltNodes?: OltPopNode[];
  napBoxes: NapBox[];
  fiberCables: FiberCable[];
  fiberClosures: FiberClosure[];
  customers: Customer[];
  selectedAsset: {
    type: 'olt' | 'nap' | 'cable' | 'closure' | 'customer';
    data: any;
  } | null;
  onSelectAsset: (asset: { type: 'olt' | 'nap' | 'cable' | 'closure' | 'customer'; data: any } | null) => void;
  onSelectCustomer?: (customerId: string) => void;
  onDeployNapAtLocation?: (coords: { lat: number; lng: number }) => void;
  onRegisterOltAtLocation?: (coords: { lat: number; lng: number }) => void;
  activeOtdrBreak: {
    point: { lat: number; lng: number };
    cable: FiberCable;
    distance: number;
    affectedNaps: NapBox[];
    affectedCustomers: Customer[];
  } | null;
  mapTileStyle: RealMapTileStyle;
  googleMapsApiKey?: string;
  showOlt: boolean;
  showFeeder: boolean;
  showDistribution: boolean;
  showNaps: boolean;
  showClosures: boolean;
  showDropLines: boolean;
  showCoverageRings: boolean;
  showSpanDistances?: 'all' | 'olt' | 'inter_nap' | 'none';
}

export const RealLeafletMap: React.FC<RealLeafletMapProps> = ({
  oltNode,
  oltNodes = [],
  napBoxes,
  fiberCables,
  fiberClosures,
  customers,
  selectedAsset,
  onSelectAsset,
  onSelectCustomer,
  onDeployNapAtLocation,
  onRegisterOltAtLocation,
  activeOtdrBreak,
  mapTileStyle,
  googleMapsApiKey,
  showOlt,
  showFeeder,
  showDistribution,
  showNaps,
  showClosures,
  showDropLines,
  showCoverageRings,
  showSpanDistances = 'all',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerGroupRef = useRef<any>(null);
  const layersGroupRef = useRef<any>(null);
  const otdrLayerRef = useRef<any>(null);

  const effectiveApiKey = googleMapsApiKey || getGoogleMapsApiKey();

  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(14);
  const [isLeafletReady, setIsLeafletReady] = useState<boolean>(false);

  // Interactive GIS Distance Ruler state
  const rulerLayerRef = useRef<any>(null);
  const [isRulerActive, setIsRulerActive] = useState<boolean>(false);
  const [rulerPoints, setRulerPoints] = useState<Array<{ lat: number; lng: number; name?: string }>>([]);

  const isRulerActiveRef = useRef<boolean>(false);
  isRulerActiveRef.current = isRulerActive;
  const rulerPointsRef = useRef<Array<{ lat: number; lng: number; name?: string }>>([]);
  rulerPointsRef.current = rulerPoints;

  const handleRulerSelectPoint = (point: { lat: number; lng: number; name?: string }) => {
    if (rulerPointsRef.current.length >= 2) {
      setRulerPoints([point]);
    } else {
      setRulerPoints((prev) => [...prev, point]);
    }
  };

  const rulerMetrics: SpanMetrics | null =
    rulerPoints.length >= 2
      ? calculateSpanMetrics(
          rulerPoints[0].lat,
          rulerPoints[0].lng,
          rulerPoints[1].lat,
          rulerPoints[1].lng
        )
      : null;

  const effectiveOltNodes = oltNodes && oltNodes.length > 0 ? oltNodes : (oltNode ? [oltNode] : []);
  const primaryOlt = effectiveOltNodes[0] || oltNode;

  // Initialize Google Maps JavaScript API script if key is available
  useEffect(() => {
    if (effectiveApiKey) {
      loadGoogleMapsScript(effectiveApiKey);
    }
  }, [effectiveApiKey]);

  // Check if Leaflet is loaded from window
  useEffect(() => {
    const checkLeaflet = () => {
      if (typeof window !== 'undefined' && (window as any).L) {
        setIsLeafletReady(true);
      } else {
        setTimeout(checkLeaflet, 100);
      }
    };
    checkLeaflet();
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!isLeafletReady || !mapContainerRef.current || mapInstanceRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Center on Primary Headend or default center
    const initialLat = primaryOlt?.latitude || 13.6870;
    const initialLng = primaryOlt?.longitude || 123.5210;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false, // We render custom high-tech zoom controls
      attributionControl: false,
    });

    // Create container groups
    tileLayerGroupRef.current = L.layerGroup().addTo(map);
    layersGroupRef.current = L.layerGroup().addTo(map);
    otdrLayerRef.current = L.layerGroup().addTo(map);
    rulerLayerRef.current = L.layerGroup().addTo(map);

    // Zoom change listener
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    // Click on map listener to pick GPS coordinates or measure with Ruler
    map.on('click', (e: any) => {
      const coords = {
        lat: Number(e.latlng.lat.toFixed(5)),
        lng: Number(e.latlng.lng.toFixed(5)),
      };
      if (isRulerActiveRef.current) {
        handleRulerSelectPoint({
          ...coords,
          name: `Map Point (${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°)`,
        });
        return;
      }
      setClickedLocation(coords);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [isLeafletReady]);

  // Invalidate map size when drawer toggles
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [selectedAsset]);

  // Update Base Map Tiles when mapTileStyle changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerGroupRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    tileLayerGroupRef.current.clearLayers();

    if (mapTileStyle === 'google_hybrid') {
      // Google Hybrid: High-resolution satellite imagery + road names, highway numbers, municipality labels
      const googleHybrid = L.tileLayer(getGoogleTileUrl('hybrid', effectiveApiKey), {
        maxZoom: 21,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps',
      });
      tileLayerGroupRef.current.addLayer(googleHybrid);
    } else if (mapTileStyle === 'google_streets') {
      // Google Roadmap / Street Navigation View
      const googleStreets = L.tileLayer(getGoogleTileUrl('roadmap', effectiveApiKey), {
        maxZoom: 21,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps',
      });
      tileLayerGroupRef.current.addLayer(googleStreets);
    } else if (mapTileStyle === 'google_satellite') {
      // Google Pure Satellite (without labels)
      const googleSat = L.tileLayer(getGoogleTileUrl('satellite', effectiveApiKey), {
        maxZoom: 21,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps',
      });
      tileLayerGroupRef.current.addLayer(googleSat);
    } else if (mapTileStyle === 'google_terrain') {
      // Google Terrain: Shaded relief elevation and contour
      const googleTerrain = L.tileLayer(getGoogleTileUrl('terrain', effectiveApiKey), {
        maxZoom: 21,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps',
      });
      tileLayerGroupRef.current.addLayer(googleTerrain);
    } else if (mapTileStyle === 'satellite') {
      // High-resolution Esri World Imagery + CartoDB Road Labels
      const esriSatellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          subdomains: ['server', 'services'],
        }
      );
      const labelsLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd',
          opacity: 0.9,
        }
      );
      tileLayerGroupRef.current.addLayer(esriSatellite);
      tileLayerGroupRef.current.addLayer(labelsLayer);
    } else if (mapTileStyle === 'dark_grid') {
      // CartoDB Dark Matter (Cyber NOC High-Contrast Dark Map)
      const darkMatter = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd',
        }
      );
      tileLayerGroupRef.current.addLayer(darkMatter);
    } else {
      // CartoDB Voyager / Street Navigation Map
      const voyager = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd',
        }
      );
      tileLayerGroupRef.current.addLayer(voyager);
    }
  }, [mapTileStyle, effectiveApiKey, isLeafletReady]);

  // Render Outside Plant Layers (OLT, Cables, Closures, NAPs, Drops, Coverage Rings)
  useEffect(() => {
    if (!mapInstanceRef.current || !layersGroupRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    layersGroupRef.current.clearLayers();

    // 1. Coverage Radii Rings (350m FTTH boundary around each NAP)
    if (showCoverageRings) {
      napBoxes.forEach((nap) => {
        if (typeof nap.latitude !== 'number' || typeof nap.longitude !== 'number') return;
        const circle = L.circle([nap.latitude, nap.longitude], {
          radius: 350,
          color: '#06b6d4',
          fillColor: '#06b6d4',
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: '5, 5',
          interactive: false,
        });
        layersGroupRef.current.addLayer(circle);
      });
    }

    // 2. Subscriber Drop Lines
    if (showDropLines) {
      customers.forEach((cust) => {
        const custCoords = cust.address?.coordinates;
        if (!custCoords || !cust.network?.napBoxId) return;
        const nap = napBoxes.find((b) => b.id === cust.network.napBoxId);
        if (!nap) return;

        const napPort = nap.ports?.find((p) => p.customerId === cust.id);
        const signal = napPort?.signalDbm ?? -18.5;
        const strokeColor = signal < -26 ? '#f43f5e' : signal < -22 ? '#f59e0b' : '#10b981';

        // Drop polyline
        const dropLine = L.polyline(
          [
            [nap.latitude, nap.longitude],
            [custCoords.lat, custCoords.lng],
          ],
          {
            color: strokeColor,
            weight: 1.8,
            dashArray: '4, 4',
            opacity: 0.85,
          }
        );

        dropLine.on('click', () => {
          onSelectAsset({
            type: 'customer',
            data: { ...cust, signalDbm: signal, napCode: nap.code },
          });
          if (onSelectCustomer) onSelectCustomer(cust.id);
        });

        const dropMeters = calculateHaversineDistance(
          nap.latitude,
          nap.longitude,
          custCoords.lat,
          custCoords.lng
        );
        const isLongDrop = dropMeters > 150;

        dropLine.bindTooltip(
          `<strong>${cust.fullName}</strong> (${cust.accountNo})<br/>` +
          `Drop Wire Span: <strong style="color:${isLongDrop ? '#fb7185' : '#38bdf8'};">${dropMeters} m</strong>${isLongDrop ? ' ⚠️ (>150m Limit)' : ''}<br/>` +
          `Rx Optical Signal: <span style="color:${strokeColor};font-weight:bold;">${signal} dBm</span><br/>` +
          `Connected to: <strong>${nap.code} (Port #${napPort?.portNumber || '?'})</strong>`,
          { direction: 'top', className: 'gis-custom-tooltip' }
        );

        layersGroupRef.current.addLayer(dropLine);

        // Micro-badge on drop wire when subscriber or its NAP is selected
        const isCustSelected =
          (selectedAsset?.type === 'customer' && selectedAsset.data.id === cust.id) ||
          (selectedAsset?.type === 'nap' && selectedAsset.data.id === nap.id);

        if (isCustSelected && dropMeters > 0) {
          const midDropLat = (nap.latitude + custCoords.lat) / 2;
          const midDropLng = (nap.longitude + custCoords.lng) / 2;
          const dropBadge = L.divIcon({
            className: 'drop-dist-badge',
            html: `
              <div style="
                background: rgba(15, 23, 42, 0.95);
                border: 1px solid ${isLongDrop ? '#f43f5e' : '#10b981'};
                border-radius: 9999px;
                padding: 1px 5px;
                font-family: monospace;
                font-size: 8px;
                font-weight: bold;
                color: ${isLongDrop ? '#fb7185' : '#34d399'};
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(0,0,0,0.8);
                transform: translate(-50%, -50%);
              ">
                ${dropMeters}m
              </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          const dropMarker = L.marker([midDropLat, midDropLng], { icon: dropBadge, interactive: false });
          layersGroupRef.current.addLayer(dropMarker);
        }

        // Customer Home Endpoint Icon
        const custIcon = L.divIcon({
          className: 'custom-leaflet-pin',
          html: `
            <div style="
              width: 10px;
              height: 10px;
              border-radius: 9999px;
              background-color: ${strokeColor};
              border: 2px solid #0f172a;
              box-shadow: 0 0 8px ${strokeColor};
              cursor: pointer;
            "></div>
          `,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });

        const custMarker = L.marker([custCoords.lat, custCoords.lng], {
          icon: custIcon,
        });

        custMarker.on('click', (e: any) => {
          if (isRulerActiveRef.current) {
            L.DomEvent.stopPropagation(e);
            handleRulerSelectPoint({
              lat: custCoords.lat,
              lng: custCoords.lng,
              name: `${cust.fullName} (${cust.accountNo})`,
            });
            return;
          }
          onSelectAsset({
            type: 'customer',
            data: { ...cust, signalDbm: signal, napCode: nap.code },
          });
          if (onSelectCustomer) onSelectCustomer(cust.id);
        });

        layersGroupRef.current.addLayer(custMarker);
      });
    }

    // 3. Real-Time Cascaded Daisy-Chain (Feeder + Inter-NAP Hops) with FBT/PLC Telemetry
    if (showSpanDistances !== 'none') {
      const ponColors = ['#06b6d4', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#3b82f6'];

      effectiveOltNodes.forEach((olt) => {
        if (typeof olt.latitude !== 'number' || typeof olt.longitude !== 'number') return;

        const linkedNaps = napBoxes.filter(
          (b) => b.oltId === olt.id || (!b.oltId && olt.id === effectiveOltNodes[0]?.id)
        );

        // Group by PON Port
        const ponGroups = new Map<number, NapBox[]>();
        linkedNaps.forEach((nap) => {
          const port = nap.ponPortNumber || 1;
          if (!ponGroups.has(port)) ponGroups.set(port, []);
          ponGroups.get(port)!.push(nap);
        });

        ponGroups.forEach((napsOnPon, ponPort) => {
          const chain = buildPonCascadeChain(napsOnPon, olt);
          const telemetryList = calculateCascadeTelemetry(chain, olt);
          const baseColor = ponColors[(ponPort - 1) % ponColors.length];

          telemetryList.forEach((hop) => {
            const { nap, hopSpan, isFeeder, hopIndex, totalHops } = hop;
            if (typeof nap.latitude !== 'number' || typeof nap.longitude !== 'number') return;

            // Determine if this span or node is selected/highlighted
            const isNapSelected = selectedAsset?.type === 'nap' && selectedAsset.data.id === nap.id;
            const isUpstreamSelected =
              selectedAsset?.type === 'nap' && selectedAsset.data.id === hop.upstreamId;
            const isOltSelected = selectedAsset?.type === 'olt' && selectedAsset.data.id === olt.id;
            const isHighlighted = isNapSelected || isUpstreamSelected || isOltSelected;

            // Should we show this span based on showSpanDistances filter?
            const shouldRender =
              showSpanDistances === 'all' ||
              (isFeeder && showSpanDistances === 'olt') ||
              (!isFeeder && showSpanDistances === 'inter_nap');

            if (!shouldRender) return;

            const fromCoords: [number, number] = [hop.upstreamCoords.lat, hop.upstreamCoords.lng];
            const toCoords: [number, number] = [nap.latitude, nap.longitude];

            // Polyline connection
            const line = L.polyline([fromCoords, toCoords], {
              color: isHighlighted ? '#fbbf24' : baseColor,
              weight: isHighlighted ? 4.2 : isFeeder ? 2.8 : 2.2,
              opacity: isHighlighted ? 1.0 : isFeeder ? 0.85 : 0.75,
              dashArray: isHighlighted ? undefined : isFeeder ? undefined : '5, 5',
            });

            line.on('click', () => {
              onSelectAsset({ type: 'nap', data: nap });
            });

            // Detailed OSP & Optical Telemetry Tooltip
            line.bindTooltip(
              `<div style="font-family: monospace; font-size: 11px; line-height: 1.4;">` +
                `<div style="font-weight: 800; color: ${isHighlighted ? '#fbbf24' : '#38bdf8'}; margin-bottom: 2px;">` +
                `${isFeeder ? '🏢 Feeder Run (Span 1)' : `⚡ Cascade Hop #${hopIndex} of ${totalHops}`} (PON Port #${ponPort})` +
                `</div>` +
                `<div><strong>${hop.upstreamName}</strong> ➔ <strong>${nap.code}</strong></div>` +
                `<div style="margin-top: 4px; border-top: 1px solid #334155; padding-top: 3px;">` +
                `Hop Direct: <span style="color:#38bdf8;font-weight:bold;">${hopSpan.formattedDirect}</span> (Cable: <span style="color:#34d399;">${hopSpan.formattedRoute}</span>)<br/>` +
                `Cumulative Run: <span style="color:#a855f7;font-weight:bold;">${hop.cumulativeDirectMeters.toLocaleString()}m</span> (Cable: ${hop.cumulativeCableMeters.toLocaleString()}m)<br/>` +
                `FBT Splitter: <span style="color:#fbbf24;font-weight:bold;">${hop.fbtRatio}</span> (Thru: -${hop.fbtThroughLossDb}dB, Tap: -${hop.fbtTapLossDb}dB)<br/>` +
                `PLC Drop: <span style="color:#e2e8f0;font-weight:bold;">${hop.plcType}</span> (-${hop.plcLossDb}dB)<br/>` +
                `Arriving Input: <span style="color:#38bdf8;font-weight:bold;">${hop.arrivingInputPowerDbm} dBm</span><br/>` +
                `Subscriber Drop Rx: <span style="color:${hop.healthStatus === 'optimal' ? '#34d399' : hop.healthStatus === 'acceptable' ? '#38bdf8' : '#fbbf24'};font-weight:bold;">${hop.dropPortRxPowerDbm} dBm</span> (${hop.healthLabel})` +
                `</div></div>`,
              { sticky: true, className: 'gis-custom-tooltip' }
            );

            layersGroupRef.current.addLayer(line);

            // Midpoint Distance & FBT Badge Pill
            const midLat = (hop.upstreamCoords.lat + nap.latitude) / 2;
            const midLng = (hop.upstreamCoords.lng + nap.longitude) / 2;

            const pillIcon = L.divIcon({
              className: 'custom-cascade-dist-pill',
              html: `
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 3px;
                  background: #090d16;
                  border: 1.5px solid ${isHighlighted ? '#fbbf24' : baseColor};
                  border-radius: 9999px;
                  padding: 2px 7px;
                  box-shadow: 0 3px 12px rgba(0,0,0,0.8), 0 0 10px ${isHighlighted ? 'rgba(251, 191, 36, 0.7)' : 'rgba(6, 182, 212, 0.25)'};
                  color: ${isHighlighted ? '#fbbf24' : '#f8fafc'};
                  font-family: monospace;
                  font-size: 10px;
                  font-weight: 800;
                  white-space: nowrap;
                  cursor: pointer;
                  transform: translate(-50%, -50%);
                  transition: all 0.2s ease;
                ">
                  <span style="font-size: 9px;">${isFeeder ? '📏' : '⚡'}</span>
                  <span>${hopSpan.directMeters >= 1000 ? `${hopSpan.directKm}km` : `${hopSpan.directMeters}m`}</span>
                  <span style="
                    background: ${hop.fbtRatio === 'terminal' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(6, 182, 212, 0.25)'};
                    color: ${hop.fbtRatio === 'terminal' ? '#cbd5e1' : '#38bdf8'};
                    padding: 0 4px;
                    border-radius: 4px;
                    font-size: 9px;
                    margin-left: 1px;
                  ">
                    ${hop.fbtRatio}
                  </span>
                </div>
              `,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            });

            const pillMarker = L.marker([midLat, midLng], { icon: pillIcon });
            pillMarker.on('click', () => {
              onSelectAsset({ type: 'nap', data: nap });
            });
            pillMarker.bindTooltip(
              `<strong>${isFeeder ? 'Feeder Span' : `Hop #${hopIndex}`} (${hop.upstreamName} ➔ ${nap.code})</strong><br/>` +
                `Hop Distance: ${hopSpan.formattedDirect} (Cable: ${hopSpan.formattedRoute})<br/>` +
                `Cumulative: ${hop.cumulativeDirectMeters}m<br/>` +
                `Drop Rx: <span style="font-weight:bold;color:${hop.healthStatus === 'optimal' ? '#34d399' : '#fbbf24'}">${hop.dropPortRxPowerDbm} dBm</span>`,
              { direction: 'top', className: 'gis-custom-tooltip' }
            );

            layersGroupRef.current.addLayer(pillMarker);
          });
        });
      });
    }

    // 3. Fiber Cables (Polylines)
    fiberCables.forEach((cable) => {
      const isFeeder = cable.type === 'feeder';
      if (isFeeder && !showFeeder) return;
      if (!isFeeder && !showDistribution) return;

      if (!cable.pathCoordinates || cable.pathCoordinates.length < 2) return;
      const latLngs = cable.pathCoordinates.map((pt) => [pt.lat, pt.lng]);
      const isSelected = selectedAsset?.type === 'cable' && selectedAsset.data.id === cable.id;

      // Polyline with glow styling
      const polyline = L.polyline(latLngs, {
        color: cable.color || (isFeeder ? '#06b6d4' : '#10b981'),
        weight: isSelected ? 6 : isFeeder ? 4.5 : 3.5,
        opacity: isSelected ? 1 : 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      });

      polyline.on('click', () => {
        onSelectAsset({ type: 'cable', data: cable });
      });

      polyline.bindTooltip(
        `<strong>${cable.name}</strong> (${cable.code})<br/>${cable.coreCount} Cores • ${cable.lengthMeters}m • ${cable.fiberStandard}`,
        { sticky: true, className: 'gis-custom-tooltip' }
      );

      layersGroupRef.current.addLayer(polyline);
    });

    // 4. Splice Closures (FJC Dome Markers)
    if (showClosures) {
      fiberClosures.forEach((closure) => {
        if (typeof closure.latitude !== 'number' || typeof closure.longitude !== 'number') return;
        const isSelected = selectedAsset?.type === 'closure' && selectedAsset.data.id === closure.id;

        const closureIcon = L.divIcon({
          className: 'custom-leaflet-fjc',
          html: `
            <div style="
              display: flex;
              align-items: center;
              gap: 4px;
              background: #0f172a;
              border: 1.5px solid ${isSelected ? '#38bdf8' : '#f59e0b'};
              border-radius: 8px;
              padding: 2px 6px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.6);
              color: #f59e0b;
              font-family: monospace;
              font-size: 10px;
              font-weight: bold;
              white-space: nowrap;
              cursor: pointer;
            ">
              <span>🔩</span>
              <span>${closure.code}</span>
              <span style="background: rgba(245, 158, 11, 0.2); color: #fde68a; padding: 0 3px; border-radius: 4px; font-size: 9px;">
                ${closure.totalSplices}S
              </span>
            </div>
          `,
          iconSize: [60, 24],
          iconAnchor: [30, 12],
        });

        const marker = L.marker([closure.latitude, closure.longitude], { icon: closureIcon });
        marker.on('click', (e: any) => {
          if (isRulerActiveRef.current) {
            L.DomEvent.stopPropagation(e);
            handleRulerSelectPoint({
              lat: closure.latitude,
              lng: closure.longitude,
              name: `${closure.code} (${closure.name})`,
            });
            return;
          }
          onSelectAsset({ type: 'closure', data: closure });
        });
        marker.bindTooltip(
          `<strong>${closure.name}</strong><br/>Pole: ${closure.poleNumber || 'N/A'} • ${closure.trayCount} Trays (${closure.totalSplices} Splices)`,
          { direction: 'top', className: 'gis-custom-tooltip' }
        );
        layersGroupRef.current.addLayer(marker);
      });
    }

    // 5. NAP Boxes (Splitter Distribution Hubs)
    if (showNaps) {
      napBoxes.forEach((nap) => {
        if (typeof nap.latitude !== 'number' || typeof nap.longitude !== 'number') return;
        const isSelected = selectedAsset?.type === 'nap' && selectedAsset.data.id === nap.id;
        const occupiedCount = nap.ports?.filter((p) => p.status === 'occupied').length || 0;
        const total = nap.totalPorts || 16;
        const pct = total > 0 ? (occupiedCount / total) * 100 : 0;

        const occupancyColor =
          pct >= 100
            ? '#f43f5e' // Rose
            : pct >= 80
            ? '#f59e0b' // Amber
            : '#10b981'; // Emerald

        const fbtLabel = nap.fbtRatio ? (nap.fbtRatio === 'terminal' ? 'Term' : nap.fbtRatio) : '';

        const napIcon = L.divIcon({
          className: 'custom-leaflet-nap',
          html: `
            <div style="
              display: flex;
              align-items: center;
              gap: 4px;
              background: #090d16;
              border: 1.5px solid ${isSelected ? '#fbbf24' : '#334155'};
              border-radius: 9999px;
              padding: 2px 7px;
              box-shadow: 0 4px 14px rgba(0,0,0,0.8), 0 0 ${isSelected ? '12px #fbbf24' : '0'};
              font-family: monospace;
              font-size: 11px;
              font-weight: bold;
              white-space: nowrap;
              cursor: pointer;
            ">
              <span style="
                width: 7px;
                height: 7px;
                border-radius: 9999px;
                background-color: ${occupancyColor};
                display: inline-block;
                box-shadow: 0 0 6px ${occupancyColor};
              "></span>
              <span style="color: #f1f5f9;">${nap.code}</span>
              ${
                fbtLabel
                  ? `<span style="
                      background: ${nap.fbtRatio === 'terminal' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(251, 191, 36, 0.2)'};
                      border: 1px solid ${nap.fbtRatio === 'terminal' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(251, 191, 36, 0.4)'};
                      color: ${nap.fbtRatio === 'terminal' ? '#cbd5e1' : '#fbbf24'};
                      padding: 0 4px;
                      border-radius: 4px;
                      font-size: 8.5px;
                    ">${fbtLabel}</span>`
                  : ''
              }
              <span style="
                background: rgba(15, 23, 42, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: ${occupancyColor};
                padding: 1px 4px;
                border-radius: 9999px;
                font-size: 8.5px;
              ">
                ${occupiedCount}/${total}
              </span>
            </div>
          `,
          iconSize: [fbtLabel ? 105 : 85, 26],
          iconAnchor: [fbtLabel ? 52 : 42, 13],
        });

        const marker = L.marker([nap.latitude, nap.longitude], { icon: napIcon });
        marker.on('click', (e: any) => {
          if (isRulerActiveRef.current) {
            L.DomEvent.stopPropagation(e);
            handleRulerSelectPoint({
              lat: nap.latitude,
              lng: nap.longitude,
              name: `${nap.code} (${nap.name})`,
            });
            return;
          }
          onSelectAsset({ type: 'nap', data: nap });
        });

        const parentOlt = effectiveOltNodes.find(
          (o) => o.id === nap.oltId || (!nap.oltId && o.id === effectiveOltNodes[0]?.id)
        );

        marker.bindTooltip(
          `<strong>${nap.code} - ${nap.name}</strong><br/>` +
          `Serving OLT: <span style="color:#c084fc;font-weight:bold;">${parentOlt?.code || 'OLT-01'} (PON Port #${nap.ponPortNumber || 1})</span><br/>` +
          `${nap.location}, Brgy. ${nap.barangay}<br/>` +
          `FBT Splitter: <span style="color:#fbbf24;font-weight:bold;">${nap.fbtRatio || 'Direct'}</span> • PLC: ${nap.splitterType || '1:16'}<br/>` +
          `Active Ports: <span style="color:${occupancyColor};font-weight:bold;">${occupiedCount}/${total}</span> occupied`,
          { direction: 'top', className: 'gis-custom-tooltip' }
        );

        layersGroupRef.current.addLayer(marker);
      });
    }

    // 6. Central OLT Headend Nodes (Multiple OLTs support)
    if (showOlt && effectiveOltNodes.length > 0) {
      effectiveOltNodes.forEach((node) => {
        if (typeof node.latitude !== 'number' || typeof node.longitude !== 'number') return;
        const isSelected = selectedAsset?.type === 'olt' && selectedAsset?.data?.id === node.id;
        const linkedCount = napBoxes.filter(
          (b) => b.oltId === node.id || (!b.oltId && node.id === effectiveOltNodes[0]?.id)
        ).length;

        const oltIcon = L.divIcon({
          className: 'custom-leaflet-olt',
          html: `
            <div style="
              display: flex;
              align-items: center;
              gap: 6px;
              background: #0f172a;
              border: 2px solid ${isSelected ? '#ec4899' : '#a855f7'};
              border-radius: 12px;
              padding: 4px 10px;
              box-shadow: 0 4px 18px rgba(0,0,0,0.9), 0 0 16px ${isSelected ? 'rgba(236, 72, 153, 0.6)' : 'rgba(168, 85, 247, 0.4)'};
              color: #f8fafc;
              font-family: monospace;
              font-size: 11px;
              font-weight: 800;
              white-space: nowrap;
              cursor: pointer;
            ">
              <span style="font-size: 13px;">🏢</span>
              <span>${node.code || 'OLT'}</span>
              <span style="
                background: rgba(168, 85, 247, 0.25);
                color: #c084fc;
                padding: 1px 5px;
                border-radius: 6px;
                font-size: 9px;
              ">
                ${node.totalPonPorts} PON • ${linkedCount} NAPs
              </span>
            </div>
          `,
          iconSize: [150, 32],
          iconAnchor: [75, 16],
        });

        const oltMarker = L.marker([node.latitude, node.longitude], { icon: oltIcon });
        oltMarker.on('click', (e: any) => {
          if (isRulerActiveRef.current) {
            L.DomEvent.stopPropagation(e);
            handleRulerSelectPoint({
              lat: node.latitude,
              lng: node.longitude,
              name: `${node.code || 'OLT'} (${node.name})`,
            });
            return;
          }
          onSelectAsset({ type: 'olt', data: node });
        });
        oltMarker.bindTooltip(
          `<strong>${node.code || 'OLT'}: ${node.name}</strong><br/>${node.location}, Brgy. ${node.barangay}<br/>Tx Power: +${node.txPowerDbm} dBm • IP: ${node.ipAddress || '192.168.88.1'}<br/><span style="color:#c084fc;font-weight:bold;">Linked NAPs: ${linkedCount}</span>`,
          { direction: 'top', className: 'gis-custom-tooltip' }
        );
        layersGroupRef.current.addLayer(oltMarker);
      });
    }
  }, [
    oltNode,
    oltNodes,
    napBoxes,
    fiberCables,
    fiberClosures,
    customers,
    selectedAsset,
    showOlt,
    showFeeder,
    showDistribution,
    showNaps,
    showClosures,
    showDropLines,
    showCoverageRings,
    showSpanDistances,
    isLeafletReady,
  ]);

  // Handle OTDR Fault Break Locator Marker & Flight Animation
  useEffect(() => {
    if (!mapInstanceRef.current || !otdrLayerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    otdrLayerRef.current.clearLayers();

    if (activeOtdrBreak && activeOtdrBreak.point) {
      const { lat, lng } = activeOtdrBreak.point;

      // Pulsing Danger Circle
      const dangerCircle = L.circle([lat, lng], {
        radius: 75,
        color: '#f43f5e',
        fillColor: '#f43f5e',
        fillOpacity: 0.2,
        weight: 2,
        dashArray: '4, 4',
      });
      otdrLayerRef.current.addLayer(dangerCircle);

      // Flashing Hazard Icon
      const hazardIcon = L.divIcon({
        className: 'custom-leaflet-otdr',
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 6px;
            background: #e11d48;
            color: #ffffff;
            border: 2px solid #ffe4e6;
            border-radius: 9999px;
            padding: 4px 10px;
            box-shadow: 0 0 24px rgba(225, 29, 72, 0.9);
            font-family: monospace;
            font-size: 11px;
            font-weight: bold;
            white-space: nowrap;
            animation: bounce 1s infinite;
          ">
            <span>🚨</span>
            <span>OTDR BREAK: ${activeOtdrBreak.distance}m</span>
          </div>
        `,
        iconSize: [160, 30],
        iconAnchor: [80, 15],
      });

      const otdrMarker = L.marker([lat, lng], { icon: hazardIcon });
      otdrMarker.bindPopup(
        `
        <div style="font-size: 12px; color: #0f172a; line-height: 1.4;">
          <h4 style="margin: 0 0 4px; color: #e11d48; font-weight: bold;">🚨 Optical Fiber Break Detected</h4>
          <p style="margin: 0 0 4px;"><strong>Cable:</strong> ${activeOtdrBreak.cable.name}</p>
          <p style="margin: 0 0 4px;"><strong>Distance from OLT:</strong> ${activeOtdrBreak.distance} Meters</p>
          <p style="margin: 0 0 4px;"><strong>Coordinates:</strong> ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E</p>
          <p style="margin: 0; color: #e11d48;"><strong>Downstream Impact:</strong> ${activeOtdrBreak.affectedNaps.length} NAP Hubs, ${activeOtdrBreak.affectedCustomers.length} Subscribers</p>
        </div>
        `
      );

      otdrLayerRef.current.addLayer(otdrMarker);

      // Smooth camera flyTo the fault point
      mapInstanceRef.current.flyTo([lat, lng], 17, {
        animate: true,
        duration: 1.4,
      });

      setTimeout(() => {
        otdrMarker.openPopup();
      }, 1500);
    }
  }, [activeOtdrBreak, isLeafletReady]);

  // Draw ruler measurements on Leaflet map
  useEffect(() => {
    if (!mapInstanceRef.current || !rulerLayerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    rulerLayerRef.current.clearLayers();

    if (!isRulerActive || rulerPoints.length === 0) return;

    // Point A Marker
    const pA = rulerPoints[0];
    const iconA = L.divIcon({
      className: 'custom-ruler-point-a',
      html: `
        <div style="
          background: #f59e0b;
          color: #0f172a;
          font-weight: 900;
          font-family: monospace;
          border: 2px solid #ffffff;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 16px rgba(245, 158, 11, 0.9);
          font-size: 12px;
        ">
          A
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    const markerA = L.marker([pA.lat, pA.lng], { icon: iconA, interactive: false });
    rulerLayerRef.current.addLayer(markerA);

    // Point B Marker & Polyline
    if (rulerPoints.length >= 2) {
      const pB = rulerPoints[1];
      const iconB = L.divIcon({
        className: 'custom-ruler-point-b',
        html: `
          <div style="
            background: #06b6d4;
            color: #0f172a;
            font-weight: 900;
            font-family: monospace;
            border: 2px solid #ffffff;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 16px rgba(6, 182, 212, 0.9);
            font-size: 12px;
          ">
            B
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const markerB = L.marker([pB.lat, pB.lng], { icon: iconB, interactive: false });
      rulerLayerRef.current.addLayer(markerB);

      const polyline = L.polyline(
        [
          [pA.lat, pA.lng],
          [pB.lat, pB.lng],
        ],
        {
          color: '#f59e0b',
          weight: 3.5,
          dashArray: '8, 8',
          opacity: 0.95,
        }
      );
      rulerLayerRef.current.addLayer(polyline);

      const metrics = calculateSpanMetrics(pA.lat, pA.lng, pB.lat, pB.lng);
      const midLat = (pA.lat + pB.lat) / 2;
      const midLng = (pA.lat + pB.lng) / 2;

      const badgeIcon = L.divIcon({
        className: 'custom-ruler-badge',
        html: `
          <div style="
            background: rgba(15, 23, 42, 0.95);
            border: 1.5px solid #f59e0b;
            border-radius: 8px;
            padding: 3px 8px;
            color: #fbbf24;
            font-family: monospace;
            font-size: 11px;
            font-weight: bold;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.8), 0 0 10px rgba(245, 158, 11, 0.4);
            transform: translate(-50%, -50%);
          ">
            📏 ${metrics.formattedDirect} (Cable: ${metrics.formattedRoute})
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const badgeMarker = L.marker([midLat, midLng], { icon: badgeIcon, interactive: false });
      rulerLayerRef.current.addLayer(badgeMarker);
    }
  }, [isRulerActive, rulerPoints, isLeafletReady]);

  // Center on Headend or selected OLT
  const handleRecenterHeadend = () => {
    if (!mapInstanceRef.current) return;
    const target = (selectedAsset?.type === 'olt' ? selectedAsset.data : null) || primaryOlt;
    const lat = target?.latitude || 13.6870;
    const lng = target?.longitude || 123.5210;
    mapInstanceRef.current.flyTo([lat, lng], 15, { animate: true, duration: 1.0 });
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      {/* Map Container */}
      <div ref={mapContainerRef} className={`w-full h-full z-0 ${isRulerActive ? 'cursor-crosshair' : ''}`} />

      {/* Floating Custom HUD Controls (Top-Right) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        {/* Zoom & Recenter Controls */}
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl p-1 shadow-2xl flex flex-col items-center">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono font-bold text-slate-400 py-1">{currentZoom}x</span>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-4/5 h-[1px] bg-slate-800 my-1" />
          <button
            type="button"
            onClick={handleRecenterHeadend}
            className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 rounded-xl transition-colors"
            title="Center on OLT Central Headend"
          >
            <Crosshair className="w-4 h-4" />
          </button>
          <div className="w-4/5 h-[1px] bg-slate-800 my-1" />
          <button
            type="button"
            onClick={() => {
              const next = !isRulerActive;
              setIsRulerActive(next);
              if (!next) {
                setRulerPoints([]);
              }
            }}
            className={`p-2 rounded-xl transition-all ${
              isRulerActive
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'text-slate-300 hover:text-amber-400 hover:bg-slate-800'
            }`}
            title={isRulerActive ? 'Deactivate Distance Ruler' : 'Interactive Distance Ruler (Measure Spans)'}
          >
            <Ruler className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating GIS Ruler Measurement Banner (Top Center) */}
      {isRulerActive && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 w-[95%] max-w-lg bg-slate-900/95 border border-amber-500/60 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl animate-in fade-in slide-in-from-top-2 text-xs select-none">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Ruler className="w-4 h-4 text-amber-400" />
              <span className="font-mono tracking-wide">OSP Fiber Distance Ruler</span>
            </div>
            <div className="flex items-center gap-2">
              {rulerPoints.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRulerPoints([])}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsRulerActive(false);
                  setRulerPoints([]);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                title="Exit Ruler"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {rulerPoints.length === 0 && (
            <div className="py-2.5 text-slate-300 text-[11px] flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-mono text-[10px]">STEP 1</span>
              <span>Click anywhere on the map or click an <strong>OLT / NAP</strong> node to place <strong>Point A</strong>.</span>
            </div>
          )}

          {rulerPoints.length === 1 && (
            <div className="py-2.5 text-slate-300 text-[11px] flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-mono text-[10px]">STEP 2</span>
              <span>
                Point A set at <strong className="text-amber-300 font-mono">{rulerPoints[0].name || `${rulerPoints[0].lat.toFixed(4)}°, ${rulerPoints[0].lng.toFixed(4)}°`}</strong>. Now click <strong>Point B</strong> to measure distance.
              </span>
            </div>
          )}

          {rulerPoints.length === 2 && rulerMetrics && (
            <div className="pt-2.5 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate max-w-[46%] font-mono text-amber-300 font-semibold" title={rulerPoints[0].name}>
                  A: {rulerPoints[0].name || `${rulerPoints[0].lat.toFixed(4)}°, ${rulerPoints[0].lng.toFixed(4)}°`}
                </span>
                <span className="text-amber-400 font-bold">➔</span>
                <span className="truncate max-w-[46%] font-mono text-cyan-300 font-semibold text-right" title={rulerPoints[1].name}>
                  B: {rulerPoints[1].name || `${rulerPoints[1].lat.toFixed(4)}°, ${rulerPoints[1].lng.toFixed(4)}°`}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950 border border-amber-500/30 font-mono text-center">
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Direct Air Span</span>
                  <span className="text-white font-bold text-sm">{rulerMetrics.formattedDirect}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Route Cable (+20%)</span>
                  <span className="text-cyan-300 font-bold text-sm">{rulerMetrics.formattedRoute}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Optical Loss (1310nm)</span>
                  <span className="text-emerald-400 font-bold text-sm">~{rulerMetrics.opticalLossDb} dB</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Coordinates & Click-To-Deploy Banner (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* GPS Coordinates & Scale HUD */}
        <div className="bg-slate-900/95 border border-slate-800/80 backdrop-blur-md px-3 py-2 rounded-2xl text-[11px] text-slate-300 flex items-center gap-3 shadow-xl">
          <div className="flex items-center gap-1.5 font-mono font-bold text-cyan-400">
            <Compass className="w-4 h-4" />
            <span>Lagonoy & Presentacion OSP</span>
          </div>
          <div className="border-l border-slate-800 pl-3 flex items-center gap-1.5 text-slate-400 text-[10px]">
            <span>Tiles:</span>
            <span className="font-semibold text-slate-200 capitalize">
              {mapTileStyle === 'satellite' ? '🛰️ Esri Satellite' : mapTileStyle === 'dark_grid' ? '🌃 Cyber Dark' : '🗺️ Street Navigation'}
            </span>
          </div>
        </div>

        {/* Clicked Coordinate Deployment Pill */}
        {clickedLocation && (onDeployNapAtLocation || onRegisterOltAtLocation) && (
          <div className="bg-slate-900/95 border border-cyan-500/50 backdrop-blur-md px-3.5 py-2 rounded-2xl text-[11px] text-slate-200 flex flex-wrap items-center gap-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-1.5 font-mono text-cyan-300 font-bold">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>{clickedLocation.lat.toFixed(4)}° N, {clickedLocation.lng.toFixed(4)}° E</span>
            </div>
            {onDeployNapAtLocation && (
              <button
                type="button"
                onClick={() => onDeployNapAtLocation(clickedLocation)}
                className="flex items-center gap-1 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all shadow-md"
              >
                <Plus className="w-3 h-3" />
                <span>Deploy NAP Here</span>
              </button>
            )}
            {onRegisterOltAtLocation && (
              <button
                type="button"
                onClick={() => onRegisterOltAtLocation(clickedLocation)}
                className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all shadow-md"
              >
                <Server className="w-3 h-3 text-purple-200" />
                <span>Register OLT Here</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setClickedLocation(null)}
              className="text-slate-400 hover:text-slate-200 ml-1 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Google Maps Platform Attribution Badge */}
        {mapTileStyle.startsWith('google_') && (
          <div className="absolute bottom-2 left-3 z-[450] pointer-events-none flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950/75 backdrop-blur-sm border border-slate-800 text-[10px] text-slate-300 shadow-sm font-sans">
            <span className="font-bold text-white tracking-tight">Google</span>
            <span className="text-slate-400 text-[9px]">Map data &copy;{new Date().getFullYear()}</span>
          </div>
        )}
      </div>

      {/* Leaflet Loading Overlay Fallback */}
      {!isLeafletReady && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-mono">Initializing Real Satellite GIS Engine...</span>
          </div>
        </div>
      )}
    </div>
  );
};
