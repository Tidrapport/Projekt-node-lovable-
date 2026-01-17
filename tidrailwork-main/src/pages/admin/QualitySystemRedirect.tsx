import { useEffect, useState } from "react";

const DEFAULT_QMS_URL = "http://localhost:5175";
const TOKEN_KEY = "opero_token";
const LEGACY_TOKEN_KEY = "access_token";
const DEFAULT_STANDARD = "3834-2";

const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
  } catch {
    return null;
  }
};

const buildTargetUrl = () => {
  const raw = import.meta.env.VITE_QMS_URL?.trim() || DEFAULT_QMS_URL;
  if (!raw) return null;
  try {
    return new URL(raw, window.location.origin);
  } catch {
    return null;
  }
};

const QualitySystemRedirect = ({ standard = DEFAULT_STANDARD }: { standard?: string }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const targetUrl = buildTargetUrl();
    if (!targetUrl) {
      setError("Saknar giltig QMS-lank. Satt VITE_QMS_URL.");
      return;
    }

    if (standard) {
      targetUrl.searchParams.set("standard", standard);
    }

    const token = getToken();
    const shouldPassToken = targetUrl.origin !== window.location.origin;
    if (token && shouldPassToken && !targetUrl.searchParams.has("token")) {
      targetUrl.searchParams.set("token", token);
    }

    window.location.assign(targetUrl.toString());
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
      {error || "Oppnar Kvalitetssystem..."}
    </div>
  );
};

export default QualitySystemRedirect;
