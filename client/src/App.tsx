import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PilotView from './pages/PilotView';
import ControllerView from './pages/ControllerView';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/pilot" element={<PilotView />} />
      <Route path="/controller" element={<ControllerView />} />
    </Routes>
  );
}

export default App;
