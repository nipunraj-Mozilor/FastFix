import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SignUp from "./pages/SignUp";
import Analyzer from "./pages/Analyzer";
import AIFix from "./pages/AIFix";
import GitHubConfig from "./pages/GitHubConfig";

function App() {
  return (
    <Routes>
      <Route path='/' element={<SignUp />} />
      <Route path='/analyzer' element={<Analyzer />} />
      <Route path='/analyze/:id' element={<Analyzer />} />
      <Route path='/ai-fix' element={<AIFix />} />
      <Route path='/github-config' element={<GitHubConfig />} />
    </Routes>
  );
}

export default App;
