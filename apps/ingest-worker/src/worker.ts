export default {
  async fetch(): Promise<Response> {
    return Response.json({
      status: 'not-configured',
      nextSlice: 'DBH raw evidence archive and normalized ingestion',
    });
  },

  async scheduled(): Promise<void> {
    // The first source adapter will be DBH. Scheduled orchestration is deliberately empty
    // until raw evidence storage and idempotency keys are part of the same vertical slice.
  },
} satisfies ExportedHandler;
