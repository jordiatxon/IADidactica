
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
    x = RAIL_OFFSET + trackPos;
    y = RAIL_OFFSET;
    angle = 0;
    isHorizontal = true;
  } else if (trackPos <= TRACK_W + TRACK_H) {
    x = RAIL_OFFSET + TRACK_W;
    y = RAIL_OFFSET + (trackPos - TRACK_W);
    angle = 90;
    isHorizontal = false;
  } else if (trackPos <= 2 * TRACK_W + TRACK_H) {
    x = RAIL_OFFSET + TRACK_W - (trackPos - (TRACK_W + TRACK_H));
    y = RAIL_OFFSET + TRACK_H;
    angle = 180;
    isHorizontal = true;
  } else {
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
  const [imageError, setImageError] = useState(false);
  
  const lastTimeRef = useRef<number>(0);
  const batteryElectronIdCounter = useRef(0);

  useEffect(() => {
    const initialElectrons = Array.from({ length: ELECTRON_COUNT }).map(() => ({
      trackPos: Math.random() * PERIMETER,
      transversePos: (Math.random() - 0.5) * 12, 
      vx: (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1),
      vy: (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1),
      vfreq: `${(Math.random() * 0.3 + 0.2).toFixed(2)}s`
    }));
    setElectrons(initialElectrons);
  }, []);

  useEffect(() => {
    let animationFrame: number;
    let lastSecond = 0;

    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      if (isCircuitClosed && !isBatteryDead) {
        setElectrons(prev => prev.map(e => ({
          ...e,
          trackPos: (e.trackPos + SPEED_PX_S * deltaTime) % PERIMETER
        })));

        if (time - lastSecond >= 1000) {
          lastSecond = time;
          setElectrolyteHeight(h => {
            const newH = Math.max(0, h - ELECTROLYTE_DRAIN_S);
            if (newH === 0) setIsBatteryDead(true);
            return newH;
          });
          setVisibleIons(i => Math.max(0, i - ION_DRAIN_S));
        }

        if (Math.random() > 0.7) {
          const id = batteryElectronIdCounter.current++;
          const startX = 350 + Math.random() * 45; 
          const startY = (RAIL_OFFSET - 37.5) + Math.random() * 70;
          setBatteryElectrons(prev => [...prev, { id, x: startX, y: startY }]);
        }
      }

      setBatteryElectrons(prev => prev.map(be => {
        const targetX = 325 + 75;
        const targetY = RAIL_OFFSET;
        const dx = targetX - be.x;
        const dy = targetY - be.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 5) return { ...be, x: targetX, y: targetY, dead: true };
        
        return { 
          ...be, 
          x: be.x + (dx / dist) * 100 * deltaTime, 
          y: be.y + (dy / dist) * 100 * deltaTime 
        };
      }).filter(be => !be.hasOwnProperty('dead')));

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
    <div className="flex flex-col items-center w-full min-h-screen bg-black overflow-y-auto pb-20">
      <h1 className="mt-[40px] mb-8 text-white text-[20px] font-bold text-center px-4" style={{ fontFamily: 'Arial' }}>
        Representació del circuit elèctric de corrent continu
      </h1>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row items-center justify-center w-full max-w-7xl px-4 gap-8 lg:gap-12">
        
        {/* Left Side: PilaVolta representation */}
        <div className="flex flex-col items-center justify-center shrink-0 w-[300px]">
          <div className={`w-full min-h-[350px] flex items-center justify-center p-2 rounded-xl border border-gray-700/50 bg-gray-900/30 transition-all duration-700 ${isCircuitClosed && !isBatteryDead ? 'shadow-[0_0_40px_rgba(59,130,246,0.4)] border-blue-500/50' : 'grayscale-[40%]'}`}>
            {!imageError ? (
              <img 
                src="https://raw.githubusercontent.com/jordiatxon/Electrons/main/Pila%20de%20Volta.jpg" 
                alt="Pila de Volta" 
                className="max-w-full h-auto rounded-lg shadow-2xl"
                onLoad={() => setImageError(false)}
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 opacity-50">
                {/* Visual Placeholder: Stylized Volta Pile icon */}
                <svg width="60" height="200" viewBox="0 0 60 200">
                  {[...Array(12)].map((_, i) => (
                    <rect key={i} x="5" y={10 + i * 15} width="50" height="8" rx="2" fill={i % 2 === 0 ? "#ccc" : "#a8a8a8"} />
                  ))}
                  <line x1="30" y1="0" x2="30" y2="10" stroke="white" strokeWidth="2" />
                  <line x1="30" y1="190" x2="30" y2="200" stroke="white" strokeWidth="2" />
                </svg>
              </div>
            )}
          </div>
          <p className="mt-4 text-white text-[13px] text-center leading-relaxed" style={{ fontFamily: 'Arial' }}>
            Pila de Volta. Monedes de 10 cèntims escalfades (Òxid de Coure). Cartolina xopada amb vinagre. Volanderes cincades (Zinc)
          </p>
        </div>

        {/* Right Side: Circuit SVG */}
        <div className="shrink-0 flex items-center justify-center bg-gray-900/20 rounded-2xl p-4 border border-white/5">
          <svg width="800" height="480" viewBox="0 0 850 480" className="max-w-full h-auto">
            <g transform="translate(100, 50)">
              {/* Bulb */}
              <circle
                cx={318 + RAIL_OFFSET} 
                cy={TRACK_H + RAIL_OFFSET}
                r="40"
                fill={isCircuitClosed && !isBatteryDead ? "#FFFF00" : "#333"}
                filter={isCircuitClosed && !isBatteryDead ? "drop-shadow(0 0 15px yellow)" : ""}
              />

              {/* Conductor Frame */}
              <path
                d={`M 0,0 L ${OUTER_W},0 L ${OUTER_W},${OUTER_H} L 0,${OUTER_H} Z 
                    M ${CONDUCTOR_W},${CONDUCTOR_W} L ${CONDUCTOR_W},${OUTER_H - CONDUCTOR_W} L ${OUTER_W - CONDUCTOR_W},${OUTER_H - CONDUCTOR_W} L ${OUTER_W - CONDUCTOR_W},${CONDUCTOR_W} Z`}
                fill="white"
                fillRule="evenodd"
              />

              {/* Electrons */}
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
                    r="1.2"
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

              {/* Electric Field */}
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

              {/* Switch */}
              {!isCircuitClosed && (
                <rect x={325 + 75 + 50} y={RAIL_OFFSET - 10} width="30" height="20" fill="black" />
              )}

              {/* Battery */}
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

              {/* Battery chemical electrons */}
              {batteryElectrons.map(be => (
                <circle key={be.id} cx={be.x} cy={be.y} r="1.5" fill="red" />
              ))}

              {/* Interaction Button */}
              <foreignObject x="150" y="150" width="350" height="100">
                <div className="w-full h-full flex items-center justify-center">
                  <button
                    onClick={handleToggle}
                    className="px-6 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white hover:bg-gray-800 transition-all active:scale-95 shadow-xl"
                    style={{ fontSize: '16px', fontFamily: 'Arial' }}
                  >
                    {isBatteryDead ? "Bateria esgotada. Torna a carregar-la." : "Clic per obrir/tancar el circuit"}
                  </button>
                </div>
              </foreignObject>
            </g>
          </svg>
        </div>
      </div>

      {/* Legends */}
      <div className="mt-12 mb-12 flex flex-wrap justify-center gap-x-10 gap-y-6 text-white text-[13px] max-w-5xl px-6" style={{ fontFamily: 'Arial' }}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
          <span>Electrons lliures.</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-600" />
          <span>Electrons alliberats.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-blue-500 font-bold text-[22px] leading-none">+</span>
          <span>Ions positius</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-gray-400" />
          <span>Òxid de Coure</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-300" />
          <span>Electròlit</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-pink-300" />
          <span>Zinc</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-[3px] h-[12px] bg-[#A020F0]" />
            <div className="w-[3px] h-[12px] bg-[#A020F0]" />
            <div className="w-[3px] h-[12px] bg-[#A020F0]" />
          </div>
          <span className="ml-1">Camp Elèctric.</span>
        </div>
      </div>

      {/* Reference Image at Bottom */}
      <div className="mt-8 flex flex-col items-center gap-4 border-t border-gray-800 pt-12 w-full max-w-4xl px-4">
        <div className="bg-gray-900/50 p-2 rounded-xl border border-gray-700/50 shadow-2xl overflow-hidden max-w-full">
          <img 
            src="https://raw.githubusercontent.com/jordiatxon/Electrons/main/4.pila%20muntada%2Blumm.jpg" 
            alt="Referència Pila" 
            className="max-w-full h-auto rounded-md"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
