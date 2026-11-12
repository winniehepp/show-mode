import { ControlBar } from './components/ControlBar';
import { ReportModal } from './components/ReportModal';
import { RoadmapModal } from './components/RoadmapModal';
import { ViewTabs } from './components/ViewTabs';
import { DriverApp } from './driver/DriverApp';
import { OpsView } from './ops/OpsView';
import { RiderApp } from './rider/RiderApp';
import { useSim } from './state/SimContext';

export function App() {
  const { state } = useSim();
  return (
    <div className="flex h-full flex-col">
      <ControlBar />
      <main className="flex min-h-0 flex-1 flex-col px-4 pt-2">
        <ViewTabs />
        <div className="flex min-h-0 flex-1 justify-center overflow-y-auto py-3">
          {state.view === 'rider' && <RiderApp />}
          {state.view === 'driver' && <DriverApp />}
          {state.view === 'ops' && <OpsView />}
        </div>
      </main>
      <ReportModal />
      <RoadmapModal />
    </div>
  );
}
