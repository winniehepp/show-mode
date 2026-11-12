import type { ReactNode } from 'react';
import { PhoneFrame } from '../components/PhoneFrame';
import { cx } from '../components/ui';
import { CityMap, fitCamera, type Camera, type MapProps } from '../map/CityMap';
import { journey } from '../map/journey';
import { MapButton, MapScreen, PHONE_H, PHONE_W } from '../map/MapScreen';
import { ARENA, HOME, spotPos, type Pt } from '../map/world';
import { MAYA_PARTY, RIDE_LABEL, SHOW_START, VENUES } from '../sim/config';
import { clock, money } from '../sim/format';
import { stageAt, type RiderStage } from '../sim/story';
import type { Features, RideType } from '../sim/types';
import { useSim } from '../state/SimContext';

export const RIDER_LABEL: Record<RiderStage, string> = {
  arriving: 'Arriving',
  show: 'During the show',
  ended: 'Show ends · pick ride',
  queue: 'In line',
  turn: 'Your turn',
  walk: 'Walk to spot',
  pickup: 'Pickup code',
  ride: 'In ride',
  arrived: 'Arrived',
};

export function riderLabel(stage: RiderStage, f: Features) {
  if (stage === 'walk' && !f.spots) return 'Walk to zone';
  return stage === 'pickup' && !f.codes ? 'Find your car' : RIDER_LABEL[stage];
}

export const CAR: Record<RideType, string> = { X: 'Gray Toyota Camry', XL: 'Gray Honda Odyssey' };

const VISIBLE = 0.55; // share of the screen above the bottom sheet
// Street-level only, like the base maps rideshare apps use: no bay-by-bay lot detail.
const MAX_ZOOM = 1.5;

export function RiderApp() {
  const { state, story, sim, snap, dispatch } = useSim();
  const f = state.features;
  const sc = state.scenarios;
  const v = VENUES[state.venue];
  const cur = stageAt(story.rider, state.t);
  const steps = story.rider.map((s) => ({ label: riderLabel(s.stage, f), start: s.start }));
  const t = Math.floor(state.t);
  const zone = state.mayaZone;
  const spot = f.spots ? story.spot : null;
  const target = spot ? `Spot ${spot}` : `Zone ${zone}`;
  const rideType = state.mayaType;
  const rideName = RIDE_LABEL[rideType];
  const car = CAR[rideType];
  const weak = sc.weakSignal && t >= sim.actualEnd - 5;
  const eta = Math.max(1, story.pickup - t);
  const devEta = Math.max(1, story.devArrive - t);
  const price = v.fare[rideType];
  const j = journey(state.t, story, f, zone);
  const z = snap.zones;
  const cancelled = state.rider.driverCancelled && (cur.stage === 'turn' || cur.stage === 'walk' || cur.stage === 'queue');

  /* ---- map ---- */
  const devOnMap = j.dev.leg === 'toSpot' || j.dev.leg === 'atSpot';
  // Named pickup points, airport style: Maya's is labelled, the other zone is a plain marker.
  const other = zone === 'A' ? 'B' : 'A';
  const spotName = f.spots ? `Rideshare Lot, Zone ${zone}, Spot ${spot}` : `Rideshare Lot, Zone ${zone}`;
  const pickupSpots = [
    { pos: f.spots ? spotPos(other, 7) : ([other === 'A' ? 370 : 490, 562] as Pt), label: `Zone ${other}` },
    { pos: j.pickupPt, label: spotName, selected: true },
  ];
  const pickupStages = ['ended', 'queue', 'turn', 'walk', 'pickup'];
  const directions = state.rider.directions && pickupStages.includes(cur.stage);
  const showChip = !directions && !cancelled && pickupStages.includes(cur.stage);
  // Frame the map in whatever the sheet and the "Directions to pickup" button leave visible.
  const visible = cur.stage === 'ended' ? 0.34 : cur.stage === 'queue' ? 0.4 : showChip ? VISIBLE - 0.08 : VISIBLE;
  const fit = (pts: Pt[], maxZoom = 2) => fitCamera(pts, PHONE_W, PHONE_H * visible, maxZoom, 36);
  const base: MapProps = {
    venue: v.name,
    camera: { x: ARENA.cx, y: ARENA.cy, zoom: 0.9 },
    visible,
    width: PHONE_W,
    height: PHONE_H,
    closure: true,
    baseMap: true,
    offline: weak ? 'saved' : null,
    traffic: { n: Math.min(14, (z.A.enRoute + z.B.enRoute) / 25), t: state.t },
  };
  let map: MapProps = base;
  let camera: Camera = base.camera;
  switch (cur.stage) {
    case 'arriving':
      map = { ...base, traffic: undefined, car: j.arriving, pins: [{ pos: [430, 300], label: v.name }] };
      camera = { x: j.arriving.pos[0], y: j.arriving.pos[1], zoom: 0.85 };
      break;
    case 'show':
      map = { ...base, you: j.maya.pos, traffic: undefined };
      camera = { x: ARENA.cx, y: ARENA.cy + 40, zoom: 1 };
      break;
    case 'ended':
      map = { ...base, you: j.maya.pos, pickupSpots };
      camera = fit(
        [
          [ARENA.cx, ARENA.cy - 40],
          [j.pickupPt[0], j.pickupPt[1] + 40],
        ],
        1.3,
      );
      break;
    case 'queue':
      map = { ...base, you: j.maya.pos, pickupSpots };
      camera = fit([[ARENA.cx, ARENA.cy], j.pickupPt], 1.4);
      break;
    case 'walk':
      map = {
        ...base,
        you: j.maya.pos,
        walk: j.walk,
        car: devOnMap ? j.dev : null,
        pickupSpots,
      };
      camera = fit(j.walk, MAX_ZOOM);
      break;
    case 'turn':
      map = {
        ...base,
        you: j.maya.pos,
        walk: j.walk,
        car: j.dev,
        route: devOnMap ? [j.dev.pos, ...j.toSpot.pts.slice(j.dev.seg + 1)] : null,
        pickupSpots,
      };
      camera = fit([j.dev.pos, j.pickupPt, ...(j.maya.pos ? [j.maya.pos] : [])], MAX_ZOOM);
      break;
    case 'pickup':
      map = { ...base, you: j.maya.pos, car: j.dev, pickupSpots };
      // Keep the pin below any notifications stacked at the top.
      camera = { x: j.pickupPt[0], y: j.pickupPt[1] - 56, zoom: MAX_ZOOM };
      break;
    case 'ride':
      map = { ...base, car: j.dev, route: [j.dev.pos, ...j.home.pts.slice(j.dev.seg + 1)], pins: [{ pos: HOME, label: 'Home' }] };
      camera = { x: j.dev.pos[0], y: j.dev.pos[1], zoom: 0.9 };
      break;
    case 'arrived':
      map = { ...base, traffic: undefined, pins: [{ pos: HOME, label: 'Home' }] };
      camera = { x: HOME[0], y: HOME[1] + 30, zoom: 1.4 };
      break;
  }

  /* ---- floating top controls ---- */
  const reminder = cur.stage === 'show' && t >= state.expectedEnd - 10 && t < sim.actualEnd;
  const sms = weak && (cur.stage === 'walk' || cur.stage === 'pickup');
  const top = (
    <>
      <div className="flex items-center gap-2">
        <MapButton>☰</MapButton>
        {t >= SHOW_START && (
          <span className="rounded-full bg-black px-3 py-1.5 text-[11px] font-semibold text-white shadow-md">Show Mode · {v.name}</span>
        )}
      </div>
      {weak && (
        <div className="rounded-lg bg-amber-100 px-3 py-1.5 text-[11px] font-semibold text-amber-900 shadow">
          Weak signal, showing saved info
        </div>
      )}
      {reminder && (
        <Notification title="SHOW MODE">
          Show ends around {clock(state.expectedEnd, false)}. When you're ready to leave, tap I'm heading out.
        </Notification>
      )}
      {sms && (
        <Notification title="MESSAGES · Show Mode">
          Your driver is at {target}, code {story.code}. {car} 7KXR 204.
        </Notification>
      )}
    </>
  );

  /* ---- bottom sheet ---- */
  let sheet: ReactNode;
  if (directions) sheet = directionsSheet();
  else if (cancelled) sheet = driverCancelledSheet();
  else
    switch (cur.stage) {
      case 'arriving':
        sheet = (
          <>
            <Title sub={`Drop-off at the main entrance · ${clock(SHOW_START)}`}>Heading to {v.name}</Title>
            <DriverRow name="Ana" car="White Prius · 4GHP 551" />
          </>
        );
        break;
      case 'show':
        sheet = (
          <>
            {/* Deliberately quiet: no end time or zone here. The zone is assigned at "I'm heading out". */}
            <Title sub={`When you're ready to leave, tap "I'm heading out" to save your place in line. We'll remind you near the end.`}>
              Enjoy the show
            </Title>
          </>
        );
        break;
      case 'ended':
        sheet = endedSheet();
        break;
      case 'queue':
        sheet = queueSheet();
        break;
      case 'walk':
        sheet = walkSheet();
        break;
      case 'turn':
        sheet = (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">It's your turn</div>
            <div className="flex items-start justify-between">
              <Title sub={`Dev is on the way in a ${car.replace('Gray ', '')}, about ${devEta} min.`}>Head to {target} now</Title>
              {f.codes && <CodeChip code={story.code} />}
            </div>
            <DriverRow name="Dev" car={`${car} · ${rideName}`} plate />
            <Primary onClick={() => dispatch({ type: 'setT', t: story.walkStart + 0.5 })}>I'm on my way</Primary>
            <DemoLink onClick={() => dispatch({ type: 'rider', patch: { driverCancelled: true } })}>Demo: driver cancels</DemoLink>
          </>
        );
        break;
      case 'pickup':
        sheet = pickupSheet();
        break;
      case 'ride':
        sheet = rideSheet();
        break;
      case 'arrived':
        sheet = (
          <>
            <Title sub="Thanks for riding with Show Mode">You've arrived</Title>
            <Rows
              rows={[
                ['Heading out → in car', `${story.pickup - story.join} min`],
                [`Fare · ${rideName}`, money(price)],
              ]}
            />
            <div className="mt-2 text-center text-[13px] font-semibold">How was your ride with Dev?</div>
            <div className="text-center text-[26px] tracking-widest">★★★★★</div>
          </>
        );
        break;
    }

  return (
    <PhoneFrame title="Rider app" persona="Maya" weak={weak} steps={steps} current={cur.index}>
      <MapScreen
        map={<CityMap {...map} camera={camera} />}
        top={top}
        sheet={sheet}
        tall={directions}
        floating={
          showChip ? (
            <button
              onClick={() => dispatch({ type: 'rider', patch: { directions: true } })}
              className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-[12.5px] font-semibold shadow-md"
            >
              <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-slate-700">
                <SignArt lines={['', '']} tiny />
              </span>
              Directions to pickup <span className="text-gray-400">›</span>
            </button>
          ) : undefined
        }
      />
    </PhoneFrame>
  );

  /* ---- sheets ---- */

  function directionsSheet() {
    const gate = zone === 'A' ? 3 : 4;
    const steps: { icon: string; title: string; sub: string; sign: string[] }[] = [
      { icon: '🚶', title: `Exit through Gate ${gate}`, sub: 'Follow signs for Ride App Pickup', sign: ['Ride App Pickup', `Gate ${gate} →`] },
      { icon: '🚦', title: 'Cross Pier St at the light', sub: 'Crossing staff on duty after the show', sign: ['Ride App Pickup', 'Rideshare Lot ↓'] },
      {
        icon: '🅿',
        title: `Enter the Rideshare Lot, Zone ${zone}`,
        sub: f.spots ? `Follow signs ${zone}1–${zone}10` : 'Your driver meets you at the curb',
        sign: [`Zone ${zone}`, f.spots ? `${zone}1–${zone}10 →` : 'Ride App Pickup'],
      },
      ...(spot ? [{ icon: '📍', title: `Spot ${spot}`, sub: '7th sign on your right', sign: [spot, 'Ride App Pickup'] }] : []),
    ];
    return (
      <>
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={() => dispatch({ type: 'rider', patch: { directions: false } })}
            className="text-[18px] leading-none text-gray-700"
            aria-label="Close directions"
          >
            ✕
          </button>
          <div className="text-[14px] font-bold">Directions to pickup</div>
          <span className="w-4" />
        </div>
        <div className="mb-2 text-center text-[11px] text-gray-500">
          {spotName} · 🚶 {v.walk[zone]} min{weak ? ' · saved to phone' : ''}
        </div>
        <ol className="space-y-3">
          {steps.map((s) => (
            <li key={s.title}>
              <div className="flex items-start gap-2">
                <span className="w-5 text-center text-[14px]">{s.icon}</span>
                <div>
                  <div className="text-[13.5px] font-semibold leading-snug">{s.title}</div>
                  <div className="text-[11.5px] text-gray-500">{s.sub}</div>
                </div>
              </div>
              <div className="mt-1.5 h-24 overflow-hidden rounded-lg">
                <SignArt lines={s.sign} />
              </div>
            </li>
          ))}
        </ol>
      </>
    );
  }

  function endedSheet() {
    const waitFor = (type: RideType) => {
      const lane = z[zone].lanes[type];
      return Math.max(3, Math.round(lane.p90 ?? z[zone].estWait));
    };
    const options: { type: RideType; seats: number }[] = [
      { type: 'X', seats: 4 },
      { type: 'XL', seats: 6 },
    ];
    return (
      <>
        <Title sub="Join the line from your seat. We'll tell you when to walk out.">Ready to go home?</Title>
        <div className="mb-2 rounded-lg border border-gray-200 px-2.5 py-1.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Your pickup spot</div>
          <div className="text-[13px] font-semibold">{spotName}</div>
          <div className="text-[11.5px] font-medium text-[#276ef1]">🚶 {v.walk[zone]} min from your seat</div>
        </div>
        <div className="space-y-1.5">
          {options.map((o) => (
            <button
              key={o.type}
              onClick={() => dispatch({ type: 'mayaType', rideType: o.type })}
              className={cx(
                'flex w-full items-center justify-between rounded-lg border-2 px-2.5 py-1.5 text-left',
                rideType === o.type ? 'border-black' : 'border-gray-200',
              )}
            >
              <div>
                <div className="text-[14px] font-bold">
                  {RIDE_LABEL[o.type]} <span className="text-[11px] font-medium text-gray-500">up to {o.seats}</span>
                </div>
                <div className="text-[11px] text-gray-500">
                  ~{waitFor(o.type)} min wait{f.xlLine ? '' : ' · shared line'}
                </div>
              </div>
              <div className="text-[15px] font-bold">{money(v.fare[o.type])}</div>
            </button>
          ))}
        </div>
        {rideType === 'XL' && <div className="mt-1 text-[11px] text-gray-500">Party of {MAYA_PARTY}: one car for the whole group.</div>}
        <Primary big onClick={() => dispatch({ type: 'setT', t: story.join + 0.5 })}>
          I'm heading out
        </Primary>
      </>
    );
  }

  function queueSheet() {
    const lastKnown = weak ? sim.snaps[Math.max(0, t - 3)].mayaAhead : snap.mayaAhead;
    const pos = (lastKnown ?? 0) + 1;
    const progress = Math.min(1, Math.max(0.04, 1 - (pos - 1) / Math.max(1, sim.maya.aheadAtJoin)));
    return (
      <>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Your place in line</div>
            <div className="text-[34px] font-bold leading-none tracking-tight">#{pos}</div>
            <div className="text-[13px] font-semibold">
              in the {f.xlLine ? `${rideName} line` : 'shared line'}, Zone {zone}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-bold leading-none">~{eta}</div>
            <div className="text-[11px] text-gray-500">min{weak ? ' (estimate)' : ''}</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-black transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        {weak && <div className="mt-1 text-[11px] text-amber-700">Last updated {clock(t - 3)}</div>}
        <Note>We're sending cars as fast as the curb can load them, so you can wait inside instead of at the curb.</Note>
        <Rows
          rows={[
            ['Head out in', `~${Math.max(1, story.turn - t)} min`],
            [rideName, `${money(price)} · no surge`],
          ]}
        />
      </>
    );
  }

  function walkSheet() {
    const list = [
      `Exit through Gate ${zone === 'A' ? 3 : 4}`,
      'Cross Pier St at the light',
      spot ? `Follow signs ${zone}1–${zone}10` : `Enter the Zone ${zone} lot`,
      ...(spot ? [`Spot ${spot}: 7th sign on your right`] : []),
    ];
    const at = Math.min(list.length - 1, Math.floor(j.maya.walkProgress * list.length));
    return (
      <>
        <Title sub={`Dev arrives in ~${devEta} min · map saved to phone`}>Walk to {target}</Title>
        <ol className="space-y-1">
          {list.map((s, i) => (
            <li key={s} className={cx('flex items-center gap-2 text-[13px]', i < at && 'text-gray-400', i === at && 'font-semibold')}>
              <span
                className={cx(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  i === at ? 'bg-[#2563eb] text-white' : 'bg-gray-100',
                )}
              >
                {i < at ? '✓' : i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </>
    );
  }

  function pickupSheet() {
    const confirmed = state.rider.codeConfirmed;
    if (!f.codes) {
      return (
        <>
          <Title sub="Busy pickup area. Match the license plate before you get in.">Find your car</Title>
          <DriverRow name="Dev" car={car} plate />
          <Primary onClick={() => dispatch({ type: 'setT', t: story.pickup + 1.5 })}>I'm in the car</Primary>
        </>
      );
    }
    return (
      <>
        <div className="flex items-center justify-between">
          <Title sub="Show this to Dev">Meet at {target}</Title>
        </div>
        <div className="rounded-xl bg-black py-2 text-center text-white">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Pickup code</div>
          <div className="font-mono text-[44px] font-bold leading-tight tracking-[0.18em]">{story.code}</div>
        </div>
        <DriverRow name="Dev" car={`${car} · party of ${rideType === 'XL' ? MAYA_PARTY : 1}`} plate />
        <Primary
          onClick={() => {
            dispatch({ type: 'rider', patch: { codeConfirmed: true } });
            setTimeout(() => dispatch({ type: 'setT', t: story.pickup + 1.5 }), 500);
          }}
          className={confirmed ? 'bg-emerald-500' : undefined}
        >
          {confirmed ? 'Code matches ✓' : 'Code matches?'}
        </Primary>
      </>
    );
  }

  function rideSheet() {
    const p = Math.min(1, (state.t - story.pickup - 1) / story.rideMin);
    return (
      <>
        <Title sub={`Arriving ${clock(story.rideEnd)} · Home, 6.2 mi`}>{Math.max(1, Math.round(story.rideMin * (1 - p)))} min to home</Title>
        <div className="h-1.5 rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-black" style={{ width: `${Math.max(4, p * 100)}%` }} />
        </div>
        <DriverRow name="Dev" car={`${car} · ${money(price)}`} />
      </>
    );
  }

  function driverCancelledSheet() {
    return (
      <>
        <Title sub="Dev had to cancel. Next driver assigned, no starting over.">You keep your place in line</Title>
        <DriverRow name="Sam" car={`${rideType === 'XL' ? 'Toyota Sienna' : 'Honda Accord'} · 5MBT 918 · ~${devEta + 1} min`} plate />
        <Note>
          Same {rideName} line, same {spot ? `Spot ${spot}` : `Zone ${zone}`}, same code {story.code}, same price.
        </Note>
        <Primary onClick={() => dispatch({ type: 'rider', patch: { driverCancelled: false } })}>OK</Primary>
      </>
    );
  }
}

/* ---- sheet primitives ---- */

function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-[19px] font-bold leading-tight tracking-tight">{children}</h2>
      {sub && <p className="mt-0.5 text-[12px] leading-snug text-gray-500">{sub}</p>}
    </div>
  );
}

function Primary({ children, onClick, big, className }: { children: ReactNode; onClick: () => void; big?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'mt-2.5 w-full rounded-lg bg-black font-bold text-white active:scale-[0.99]',
        big ? 'h-16 text-[20px]' : 'h-11 text-[15px]',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="divide-y divide-gray-100">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between py-1.5 text-[13px]">
          <span className="text-gray-500">{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <div className="my-2 rounded-lg bg-gray-100 px-2.5 py-2 text-[11.5px] leading-snug text-gray-600">{children}</div>;
}

function DemoLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-1.5 w-full text-center text-[11px] font-medium text-gray-400 underline">
      {children}
    </button>
  );
}

function DriverRow({ name, car, plate }: { name: string; car: string; plate?: boolean }) {
  return (
    <div className="my-1.5 flex items-center gap-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[14px] font-bold">{name[0]}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold">
          {name} <span className="text-[12px] font-medium text-gray-500">★ 4.96</span>
        </div>
        <div className="truncate text-[12px] text-gray-500">{car}</div>
      </div>
      {plate && <span className="rounded bg-gray-100 px-1.5 py-1 font-mono text-[11px] font-bold">7KXR 204</span>}
    </div>
  );
}

function CodeChip({ code }: { code: string }) {
  return (
    <div className="rounded-lg bg-black px-2 py-1 text-center text-white">
      <div className="text-[8px] font-semibold uppercase tracking-wider text-gray-400">Code</div>
      <div className="font-mono text-[16px] font-bold leading-tight tracking-widest">{code}</div>
    </div>
  );
}

function Notification({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="animate-slide-down rounded-2xl bg-white/95 p-2.5 shadow-lg ring-1 ring-black/5">
      <div className="flex justify-between text-[10px] font-semibold text-gray-500">
        <span>{title}</span>
        <span>now</span>
      </div>
      <div className="text-[12px] font-medium leading-snug">{children}</div>
    </div>
  );
}

/**
 * Stand-in for the venue photos in the directions guide: a sign in the
 * standard "Ride App Pickup" style, against a dim concourse.
 */
function SignArt({ lines, tiny }: { lines: string[]; tiny?: boolean }) {
  if (tiny)
    return (
      <svg viewBox="0 0 28 28" className="h-full w-full">
        <rect x={5} y={8} width={18} height={11} rx={2} fill="#0f172a" />
        <rect x={8} y={11} width={7} height={2} rx={1} fill="#fff" />
        <rect x={8} y={14.5} width={11} height={2} rx={1} fill="#94a3b8" />
      </svg>
    );
  return (
    <svg viewBox="0 0 240 96" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <linearGradient id="concourse" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#64748b" />
          <stop offset="1" stopColor="#334155" />
        </linearGradient>
      </defs>
      <rect width={240} height={96} fill="url(#concourse)" />
      <rect x={0} y={70} width={240} height={26} fill="#1e293b" opacity={0.6} />
      <rect x={118} y={44} width={4} height={40} fill="#0f172a" />
      <rect x={52} y={14} width={136} height={38} rx={4} fill="#0f172a" stroke="#cbd5e1" strokeWidth={1} />
      <g transform="translate(64 23)">
        <rect width={18} height={20} rx={3} fill="#fff" />
        <rect x={4} y={7} width={10} height={6} rx={2} fill="#0f172a" />
        <circle cx={6} cy={15} r={1.5} fill="#0f172a" />
        <circle cx={12} cy={15} r={1.5} fill="#0f172a" />
      </g>
      <text x={90} y={30} fontSize={11} fontWeight={700} fill="#fff">
        {lines[0]}
      </text>
      <text x={90} y={44} fontSize={9.5} fontWeight={600} fill="#cbd5e1">
        {lines[1]}
      </text>
    </svg>
  );
}
