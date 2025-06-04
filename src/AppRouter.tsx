import { Routes, Route } from "react-router-dom";
import { Home } from "@/pages/Home";
import { EventDetail } from "@/pages/EventDetail";
import { CreateEvent } from "@/pages/CreateEvent";
import { Profile } from "@/pages/Profile";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/event/:eventId" element={<EventDetail />} />
      <Route path="/create" element={<CreateEvent />} />
      <Route path="/profile/:npub" element={<Profile />} />
    </Routes>
  );
}
