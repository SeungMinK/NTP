import "./App.css";
import { Routes, Route } from "react-router-dom";
import Login from "./page/Sign/Login";
import Home from "./page/system/Home";
function App() {
  return (
    <div className="root" id="root">
      <header>header</header>
      <section>
        <Routes>
          <Route exact path="/" element={<Login />} />
          <Route path="/home" element={<Home />} />
        </Routes>
      </section>
      <footer>footer</footer>
    </div>
  );
}

export default App;
