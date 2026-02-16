import { Routes, Route } from "react-router-dom";
import { useTelegram } from "./hooks/useTelegram.js";
import Layout from "./components/Layout.js";
import RentalHistory from "./pages/RentalHistory.js";
import Statistics from "./pages/Statistics.js";
import VehicleDetail from "./pages/VehicleDetail.js";

export default function App() {
  useTelegram();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RentalHistory />} />
        <Route path="/stats" element={<Statistics />} />
        <Route path="/vehicle/:id" element={<VehicleDetail />} />
      </Routes>
    </Layout>
  );
}
