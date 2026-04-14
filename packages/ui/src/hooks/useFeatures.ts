import { useState, useEffect, useCallback } from "react";
import { api, type FeatureData } from "../lib/api.ts";

export function useFeatures() {
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getFeatures();
      setFeatures(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load features");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const analyzeFeature = useCallback(async (featureId: string) => {
    const feature = features.find((f) => f.id === featureId);
    if (!feature) return;

    setFeatures((prev) =>
      prev.map((f) =>
        f.id === featureId ? { ...f, analysisStatus: "analyzing" as const } : f
      )
    );

    try {
      const updated = await api.analyzeFeature(featureId);
      setFeatures((prev) =>
        prev.map((f) => (f.id === featureId ? updated : f))
      );
    } catch (err) {
      setFeatures((prev) =>
        prev.map((f) =>
          f.id === featureId ? { ...f, analysisStatus: "error" as const } : f
        )
      );
    }
  }, [features]);

  return { features, loading, error, refresh, analyzeFeature };
}
