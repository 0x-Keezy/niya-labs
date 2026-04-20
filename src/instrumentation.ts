export async function register() {
  // Sentry is disabled - no instrumentation needed
}

export const onRequestError = () => {
  // Error handler disabled when Sentry is not configured
};
