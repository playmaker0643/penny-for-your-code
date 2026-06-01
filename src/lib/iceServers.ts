import { supabase } from "@/integrations/supabase/client";

const FALLBACK: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

let cached: { servers: RTCIceServer[]; at: number } | null = null;
const TTL = 1000 * 60 * 30; // 30 min

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cached && Date.now() - cached.at < TTL) return cached.servers;
  try {
    const { data, error } = await supabase.functions.invoke("get-ice-servers");
    if (error || !data?.iceServers) {
      return FALLBACK;
    }
    cached = { servers: data.iceServers, at: Date.now() };
    return data.iceServers;
  } catch {
    return FALLBACK;
  }
}
