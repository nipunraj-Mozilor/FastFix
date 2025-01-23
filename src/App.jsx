import { Routes, Route } from "react-router-dom";
import SignUp from "./pages/SignUp";
import Analyzer from "./pages/Analyzer";
import AIFix from "./pages/AIFix";

function App() {
  return (
    <Routes>
      <Route path="/" element={<SignUp />} />
      <Route path="/analyzer" element={<Analyzer />} />
      <Route path="/ai-fix" element={<AIFix />} />
    </Routes>
  );
}

export default App;
