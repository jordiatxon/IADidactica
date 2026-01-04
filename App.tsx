
import React, { useState, useEffect, useRef, useMemo } from 'react';

// Constants based on specification
const OUTER_W = 650;
const OUTER_H = 400;
const CONDUCTOR_W = 15;
const TRACK_W = 635; // midline width: (OUTER_W - CONDUCTOR_W)
const TRACK_H = 385; // midline height
const PERIMETER = 2 * (TRACK_W + TRACK_H); // 2040
const ELECTRON_COUNT = 1000;
const SPEED_PX_S = 20;
const ELECTROLYTE_DRAIN_S = 5;
const ION_DRAIN_S = 5;

// The rail midline starts at offset 7.5 relative to the outer rectangle top-left.
const RAIL_OFFSET = 7.5;

const getXY = (trackPos: number): { x: number; y: number; angle: number; isHorizontal: boolean } => {
  let x = 0;
  let y = 0;
  let angle = 0;
  let isHorizontal = true;

  if (trackPos <= TRACK_W) {
    // Top segment (left to right)
    x = RAIL_OFFSET + trackPos;
    y = RAIL_OFFSET;
    angle = 0;
    isHorizontal = true;
  } else if (trackPos <= TRACK_W + TRACK_H) {
    // Right segment (top to bottom)
    x = RAIL_OFFSET + TRACK_W;
    y = RAIL_OFFSET + (trackPos - TRACK_W);
    angle = 90;
    isHorizontal = false;
  } else if (trackPos <= 2 * TRACK_W + TRACK_H) {
    // Bottom segment (right to left)
    x = RAIL_OFFSET + TRACK_W - (trackPos - (TRACK_W + TRACK_H));
    y = RAIL_OFFSET + TRACK_H;
    angle = 180;
    isHorizontal = true;
  } else {
    // Left segment (bottom to top)
    x = RAIL_OFFSET;
    y = RAIL_OFFSET + TRACK_H - (trackPos - (2 * TRACK_W + TRACK_H));
    angle = 270;
    isHorizontal = false;
  }

  return { x, y, angle, isHorizontal };
};

const App: React.FC = () => {
  const [isCircuitClosed, setIsCircuitClosed] = useState(false);
  const [isBatteryDead, setIsBatteryDead] = useState(false);
  const [electrolyteHeight, setElectrolyteHeight] = useState(75);
  const [visibleIons, setVisibleIons] = useState(75);
  const [electrons, setElectrons] = useState<{ trackPos: number; transversePos: number; vx: number; vy: number; vfreq: string }[]>([]);
  const [batteryElectrons, setBatteryElectrons] = useState<{ id: number; x: number; y: number }[]>([]);
  
  const lastTimeRef = useRef<number>(0);
  const batteryElectronIdCounter = useRef(0);

  // Initialize electrons once
  useEffect(() => {
    const initialElectrons = Array.from({ length: ELECTRON_COUNT }).map(() => ({
      trackPos: Math.random() * PERIMETER,
      transversePos: (Math.random() - 0.5) * 12, // Slightly less than CONDUCTOR_W to ensure they are visibly inside
      vx: (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1),
      vy: (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1),
      vfreq: `${(Math.random() * 0.3 + 0.2).toFixed(2)}s`
    }));
    setElectrons(initialElectrons);
  }, []);

  // Main Loop
  useEffect(() => {
    let animationFrame: number;
    let lastSecond = 0;

    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      if (isCircuitClosed && !isBatteryDead) {
        // Move circuit electrons clockwise
        setElectrons(prev => prev.map(e => ({
          ...e,
          trackPos: (e.trackPos + SPEED_PX_S * deltaTime) % PERIMETER
        })));

        // Battery dynamics
        if (time - lastSecond >= 1000) {
          lastSecond = time;
          setElectrolyteHeight(h => {
            const newH = Math.max(0, h - ELECTROLYTE_DRAIN_S);
            if (newH === 0) setIsBatteryDead(true);
            return newH;
          });
          setVisibleIons(i => Math.max(0, i - ION_DRAIN_S));
        }

        // Generate battery chemistry electrons
        if (Math.random() > 0.7) {
          const id = batteryElectronIdCounter.current++;
          const startX = 100 + (325 - 75) + 100 + Math.random() * 50; 
          const startY = 100 + RAIL_OFFSET - 37.5 + Math.random() * 75;
          setBatteryElectrons(prev => [...prev, { id, x: startX, y: startY }]);
        }
      }

      // Slide battery electrons towards the conductor entry (top rail, right of battery)
      setBatteryElectrons(prev => prev.map(be => {
        const targetX = 100 + 325 + 75; // Right edge of battery on top rail
        const targetY = 100 + RAIL_OFFSET;
        const dx = (targetX - be.x) * (deltaTime / 1.0);
        const dy = (targetY - be.y) * (deltaTime / 1.0);
        return { ...be, x: be.x + dx, y: be.y + dy };
      }).filter(be => {
        const targetX = 100 + 325 + 75;
        const targetY = 100 + RAIL_OFFSET;
        return Math.sqrt(Math.pow(be.x - targetX, 2) + Math.pow(be.y - targetY, 2)) > 5;
      }));

      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrame);
  }, [isCircuitClosed, isBatteryDead]);

  const handleToggle = () => {
    if (isBatteryDead) {
      setElectrolyteHeight(75);
      setVisibleIons(75);
      setIsBatteryDead(false);
      setIsCircuitClosed(false);
    } else {
      setIsCircuitClosed(!isCircuitClosed);
    }
  };

  const fieldSegments = useMemo(() => {
    const segments = [];
    for (let p = 0; p < PERIMETER; p += 60) {
      const { x, y, angle } = getXY(p);
      const isTopRail = Math.abs(y - RAIL_OFFSET) < 1;
      const inBatteryX = x >= 325 - 75 && x <= 325 + 75;
      if (!(isTopRail && inBatteryX)) {
        segments.push({ x, y, angle });
      }
    }
    return segments;
  }, []);

  const positiveIons = useMemo(() => {
    const ions = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 5; c++) {
        ions.push({ r, c });
      }
    }
    return ions;
  }, []);

  return (
    <div className="flex flex-col items-center w-full h-full bg-black overflow-hidden relative">
      {/* Title (Kept at lowered 40px margin) */}
      <h1 className="mt-[40px] text-white text-[20px] font-bold text-center" style={{ fontFamily: 'Arial' }}>
        Representació del circuit elèctric de corrent continu
      </h1>

      <svg width="850" height="480" viewBox="0 0 850 480" className="flex-shrink-0 mt-4">
        <g transform="translate(100, 50)">
          {/* Bulb - Behind conductor at bottom-mid-left area */}
          <circle
            cx={318 + RAIL_OFFSET} 
            cy={TRACK_H + RAIL_OFFSET}
            r="40"
            fill={isCircuitClosed && !isBatteryDead ? "#FFFF00" : "#333"}
            filter={isCircuitClosed && !isBatteryDead ? "drop-shadow(0 0 10px yellow)" : ""}
          />

          {/* Conductor Frame */}
          <path
            d={`M 0,0 L ${OUTER_W},0 L ${OUTER_W},${OUTER_H} L 0,${OUTER_H} Z 
                M ${CONDUCTOR_W},${CONDUCTOR_W} L ${CONDUCTOR_W},${OUTER_H - CONDUCTOR_W} L ${OUTER_W - CONDUCTOR_W},${OUTER_H - CONDUCTOR_W} L ${OUTER_W - CONDUCTOR_W},${CONDUCTOR_W} Z`}
            fill="white"
            fillRule="evenodd"
          />

          {/* Electrons strictly inside conductor */}
          {electrons.map((e, i) => {
            const { x, y, isHorizontal } = getXY(e.trackPos);
            const cx = isHorizontal ? x : x + e.transversePos;
            const cy = isHorizontal ? y + e.transversePos : y;

            const isUnderBattery = (Math.abs(y - RAIL_OFFSET) < 1 && x >= 325 - 75 && x <= 325 + 75);
            const switchXStart = 325 + 75 + 50;
            const isUnderSwitch = !isCircuitClosed && (Math.abs(y - RAIL_OFFSET) < 1 && x >= switchXStart && x <= switchXStart + 30);

            if (isUnderBattery || isUnderSwitch) return null;

            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="1"
                fill="red"
                className={!isCircuitClosed ? "electron-vibrate" : ""}
                style={{
                  // @ts-ignore
                  '--vx': `${e.vx}px`,
                  '--vy': `${e.vy}px`,
                  '--vfreq': e.vfreq
                }}
              />
            );
          })}

          {/* Electric Field markers */}
          {isCircuitClosed && !isBatteryDead && fieldSegments.map((seg, i) => (
            <line
              key={i}
              x1={seg.x}
              y1={seg.y - 25}
              x2={seg.x}
              y2={seg.y + 25}
              stroke="#A020F0"
              strokeWidth="2"
              transform={`rotate(${seg.angle}, ${seg.x}, ${seg.y})`}
            />
          ))}

          {/* Switch (Pulsador) visible when open */}
          {!isCircuitClosed && (
            <rect x={325 + 75 + 50} y={RAIL_OFFSET - 10} width="30" height="20" fill="black" />
          )}

          {/* Battery - Centered at top rail */}
          <g transform={`translate(${325 - 75}, ${RAIL_OFFSET - 37.5})`}>
            <rect x="0" y="0" width="150" height="75" fill="white" stroke="black" strokeWidth="1" />
            <rect x="0" y="0" width="50" height="75" fill="#D3D3D3" />
            {positiveIons.slice(0, visibleIons).map((ion, idx) => (
              <text key={idx} x={5 + (ion.c * 8)} y={12 + (ion.r * 4.5)} fill="blue" fontSize="12" fontFamily="Arial" textAnchor="middle">+</text>
            ))}
            <rect x="50" y={75 - electrolyteHeight} width="50" height={electrolyteHeight} fill="#ADD8E6" />
            <rect x="100" y="0" width="50" height="75" fill="#FFC0CB" />
            <text x="25" y="105" fill="#A020F0" fontSize="30" fontFamily="Arial" textAnchor="middle">+</text>
            <text x="125" y="105" fill="#A020F0" fontSize="30" fontFamily="Arial" textAnchor="middle">-</text>
          </g>

          {/* Centered Button (Inside the hole) */}
          <foreignObject x="150" y="150" width="350" height="100">
            <div className="w-full h-full flex items-center justify-center">
              <button
                onClick={handleToggle}
                className="px-6 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white hover:bg-gray-800 transition-all active:scale-95 shadow-lg"
                style={{ fontSize: '16px', fontFamily: 'Arial' }}
              >
                {isBatteryDead ? "Bateria esgotada. Torna a carregar-la." : "Clic per obrir/tancar el circuit"}
              </button>
            </div>
          </foreignObject>
        </g>

        {/* Battery chemical electrons */}
        {batteryElectrons.map(be => (
          <circle key={be.id} cx={be.x} cy={be.y} r="1.5" fill="red" />
        ))}
      </svg>

      {/* Legends (Moved to the bottom, roughly 30px below the bulb/bottom segment) */}
      <div className="mt-4 mb-8 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-white text-[13px] max-w-5xl px-4" style={{ fontFamily: 'Arial' }}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
          <span>Electrons lliures.</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-600" />
          <span>Electrons química.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-blue-500 font-bold text-[22px] leading-none">+</span>
          <span>Àtom positiu</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-gray-400" />
          <span>Manganès</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-300" />
          <span>Electròlit</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-pink-300" />
          <span>Zinc</span>
        </div>
        <div className="flex items-center gap-2 md:col-span-2 justify-center md:justify-start">
          <div className="flex gap-1">
            <div className="w-[3px] h-[12px] bg-[#A020F0]" />
            <div className="w-[3px] h-[12px] bg-[#A020F0]" />
            <div className="w-[3px] h-[12px] bg-[#A020F0]" />
          </div>
          <span className="ml-1">Camp Elèctric.</span>
        </div>
      </div>
    </div>
  );
};

export default App;
