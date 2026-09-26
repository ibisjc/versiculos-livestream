import "./App.css";
import { Route, Routes } from 'react-router';
import CaptionWindow from './windows/CaptionWindow';
import ControlWindow from './windows/ControlWindow';
import { AppStateContextProvider } from "./contexts/VerseReferenceContext";


function App() {
  return (
    <AppStateContextProvider>
      <Routes>
        <Route path="/" element={<ControlWindow />}/>
        <Route path="/caption" element={<CaptionWindow />}/>
      </Routes>
    </AppStateContextProvider>
  )
}

export default App;
