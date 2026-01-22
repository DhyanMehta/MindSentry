// Placeholder service layer for future FastAPI integration.
export const ApiService = {
  fetchDashboard: async () => {
    // TODO: replace with FastAPI endpoint
    return { ok: true };
  },
  submitCheckIn: async (payload) => {
    // TODO: POST mood + multi-modal metrics to backend
    console.log('check-in submitted', payload);
    return { ok: true };
  },
  fetchInsights: async () => {
    // TODO: GET time-series trend data
    return { ok: true };
  },
};
