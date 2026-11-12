import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Health, ZoneId } from '../sim/types';
import { ARENA, CLOSURE, GATES, LOTS, PARK, ROADS, STAGING, WATER, along, bounds, pathLength, spotPos, type Pt } from './world';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface MapProps {
  venue: string;
  camera: Camera;
  theme?: 'light' | 'dark';
  /** Screen size in px. */
  width?: number;
  height?: number;
  /** Fraction of the height not covered by the bottom sheet; the camera centres in it. */
  visible?: number;
  iconScale?: number;
  route?: Pt[] | null;
  walk?: Pt[] | null;
  walkProgress?: number;
  car?: { pos: Pt; angle: number } | null;
  you?: Pt | null;
  pickup?: { pos: Pt; label: string; eta?: string } | null;
  pins?: { pos: Pt; label: string; dark?: boolean }[];
  /** Named pickup points, drawn the way rideshare apps mark airport pickups: blue markers, the chosen one labelled. */
  pickupSpots?: { pos: Pt; label: string; selected?: boolean }[];
  /**
   * Phone style: lots look like ordinary base-map parking areas with a "P" label,
   * instead of the outlined zones ops sees.
   */
  baseMap?: boolean;
  traffic?: { n: number; t: number };
  zoneFocus?: ZoneId | null;
  zoneHealth?: Record<ZoneId, Health>;
  spotsOn?: boolean;
  lotFill?: Record<ZoneId, number>;
  closure?: boolean;
  stagingOn?: boolean;
  staged?: number;
  offline?: 'saved' | null;
  showGates?: boolean;
  children?: ReactNode;
}

const PALETTE = {
  light: {
    bg: '#eef0f3',
    water: '#cfdbe8',
    park: '#d9e8d3',
    road: '#ffffff',
    casing: '#dde1e6',
    service: '#f8f9fa',
    label: '#8b929c',
    plaza: '#f6f7f9',
    building: '#d5d9df',
    buildingText: '#4b5563',
    lot: '#e2e5ea',
    lotLine: '#c3c8cf',
    route: '#111111',
    car: '#111111',
    traffic: '#7b828c',
  },
  dark: {
    bg: '#15171b',
    water: '#0f1b27',
    park: '#18241c',
    road: '#3d434d',
    casing: '#262a31',
    service: '#30353d',
    label: '#8d949e',
    plaza: '#1d2025',
    building: '#2c3139',
    buildingText: '#b4bac3',
    lot: '#22262c',
    lotLine: '#454c56',
    route: '#f4f4f5',
    car: '#f4f4f5',
    traffic: '#737b86',
  },
};

const HEALTH = { green: '#10b981', amber: '#f59e0b', red: '#ef4444' };

const TRAFFIC_PATHS: Pt[][] = [
  [
    [640, 0],
    [640, 520],
    [490, 520],
  ],
  [
    [1100, 520],
    [640, 520],
  ],
  [
    [120, 520],
    [370, 520],
  ],
];

/** Fit a camera around points, centred in the visible part of the screen. */
export function fitCamera(pts: Pt[], width: number, visibleH: number, maxZoom = 2.4, pad = 40): Camera {
  const b = bounds(pts);
  const zoom = Math.min(maxZoom, (width - pad * 2) / Math.max(1, b.x1 - b.x0), (visibleH - pad * 2) / Math.max(1, b.y1 - b.y0));
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, zoom };
}

/** Ease the camera toward its target so stage changes pan and zoom instead of jumping. */
function useSmoothCamera(target: Camera): Camera {
  const [cam, setCam] = useState(target);
  const ref = useRef(target);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const c = ref.current;
      const dz = Math.log(target.zoom) - Math.log(c.zoom);
      const done = Math.abs(target.x - c.x) < 0.5 && Math.abs(target.y - c.y) < 0.5 && Math.abs(dz) < 0.005;
      const next = done
        ? target
        : { x: c.x + (target.x - c.x) * 0.2, y: c.y + (target.y - c.y) * 0.2, zoom: Math.exp(Math.log(c.zoom) + dz * 0.2) };
      ref.current = next;
      setCam(next);
      if (!done) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target.x, target.y, target.zoom]);
  return cam;
}

export function CityMap(props: MapProps) {
  const {
    venue,
    theme = 'light',
    width: W = 278,
    height: H = 556,
    visible = 1,
    iconScale = 1,
    spotsOn = false,
    stagingOn = false,
    showGates = true,
  } = props;
  const c = PALETTE[theme];
  const cam = useSmoothCamera(props.camera);
  const Hv = H * visible;
  const z = cam.zoom;
  const proj = (p: Pt): Pt => [(p[0] - cam.x) * z + W / 2, (p[1] - cam.y) * z + Hv / 2];
  const world = `translate(${W / 2} ${Hv / 2}) scale(${z}) translate(${-cam.x} ${-cam.y})`;
  const fs = (px: number) => px / z; // keep labels a constant on-screen size


  return (
    <div className="absolute inset-0" style={props.offline === 'saved' ? { filter: 'grayscale(1) contrast(0.95)' } : undefined}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="block">
        <defs>
        </defs>
        <rect width={W} height={H} fill={c.bg} />
        <g transform={world}>
          <polygon points={WATER.map((p) => p.join(',')).join(' ')} fill={c.water} />
          <text x={40} y={700} fontSize={fs(10)} fill={c.label} fontStyle="italic" transform={`rotate(-90 40 700)`}>
            Harbor
          </text>
          <rect x={PARK.x} y={PARK.y} width={PARK.w} height={PARK.h} rx={8} fill={c.park} />
          {/* roads: casing first, then fill */}
          {ROADS.map((r, i) => (
            <polyline
              key={`c${i}`}
              points={r.pts.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke={c.casing}
              strokeWidth={r.kind === 'major' ? 19 : r.kind === 'minor' ? 13 : 8}
              strokeLinecap="round"
            />
          ))}
          {ROADS.map((r, i) => (
            <polyline
              key={`r${i}`}
              points={r.pts.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke={r.kind === 'service' ? c.service : c.road}
              strokeWidth={r.kind === 'major' ? 15 : r.kind === 'minor' ? 10 : 6}
              strokeLinecap="round"
            />
          ))}
          {ROADS.filter((r) => r.name).map((r) => {
            const [a, b] = r.pts;
            const vertical = a[0] === b[0];
            // Labels sit on the road and follow the camera so they stay on screen.
            const clampTo = (v: number, lo: number, hi: number) => Math.max(lo + 40, Math.min(hi - 80, v));
            const x = vertical ? a[0] : clampTo(cam.x + 30 / z, a[0], b[0]);
            const y = vertical ? clampTo(cam.y - 120 / z, a[1], b[1]) : a[1];
            return (
              <text
                key={r.name}
                x={x}
                y={y + fs(3)}
                fontSize={fs(8)}
                fill={c.label}
                fontWeight={r.kind === 'major' ? 600 : 400}
                transform={vertical ? `rotate(90 ${x} ${y})` : undefined}
              >
                {r.name}
              </text>
            );
          })}
          {/* arena */}
          <rect x={ARENA.plaza.x} y={ARENA.plaza.y} width={ARENA.plaza.w} height={ARENA.plaza.h} rx={26} fill={c.plaza} />
          <ellipse cx={ARENA.cx} cy={ARENA.cy} rx={ARENA.rx} ry={ARENA.ry} fill={c.building} />
          <ellipse cx={ARENA.cx} cy={ARENA.cy} rx={ARENA.rx - 26} ry={ARENA.ry - 20} fill="none" stroke={c.plaza} strokeWidth={2} />
          <text x={ARENA.cx} y={ARENA.cy + fs(4)} textAnchor="middle" fontSize={fs(11)} fontWeight={700} fill={c.buildingText}>
            {venue}
          </text>
          {showGates &&
            Object.entries(GATES).map(([g, p]) => (
              <g key={g}>
                <circle cx={p[0]} cy={p[1]} r={fs(6)} fill={c.road} stroke={c.buildingText} strokeWidth={fs(1)} />
                <text x={p[0]} y={p[1] + fs(2.5)} textAnchor="middle" fontSize={fs(6)} fontWeight={700} fill={c.buildingText}>
                  {g}
                </text>
              </g>
            ))}
          {/* zones */}
          {props.baseMap &&
            (['A', 'B'] as ZoneId[]).map((id) => (
              <rect key={id} x={LOTS[id].x} y={LOTS[id].y} width={LOTS[id].w} height={LOTS[id].h} rx={3} fill={c.lot} />
            ))}
          {!props.baseMap &&
            (['A', 'B'] as ZoneId[]).map((id) => {
              const lot = LOTS[id];
              const focus = props.zoneFocus === id;
              const hc = props.zoneHealth ? HEALTH[props.zoneHealth[id]] : null;
              return (
                <g key={id}>
                  <rect
                    x={lot.x}
                    y={lot.y}
                    width={lot.w}
                    height={lot.h}
                    rx={6}
                    fill={c.lot}
                    stroke={hc ?? (focus ? c.route : c.lotLine)}
                    strokeWidth={hc || focus ? fs(2.5) : fs(1)}
                  />
                  {spotsOn &&
                    Array.from({ length: 10 }).map((_, i) => {
                      const [x, y] = spotPos(id, i + 1);
                      return (
                        <rect key={i} x={x - 7} y={y - 13} width={14} height={26} rx={2} fill="none" stroke={c.lotLine} strokeWidth={fs(1)} />
                      );
                    })}
                  <text x={lot.x + 4} y={lot.y - fs(4)} fontSize={fs(9)} fontWeight={700} fill={focus || hc ? c.buildingText : c.label}>
                    Zone {id}
                  </text>
                </g>
              );
            })}
          {/* staging lot */}
          {stagingOn && props.baseMap && <rect x={STAGING.x} y={STAGING.y} width={STAGING.w} height={STAGING.h} rx={3} fill={c.lot} />}
          {stagingOn && !props.baseMap && (
            <g>
              <rect
                x={STAGING.x}
                y={STAGING.y}
                width={STAGING.w}
                height={STAGING.h}
                rx={6}
                fill={c.lot}
                stroke={c.lotLine}
                strokeWidth={fs(1)}
              />
              <text x={STAGING.x + 4} y={STAGING.y - fs(4)} fontSize={fs(9)} fontWeight={700} fill={c.buildingText}>
                Lot 7 · staging
              </text>
            </g>
          )}
          {props.closure && (
            <g>
              <line x1={CLOSURE.x1} y1={CLOSURE.y} x2={CLOSURE.x2} y2={CLOSURE.y} stroke="#ef4444" strokeWidth={15} />
              <line x1={CLOSURE.x1} y1={CLOSURE.y} x2={CLOSURE.x2} y2={CLOSURE.y} stroke="#fff" strokeWidth={3} strokeDasharray="8 6" />
            </g>
          )}
          {props.route && (
            <polyline
              points={props.route.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke={c.route}
              strokeWidth={4.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {props.walk && (
            <polyline
              points={props.walk.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke="#2563eb"
              strokeWidth={3.5}
              strokeDasharray="0.5 7"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>

        {/* ---- screen-space markers (constant size at any zoom) ---- */}
        {props.lotFill &&
          (['A', 'B'] as ZoneId[]).flatMap((id) => {
            const n = Math.round(Math.min(1, props.lotFill![id]) * 10);
            return Array.from({ length: n }).map((_, i) => {
              const slot = [6, 2, 9, 4, 1, 7, 3, 10, 5, 8][i];
              return <Car key={`l${id}${i}`} at={proj(spotPos(id, slot))} angle={-90} color={c.traffic} scale={0.62 * iconScale} />;
            });
          })}
        {stagingOn &&
          Array.from({ length: Math.min(40, Math.round((props.staged ?? 0) / 3)) }).map((_, i) => (
            <Car
              key={`s${i}`}
              at={proj([STAGING.x + 12 + (i % 5) * 22, STAGING.y + 14 + Math.floor(i / 5) * 13])}
              angle={0}
              color={c.traffic}
              scale={0.5 * iconScale}
            />
          ))}
        {props.baseMap && (
          <>
            <ParkingLabel at={proj([(LOTS.A.x + LOTS.B.x + LOTS.B.w) / 2, LOTS.A.y + LOTS.A.h + 12])} label="Rideshare Lot" dark={theme === 'dark'} />
            {stagingOn && (
              <ParkingLabel at={proj([STAGING.x + STAGING.w / 2, STAGING.y + STAGING.h + 12])} label="Lot 7 · Staging" dark={theme === 'dark'} />
            )}
          </>
        )}
        {props.traffic && <Traffic {...props.traffic} proj={proj} color={c.traffic} scale={iconScale} />}
        {props.pins?.map((p) => <Pin key={p.label} at={proj(p.pos)} label={p.label} dark={theme === 'dark'} />)}
        {props.pickup && (
          <PickupPin at={proj(props.pickup.pos)} label={props.pickup.label} eta={props.pickup.eta} dark={theme === 'dark'} />
        )}
        {props.pickupSpots
          ?.slice()
          .sort((a, b) => Number(!!a.selected) - Number(!!b.selected))
          .map((s) => <SpotMarker key={s.label} at={proj(s.pos)} label={s.label} selected={s.selected} />)}
        {props.you && <YouDot at={proj(props.you)} />}
        {props.car && (
          <Car at={proj(props.car.pos)} angle={props.car.angle} color={c.car} scale={1.15 * iconScale} main dark={theme === 'dark'} />
        )}
      </svg>
      {props.offline === 'saved' && (
        <div className="absolute left-1/2 top-12 -translate-x-1/2 rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-semibold text-gray-700 shadow">
          Saved map · offline
        </div>
      )}
      {props.children}
    </div>
  );
}

function Traffic({
  n,
  t,
  proj,
  color,
  scale,
}: {
  n: number;
  t: number;
  proj: (p: Pt) => Pt;
  color: string;
  scale: number;
}) {
  const cars: { pos: Pt; angle: number }[] = [];
  const share = [0.55, 0.3, 0.15];
  TRAFFIC_PATHS.forEach((path, k) => {
    const count = Math.round(n * share[k]);
    const len = pathLength(path);
    for (let i = 0; i < count; i++) {
      // Jammed cars queue back from the lot entrance and barely move; flowing cars are spread out and moving.
      const d = ((i / count) * len + t * 60) % len;
      if (d < 0) break;
      cars.push(along(path, d / len));
    }
  });
  return (
    <>
      {cars.map((car, i) => (
        <Car key={i} at={proj(car.pos)} angle={car.angle} color={color} scale={0.7 * scale} />
      ))}
    </>
  );
}

/** Top-down car pointing along `angle` (degrees, 0 = east). */
function Car({
  at,
  angle,
  color,
  scale = 1,
  main,
  dark,
}: {
  at: Pt;
  angle: number;
  color: string;
  scale?: number;
  main?: boolean;
  dark?: boolean;
}) {
  return (
    <g transform={`translate(${at[0]} ${at[1]}) rotate(${angle + 90}) scale(${scale})`}>
      {main && <circle r={15} fill={dark ? '#ffffff' : '#000000'} opacity={0.1} />}
      <rect
        x={-5.5}
        y={-10}
        width={11}
        height={20}
        rx={3.5}
        fill={color}
        stroke={main ? (dark ? '#000' : '#fff') : 'none'}
        strokeWidth={1.5}
      />
      <rect x={-4} y={-6.5} width={8} height={4.5} rx={1.5} fill={dark && main ? '#111' : '#ffffff'} opacity={0.75} />
      <rect x={-4} y={4} width={8} height={2.5} rx={1} fill={dark && main ? '#111' : '#ffffff'} opacity={0.5} />
    </g>
  );
}

function YouDot({ at }: { at: Pt }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <circle r={16} fill="#2563eb" opacity={0.14} />
      <circle r={7} fill="#2563eb" stroke="#fff" strokeWidth={2.5} />
    </g>
  );
}

function PickupPin({ at, label, eta, dark }: { at: Pt; label: string; eta?: string; dark?: boolean }) {
  const fg = dark ? '#000' : '#fff';
  const bg = dark ? '#fff' : '#000';
  const w = label.length * 6.4 + 16;
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <line y1={0} y2={-14} stroke={bg} strokeWidth={2} />
      <rect x={-5} y={-5} width={10} height={10} fill={bg} />
      <rect x={-2} y={-2} width={4} height={4} fill={fg} />
      <g transform="translate(0 -30)">
        {eta && (
          <g transform={`translate(${-w / 2 - 34} 0)`}>
            <rect width={34} height={24} fill={bg} />
            <text x={17} y={11} textAnchor="middle" fontSize={11} fontWeight={700} fill={fg}>
              {eta}
            </text>
            <text x={17} y={20} textAnchor="middle" fontSize={6.5} fontWeight={600} fill={fg}>
              MIN
            </text>
          </g>
        )}
        <rect x={-w / 2} width={w} height={24} fill={dark ? '#1f2329' : '#fff'} stroke={bg} strokeWidth={1} />
        <text x={0} y={16} textAnchor="middle" fontSize={11} fontWeight={700} fill={dark ? '#fff' : '#000'}>
          {label}
        </text>
      </g>
    </g>
  );
}

/** Base-map style parking label: a small "P" badge with grey text, like any lot on a street map. */
function ParkingLabel({ at, label, dark }: { at: Pt; label: string; dark?: boolean }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <rect x={-7} y={-7} width={14} height={14} rx={3} fill={dark ? '#4b5563' : '#6b7c93'} />
      <text x={0} y={4} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fff">
        P
      </text>
      <text x={11} y={4} fontSize={10} fontWeight={600} fill={dark ? '#9aa1ab' : '#5f6875'}>
        {label}
      </text>
    </g>
  );
}

const SPOT_BLUE = '#276ef1';

/** Airport-style pickup point: a blue marker, with a blue label when it's the chosen spot. */
function SpotMarker({ at, label, selected }: { at: Pt; label: string; selected?: boolean }) {
  const w = label.length * 6.1 + 22;
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      {selected && (
        <>
          <line y1={-6} y2={-20} stroke={SPOT_BLUE} strokeWidth={2.5} />
          <rect x={-w / 2} y={-44} width={w} height={24} rx={12} fill={SPOT_BLUE} />
          <text x={0} y={-28} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
            {label}
          </text>
        </>
      )}
      <circle r={selected ? 8 : 7} fill={selected ? SPOT_BLUE : '#fff'} stroke={SPOT_BLUE} strokeWidth={2} />
      <rect x={-2.5} y={-4} width={5} height={8} rx={1.5} fill={selected ? '#fff' : SPOT_BLUE} />
    </g>
  );
}

function Pin({ at, label, dark }: { at: Pt; label: string; dark?: boolean }) {
  const w = label.length * 6 + 14;
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <circle r={5} fill={dark ? '#fff' : '#000'} stroke={dark ? '#000' : '#fff'} strokeWidth={2} />
      <rect x={-w / 2} y={-30} width={w} height={20} rx={10} fill={dark ? '#fff' : '#000'} />
      <text x={0} y={-16} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={dark ? '#000' : '#fff'}>
        {label}
      </text>
    </g>
  );
}
