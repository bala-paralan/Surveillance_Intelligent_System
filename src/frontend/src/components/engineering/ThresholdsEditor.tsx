import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getFusionWeights, updateFusionWeights } from '@/api/fusion';
import { useAuth } from '@/hooks/useAuth';

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastState = { type: 'success' | 'error'; message: string } | null;

// ── Component ─────────────────────────────────────────────────────────────────

export const ThresholdsEditor = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [jsonText, setJsonText] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fusion-weights'],
    queryFn: getFusionWeights,
    staleTime: 60_000,
  });

  // Populate textarea when data arrives
  useEffect(() => {
    if (data !== undefined) {
      setJsonText(JSON.stringify(data.weights, null, 2));
    }
  }, [data]);

  const { mutate: doSave, isPending: saving } = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        throw new Error('Invalid JSON');
      }
      // Expect the first item in the array or the whole object
      const body = Array.isArray(parsed) ? parsed[0] : parsed;
      return updateFusionWeights(body as Parameters<typeof updateFusionWeights>[0]);
    },
    onSuccess: () => {
      setToast({ type: 'success', message: 'Fusion weights saved successfully.' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setToast({ type: 'error', message: msg });
      setTimeout(() => setToast(null), 4000);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const val = e.target.value;
    setJsonText(val);
    try {
      JSON.parse(val);
      setParseError(null);
    } catch {
      setParseError('Invalid JSON');
    }
  };

  const handleSave = (): void => {
    if (parseError !== null) return;
    doSave();
  };

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading fusion weights…</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-400">Failed to load fusion weights.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-300">
          Edit the fusion classifier weights. Save to update the analytics engine.
        </p>
        {isAdmin && (
          <button
            type="button"
            disabled={saving || parseError !== null}
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      {parseError !== null && (
        <p className="text-xs text-red-400">{parseError}</p>
      )}

      {toast !== null && (
        <div
          className={`text-xs px-3 py-2 rounded ${toast.type === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      <textarea
        value={jsonText}
        onChange={handleChange}
        readOnly={!isAdmin}
        spellCheck={false}
        className={`
          w-full h-80 bg-gray-950 border rounded-lg p-3 text-xs font-mono text-gray-200
          focus:outline-none focus:ring-1 focus:ring-indigo-500
          ${parseError !== null ? 'border-red-600' : 'border-gray-700'}
          ${!isAdmin ? 'opacity-70 cursor-not-allowed' : ''}
        `}
        aria-label="Fusion weights JSON editor"
      />

      {!isAdmin && (
        <p className="text-xs text-gray-500 italic">Read-only. Admin role required to save.</p>
      )}
    </div>
  );
};
