import { useSim } from '../state/SimContext';
import { Modal } from './Modal';

const PHASES = [
  {
    tag: 'MVP · 0–6 months',
    title: 'Prove Uber can fix the concert exit',
    current: true,
    items: [
      '2–3 high-volume arenas plus a dozen mid-size venues, using existing rideshare zones',
      'Virtual queue + dispatch pacing, with separate UberX and UberXL lines',
      'Pickup codes, and an ops event view with forecast, live P90 by zone and ride type, alerts and controls',
      'Large pilot venues: numbered spots, gate-to-spot wayfinding, and a staging lot with priority dispatch',
      'Weak-signal fallbacks; planned closures and the staging route set up before each show',
    ],
  },
  {
    tag: 'M1 · 6–12 months',
    title: 'Become the go-to partner for top venues',
    items: [
      'Match on approach',
      'Schedule a ride home at drop-off with a locked price',
      'Quiet ride',
      'Virtual staging: a geofenced driver queue for venues without land',
      'Live venue feeds for show times and closures',
      'Delay-and-save offers',
      'Driver incentive test for staging',
      'Shared ops view and post-event reports for partners',
      'Software-only rollout to mid-size concert venues',
    ],
  },
  {
    tag: 'M2 · 12+ months',
    title: 'More event types',
    items: [
      'Ticketing integration: book the ride home with the ticket',
      'Sports with live game-state forecasting and "beat the rush" nudges',
      'Multimodal queue with Shuttle, Max and AV partners',
      'Off-site pickup hubs for festivals and motorsports',
      'Playlist mode',
    ],
  },
  {
    tag: 'Vision',
    title: 'One queue for every way home',
    items: ['One queue across every ride type', 'Transit handoffs', 'Dynamic zones', 'Showcased at a major event like the LA28 Olympics'],
  },
];

export function RoadmapModal() {
  const { state, dispatch } = useSim();
  if (state.modal !== 'roadmap') return null;
  return (
    <Modal
      title="Roadmap"
      sub="Out of scope for the MVP. The MVP proves the curb is the bottleneck, then we scale."
      onClose={() => dispatch({ type: 'modal', modal: null })}
    >
      <div className="grid grid-cols-4 gap-3">
        {PHASES.map((p, i) => (
          <section key={p.tag} className={p.current ? 'rounded-xl bg-black p-4 text-white' : 'rounded-xl border border-gray-200 p-4'}>
            <div
              className={
                p.current
                  ? 'text-[11px] font-semibold uppercase tracking-wide text-gray-400'
                  : 'text-[11px] font-semibold uppercase tracking-wide text-gray-500'
              }
            >
              {i + 1}. {p.tag}
            </div>
            <h3 className="mt-1 text-[16px] font-bold leading-snug">{p.title}</h3>
            <ul className="mt-3 space-y-2">
              {p.items.map((it) => (
                <li
                  key={it}
                  className={p.current ? 'text-[12.5px] leading-snug text-gray-200' : 'text-[12.5px] leading-snug text-gray-600'}
                >
                  · {it}
                </li>
              ))}
            </ul>
            {p.current && (
              <div className="mt-3 inline-block rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold">THIS PROTOTYPE</div>
            )}
          </section>
        ))}
      </div>
    </Modal>
  );
}
